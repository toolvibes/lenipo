import type { WorkingTime } from '@toolvibes/shared';
import {
  type Clause,
  type DateValue,
  type Duration,
  type Expression,
  type FieldDef,
  type FunctionOperand,
  HISTORY,
  type HistoryPredicate,
  type Operand,
  type Operator,
  parseDateValue,
  parseDuration,
  parseIncrement,
  type Query,
  STATUS_CATEGORY_NAMES,
  type TimeUnit,
  type TqlError,
  tqlError,
  type ValueOperand,
} from '@toolvibes/tql';
import {
  and,
  asc,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
  not,
  or,
  type SQL,
  type SQLWrapper,
  sql,
} from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  distanceTo,
  nearestIds,
  type QueryVector,
  SEMANTIC_CANDIDATES,
} from '../ai/semantic.service.js';
import type { Executor } from '../db/client.js';
import {
  groupMembers,
  groups,
  issueComments,
  issueComponents,
  issues,
  issueVersions,
  issueWatchers,
  projectVersions,
  sprintIssues,
  sprints,
  users,
} from '../db/schema/index.js';
import type { MetaIndex } from '../tracking/meta.service.js';

/** A custom field as the compiler needs it: its select options for label lookups. */
export interface CustomFieldOptions {
  options: ReadonlyArray<{ id: string; value: string }>;
}

export interface CompileContext {
  userId: string;
  /** IANA time zone of the searcher; date functions and date literals use it. */
  timeZone: string;
  meta: MetaIndex;
  /** Projects the searcher may browse; other projects do not exist for the query. */
  projects: ReadonlyArray<{ id: string; key: string; name: string }>;
  /** Components of those projects. */
  components: ReadonlyArray<{ id: string; name: string }>;
  /** For "1d" and "1w" in time tracking values (E-47). */
  workingTime: WorkingTime;
  /** Options of select fields by field id, for values written as labels (E-50). */
  customFields: ReadonlyMap<string, CustomFieldOptions>;
  /** The text of `similar ~ "…"` as vector; null without semantic search (TL-49). */
  semantic?: (text: string) => Promise<QueryVector | null>;
}

export interface CompiledQuery {
  where: SQL | undefined;
  orderBy: SQL[];
  /**
   * With full text: the same conditions checked row by row, for when the text matches so many
   * issues that walking the sort order beats collecting all matches first (TL-90).
   */
  rowWhere?: SQL | undefined;
}

type Item = ValueOperand | FunctionOperand;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INTERVAL_PART: Record<TimeUnit, number> = { y: 0, M: 1, w: 2, d: 3, h: 4, m: 5 };

const TRUNCATE_UNIT: Record<string, 'day' | 'week' | 'month' | 'year'> = {
  d: 'day',
  w: 'week',
  M: 'month',
  y: 'year',
};

const CATEGORY_ORDER = { todo: 0, in_progress: 1, done: 2 } as const;

function interval(durations: Duration[]): SQL {
  const parts = [0, 0, 0, 0, 0, 0];
  for (const { amount, unit } of durations) {
    parts[INTERVAL_PART[unit]] = (parts[INTERVAL_PART[unit]] ?? 0) + amount;
  }
  const [years, months, weeks, days, hours, minutes] = parts;
  return sql`make_interval(${years}::int, ${months}::int, ${weeks}::int, ${days}::int, ${hours}::int, ${minutes}::int)`;
}

function items(operand: Operand): Item[] {
  if (operand.kind === 'list') return operand.items;
  if (operand.kind === 'empty') return [];
  return [operand];
}

function positive(operator: Operator): boolean {
  return operator === '=' || operator === 'in' || operator === '~';
}

/**
 * Translates a parsed TQL query into SQL conditions on `issues`. Values are resolved against
 * stored data (decision E-35); unknown values are collected as errors with their positions.
 * The permission filter is not part of this; the caller always adds it.
 */
/** Order fields whose value is never empty. */
const NEVER_EMPTY = new Set(['created', 'updated', 'key', 'project']);

export class TqlCompiler {
  readonly errors: TqlError[] = [];
  private usersByValue = new Map<string, string>();
  private groupsByValue = new Map<string, string>();
  /** The accounts of AI agents, when the query names `agents()` (TL-92). */
  private agentIds: string[] = [];
  private issuesByKey = new Map<string, string>();
  private sprintsByValue = new Map<string, string[]>();
  private versionsByValue = new Map<string, string[]>();
  /** Whether the query searches text, and in which of the two forms (TL-90). */
  private hasText = false;
  private textByRow = false;
  /** Vectors of the texts in `similar ~ "…"`; the first one orders unordered results. */
  private vectors = new Map<string, QueryVector>();
  private similarity: SQL | undefined;

  constructor(
    private readonly db: Executor,
    private readonly context: CompileContext,
  ) {}

  async compile(query: Query): Promise<CompiledQuery> {
    await this.resolveReferences(query.where);
    const where = query.where ? this.expression(query.where) : undefined;
    const orderBy =
      this.similarity && query.orderBy.length === 0
        ? [sql`${this.similarity} asc nulls last`, desc(issues.id)]
        : this.orderBy(query);
    if (!this.hasText || !query.where) return { where, orderBy };
    // Same clauses again, now with text matches per row; errors were collected the first time.
    const errors = this.errors.length;
    this.textByRow = true;
    const rowWhere = this.expression(query.where);
    this.errors.length = errors;
    return { where, orderBy, rowWhere };
  }

  // ---------------------------------------------------------------- references

  /** Looks up every user, group and linkedIssues() issue named in the query, one query each. */
  private async resolveReferences(expression: Expression | null): Promise<void> {
    const userValues = new Set<string>();
    const groupValues = new Set<string>();
    const issueKeys = new Set<string>();
    const sprintValues = new Set<string>();
    const versionValues = new Set<string>();
    const visitedBy = new Set<Expression>();
    const semanticValues = new Map<string, { start: number; end: number }>();
    let wantsAgents = false;
    const visit = (node: Expression): void => {
      if (node.kind === 'and' || node.kind === 'or') node.items.forEach(visit);
      else if (node.kind === 'not') visit(node.expression);
      else if (node.history?.some((predicate) => predicate.kind === 'by') && !visitedBy.has(node)) {
        // People named in BY (TL-17) are looked up with the other users.
        visitedBy.add(node);
        for (const predicate of node.history) {
          if (predicate.kind !== 'by') continue;
          for (const item of items(predicate.operand)) {
            if (item.kind === 'value') userValues.add(item.value.toLowerCase());
          }
        }
        visit(node);
      } else if (node.field.type === 'semantic') {
        for (const item of items(node.operand)) {
          if (item.kind === 'value') semanticValues.set(item.value, item.span);
        }
      } else if (node.field.type === 'user') {
        for (const item of items(node.operand)) {
          if (item.kind === 'value') userValues.add(item.value.toLowerCase());
          else if (item.fn.name === 'membersOf' && item.args[0]) {
            groupValues.add(item.args[0].toLowerCase());
          } else if (item.fn.name === 'agents') wantsAgents = true;
        }
      } else if (node.field.type === 'version') {
        for (const item of items(node.operand)) {
          if (item.kind === 'value') versionValues.add(item.value.toLowerCase());
        }
      } else if (node.field.type === 'sprint') {
        for (const item of items(node.operand)) {
          if (item.kind === 'value') sprintValues.add(item.value.toLowerCase());
        }
      } else if (node.field.type === 'issue') {
        for (const item of items(node.operand)) {
          if (item.kind === 'function' && item.fn.name === 'linkedIssues' && item.args[0]) {
            issueKeys.add(item.args[0].toUpperCase());
          }
        }
      }
    };
    if (expression) visit(expression);

    for (const [text, span] of semanticValues) {
      const vector = await this.context.semantic?.(text);
      if (vector) this.vectors.set(text, vector);
      else this.errors.push(tqlError('semantic-unavailable', span));
    }

    if (versionValues.size > 0 && this.context.projects.length > 0) {
      // Only versions of projects the searcher sees, so names do not leak (E-57).
      const values = [...versionValues];
      const ids = values.filter((value) => UUID.test(value));
      const rows = await this.db
        .select({ id: projectVersions.id, name: projectVersions.name })
        .from(projectVersions)
        .where(
          and(
            inArray(
              projectVersions.projectId,
              this.context.projects.map((project) => project.id),
            ),
            or(
              inArray(sql`lower(${projectVersions.name})`, values),
              ids.length > 0 ? inArray(projectVersions.id, ids) : undefined,
            ),
          ),
        );
      for (const row of rows) {
        for (const key of [row.name.toLowerCase(), row.id]) {
          this.versionsByValue.set(key, [...(this.versionsByValue.get(key) ?? []), row.id]);
        }
      }
    }

    if (sprintValues.size > 0) {
      const values = [...sprintValues];
      const ids = values.filter((value) => UUID.test(value));
      const rows = await this.db
        .select({ id: sprints.id, name: sprints.name })
        .from(sprints)
        .where(
          or(
            inArray(sql`lower(${sprints.name})`, values),
            ids.length > 0 ? inArray(sprints.id, ids) : undefined,
          ),
        );
      for (const row of rows) {
        for (const key of [row.name.toLowerCase(), row.id]) {
          this.sprintsByValue.set(key, [...(this.sprintsByValue.get(key) ?? []), row.id]);
        }
      }
    }

    if (issueKeys.size > 0 && this.context.projects.length > 0) {
      // Only issues the searcher can see; others are reported as unknown.
      const rows = await this.db
        .select({ id: issues.id, key: issues.key })
        .from(issues)
        .where(
          and(
            inArray(issues.key, [...issueKeys]),
            isNull(issues.deletedAt),
            inArray(
              issues.projectId,
              this.context.projects.map((project) => project.id),
            ),
          ),
        );
      for (const row of rows) this.issuesByKey.set(row.key, row.id);
    }

    if (userValues.size > 0) {
      const values = [...userValues];
      const ids = values.filter((value) => UUID.test(value));
      const rows = await this.db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(
          or(inArray(users.email, values), ids.length > 0 ? inArray(users.id, ids) : undefined),
        );
      for (const row of rows) {
        this.usersByValue.set(row.email, row.id);
        this.usersByValue.set(row.id, row.id);
      }
    }
    if (groupValues.size > 0) {
      const values = [...groupValues];
      const ids = values.filter((value) => UUID.test(value));
      const rows = await this.db
        .select({ id: groups.id, name: groups.name })
        .from(groups)
        .where(
          or(
            inArray(sql`lower(${groups.name})`, values),
            ids.length > 0 ? inArray(groups.id, ids) : undefined,
          ),
        );
      for (const row of rows) {
        this.groupsByValue.set(row.name.toLowerCase(), row.id);
        this.groupsByValue.set(row.id, row.id);
      }
    }
    if (wantsAgents) {
      const rows = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.kind, 'agent'));
      this.agentIds = rows.map((row) => row.id);
    }
  }

  private notFound(field: FieldDef, item: { span: { start: number; end: number } }, value: string) {
    this.errors.push(tqlError('value-not-found', item.span, { field: field.id, value }));
  }

  // ---------------------------------------------------------------- expressions

  private expression(node: Expression): SQL {
    switch (node.kind) {
      case 'and':
        return and(...node.items.map((item) => this.expression(item))) as SQL;
      case 'or':
        return or(...node.items.map((item) => this.expression(item))) as SQL;
      case 'not':
        return not(this.expression(node.expression));
      case 'clause':
        return this.clause(node);
    }
  }

  private clause(clause: Clause): SQL {
    if (HISTORY.includes(clause.operator)) return this.history(clause);
    if (clause.field.custom) return this.custom(clause);
    switch (clause.field.type) {
      case 'project':
        return this.byId(clause, issues.projectId, (value) => this.projectIds(value));
      case 'issue-type':
        return this.byId(clause, issues.issueTypeId, (value) =>
          this.metaIds(this.context.meta.issueTypes, value),
        );
      case 'status':
        return this.byId(clause, issues.statusId, (value) =>
          this.metaIds(this.context.meta.statuses, value),
        );
      case 'priority':
        return this.byId(clause, issues.priorityId, (value) =>
          this.metaIds(this.context.meta.priorities, value),
        );
      case 'resolution':
        return this.byId(clause, issues.resolutionId, (value) =>
          this.metaIds(this.context.meta.resolutions, value),
        );
      case 'status-category':
        return this.byId(clause, issues.statusId, (value) => this.categoryStatusIds(value));
      case 'user':
        return this.user(clause);
      case 'text':
        return this.text(clause);
      case 'label':
        return this.labels(clause);
      case 'number':
        return this.number(clause);
      case 'date':
      case 'datetime':
        return this.date(clause);
      case 'issue':
        return this.issueKey(clause);
      case 'component':
        return this.component(clause);
      case 'link-type':
        return this.linkType(clause);
      case 'duration':
        return this.duration(clause);
      case 'semantic':
        return this.semantic(clause);
      case 'sprint':
        return this.sprint(clause);
      case 'version':
        return this.version(clause);
      case 'option':
      case 'boolean':
        // Only custom fields have these types; they are handled above.
        return sql`false`;
    }
  }

  // ---------------------------------------------------------------- sprints (E-55)

  /**
   * An issue is in a sprint while its membership row is open; closed sprints keep the rows of
   * their issues, also of unfinished ones that moved on, as in JQL.
   */
  private sprint(clause: Clause): SQL {
    const member = (condition: SQL) =>
      exists(
        this.db
          .select({ one: sql`1` })
          .from(sprintIssues)
          .innerJoin(sprints, eq(sprints.id, sprintIssues.sprintId))
          .where(
            and(eq(sprintIssues.issueId, issues.id), isNull(sprintIssues.removedAt), condition),
          ),
      );
    if (clause.operator === 'is') return not(member(sql`true`));
    if (clause.operator === 'is not') return member(sql`true`);
    const conditions: SQL[] = [];
    for (const item of items(clause.operand)) {
      if (item.kind === 'function') {
        const states =
          item.fn.name === 'openSprints'
            ? ['active', 'future']
            : item.fn.name === 'closedSprints'
              ? ['closed']
              : ['future'];
        conditions.push(inArray(sprints.state, states as Array<'active' | 'future' | 'closed'>));
        continue;
      }
      const ids = this.sprintsByValue.get(item.value.toLowerCase()) ?? [];
      if (ids.length === 0) this.notFound(clause.field, item, item.value);
      else conditions.push(inArray(sprints.id, ids));
    }
    if (conditions.length === 0) return sql`false`;
    const match = member(or(...conditions) as SQL);
    return positive(clause.operator) ? match : not(match);
  }

  // ---------------------------------------------------------------- versions (E-57)

  private version(clause: Clause): SQL {
    const kind = clause.field.id === 'fixVersion' ? 'fix' : 'affects';
    const has = (condition: SQL) =>
      exists(
        this.db
          .select({ one: sql`1` })
          .from(issueVersions)
          .innerJoin(projectVersions, eq(projectVersions.id, issueVersions.versionId))
          .where(
            and(eq(issueVersions.issueId, issues.id), eq(issueVersions.kind, kind), condition),
          ),
      );
    if (clause.operator === 'is') return not(has(sql`true`));
    if (clause.operator === 'is not') return has(sql`true`);
    const conditions: SQL[] = [];
    for (const item of items(clause.operand)) {
      if (item.kind === 'function') {
        const released = item.fn.name === 'releasedVersions';
        const key = item.args[0];
        let scope: SQL | undefined;
        if (key) {
          const project = this.context.projects.find(
            (entry) => entry.key.toLowerCase() === key.toLowerCase(),
          );
          if (!project) {
            this.errors.push(
              tqlError('value-not-found', item.span, { field: 'project', value: key }),
            );
            continue;
          }
          scope = eq(projectVersions.projectId, project.id);
        }
        conditions.push(and(eq(projectVersions.released, released), scope) as SQL);
        continue;
      }
      const ids = this.versionsByValue.get(item.value.toLowerCase()) ?? [];
      if (ids.length === 0) this.notFound(clause.field, item, item.value);
      else conditions.push(inArray(projectVersions.id, ids));
    }
    if (conditions.length === 0) return sql`false`;
    const match = has(or(...conditions) as SQL);
    return positive(clause.operator) ? match : not(match);
  }

  // ---------------------------------------------------------------- custom fields (E-50)

  /** The stored value as text; values are validated on write, so casts are safe. */
  private customText(id: string): SQL {
    return sql`(${issues.customFields} ->> ${id})`;
  }

  private hasValue(id: string): SQL {
    return sql`(${issues.customFields} ? ${id})`;
  }

  /** Matches a stored JSON value by containment, which the GIN index serves. */
  private contains(id: string, value: unknown): SQL {
    return sql`(${issues.customFields} @> ${JSON.stringify({ [id]: value })}::jsonb)`;
  }

  private custom(clause: Clause): SQL {
    const info = clause.field.custom;
    if (!info) return sql`false`;
    const { id } = info;
    if (clause.operator === 'is') return not(this.hasValue(id));
    if (clause.operator === 'is not') return this.hasValue(id);
    switch (info.type) {
      case 'text':
      case 'textarea':
      case 'url': {
        const item = items(clause.operand)[0];
        if (item?.kind !== 'value') return sql`false`;
        const pattern = `%${item.value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
        const match = sql`${this.customText(id)} ilike ${pattern}`;
        return positive(clause.operator) ? match : (and(this.hasValue(id), not(match)) as SQL);
      }
      case 'number':
        return this.number(clause, sql`${this.customText(id)}::numeric`);
      case 'date':
        return this.date(clause, sql`${this.customText(id)}::date`);
      case 'datetime':
        return this.date(clause, sql`${this.customText(id)}::timestamptz`);
      case 'user':
        return this.user(clause, sql`${this.customText(id)}::uuid`);
      case 'users':
        return this.users(clause, id);
      case 'labels': {
        const matches = items(clause.operand).flatMap((item) =>
          item.kind === 'value' ? [this.contains(id, [item.value])] : [],
        );
        if (matches.length === 0) return sql`false`;
        const match = or(...matches) as SQL;
        return positive(clause.operator) ? match : (and(this.hasValue(id), not(match)) as SQL);
      }
      case 'checkbox': {
        const item = items(clause.operand)[0];
        if (item?.kind !== 'value') return sql`false`;
        // Only ticked boxes are stored, so "false" is every issue without the value.
        const ticked = this.contains(id, true);
        const wanted = item.value.toLowerCase() === 'true';
        return wanted === (clause.operator === '=') ? ticked : not(ticked);
      }
      case 'select':
      case 'multiselect':
      case 'cascade':
      case 'group':
      case 'version': {
        const options = this.context.customFields.get(id)?.options ?? [];
        const matches: SQL[] = [];
        for (const item of items(clause.operand)) {
          if (item.kind !== 'value') continue;
          const wanted = item.value.toLowerCase();
          // A cascading parent also finds its children ("Deutschland" → "Deutschland › Berlin").
          const found = options.filter(
            (option) =>
              option.id === wanted ||
              option.value.toLowerCase() === wanted ||
              (info.type === 'cascade' && option.value.toLowerCase().startsWith(`${wanted} › `)),
          );
          if (found.length === 0) this.notFound(clause.field, item, item.value);
          for (const option of found) {
            matches.push(this.contains(id, info.type === 'multiselect' ? [option.id] : option.id));
          }
        }
        if (matches.length === 0) return sql`false`;
        const match = or(...matches) as SQL;
        return positive(clause.operator) ? match : (and(this.hasValue(id), not(match)) as SQL);
      }
    }
  }

  /** Fields stored as a reference: each value resolves to one or more ids. */
  private byId(clause: Clause, column: AnyPgColumn, resolve: (value: string) => string[]): SQL {
    if (clause.operator === 'is') return isNull(column);
    if (clause.operator === 'is not') return isNotNull(column);
    const ids: string[] = [];
    for (const item of items(clause.operand)) {
      if (item.kind !== 'value') continue; // functions do not apply here; the parser reported them
      const found = resolve(item.value);
      if (found.length === 0) this.notFound(clause.field, item, item.value);
      ids.push(...found);
    }
    if (ids.length === 0) return sql`false`;
    const match = inArray(column, ids);
    // `!=` and `not in` never match empty values, as in JQL.
    return positive(clause.operator) ? match : (and(isNotNull(column), not(match)) as SQL);
  }

  private metaIds(
    entries: ReadonlyArray<{ id: string; key: string; name: string }>,
    value: string,
  ) {
    const wanted = value.toLowerCase();
    return entries
      .filter(
        (entry) =>
          entry.id === wanted ||
          entry.key.toLowerCase() === wanted ||
          entry.name.toLowerCase() === wanted,
      )
      .map((entry) => entry.id);
  }

  private projectIds(value: string): string[] {
    const wanted = value.toLowerCase();
    return this.context.projects
      .filter(
        (project) =>
          project.id === wanted ||
          project.key.toLowerCase() === wanted ||
          project.name.toLowerCase() === wanted,
      )
      .map((project) => project.id);
  }

  private categoryStatusIds(value: string): string[] {
    const wanted = value.toLowerCase();
    const category = (
      Object.keys(STATUS_CATEGORY_NAMES) as Array<keyof typeof STATUS_CATEGORY_NAMES>
    ).find((name) => STATUS_CATEGORY_NAMES[name].includes(wanted));
    if (!category) return [];
    return this.context.meta.statuses
      .filter((status) => status.category === category)
      .map((status) => status.id);
  }

  private user(clause: Clause, customColumn?: SQL): SQL {
    const column: SQLWrapper | null =
      customColumn ??
      (clause.field.id === 'assignee'
        ? issues.assigneeId
        : clause.field.id === 'reporter'
          ? issues.reporterId
          : null);
    if (clause.operator === 'is' || clause.operator === 'is not') {
      if (!column) return sql`false`;
      return clause.operator === 'is' ? isNull(column) : isNotNull(column);
    }
    const ids: string[] = [];
    const groupIds: string[] = [];
    for (const item of items(clause.operand)) {
      if (item.kind === 'function') {
        if (item.fn.name === 'currentUser') ids.push(this.context.userId);
        else if (item.fn.name === 'agents') ids.push(...this.agentIds);
        else if (item.fn.name === 'membersOf') {
          const name = item.args[0] ?? '';
          const group = this.groupsByValue.get(name.toLowerCase());
          if (group) groupIds.push(group);
          else
            this.errors.push(
              tqlError('value-not-found', item.span, { field: 'group', value: name }),
            );
        }
        continue;
      }
      const id = this.usersByValue.get(item.value.toLowerCase());
      if (id) ids.push(id);
      else this.notFound(clause.field, item, item.value);
    }
    const matchUser = (target: SQLWrapper): SQL =>
      or(
        ids.length > 0 ? inArray(target, ids) : undefined,
        groupIds.length > 0
          ? inArray(
              target,
              this.db
                .select({ userId: groupMembers.userId })
                .from(groupMembers)
                .where(inArray(groupMembers.groupId, groupIds)),
            )
          : undefined,
      ) ?? sql`false`;

    if (!column) {
      // watcher: issues watched by one of the users
      const watched = exists(
        this.db
          .select({ one: sql`1` })
          .from(issueWatchers)
          .where(and(eq(issueWatchers.issueId, issues.id), matchUser(issueWatchers.userId))),
      );
      return positive(clause.operator) ? watched : not(watched);
    }
    const match = matchUser(column);
    return positive(clause.operator) ? match : (and(isNotNull(column), not(match)) as SQL);
  }

  /** Fields of several people (E-90): any of the named people, or members of a group. */
  private users(clause: Clause, id: string): SQL {
    const ids: string[] = [];
    const groupIds: string[] = [];
    for (const item of items(clause.operand)) {
      if (item.kind === 'function') {
        if (item.fn.name === 'currentUser') ids.push(this.context.userId);
        else if (item.fn.name === 'agents') ids.push(...this.agentIds);
        else if (item.fn.name === 'membersOf') {
          const group = this.groupsByValue.get((item.args[0] ?? '').toLowerCase());
          if (group) groupIds.push(group);
        }
        continue;
      }
      const found = this.usersByValue.get(item.value.toLowerCase());
      if (found) ids.push(found);
      else this.notFound(clause.field, item, item.value);
    }
    const stored = sql`(${issues.customFields} -> ${id})`;
    const match =
      or(
        ...ids.map((userId) => this.contains(id, [userId])),
        groupIds.length > 0
          ? sql`${stored} ?| array(${this.db
              .select({ userId: sql`${groupMembers.userId}::text` })
              .from(groupMembers)
              .where(inArray(groupMembers.groupId, groupIds))})`
          : undefined,
      ) ?? sql`false`;
    return positive(clause.operator) ? match : (and(this.hasValue(id), not(match)) as SQL);
  }

  // ---------------------------------------------------------------- full text

  /** German and English stemmed query; `word*` searches by prefix (decision E-36). */
  private tsQuery(item: ValueOperand, field: FieldDef): SQL | null {
    const terms = item.value.split(/\s+/).filter(Boolean);
    const perConfig = (config: 'german' | 'english'): SQL[] =>
      terms.flatMap((term) => {
        const words = term.match(/[\p{L}\p{N}]+/gu) ?? [];
        if (words.length === 0) return [];
        const parts: SQL[] = [];
        const last = term.endsWith('*') ? words.pop() : undefined;
        if (words.length > 0) {
          parts.push(sql`plainto_tsquery(${config}::regconfig, ${words.join(' ')})`);
        }
        if (last) parts.push(sql`to_tsquery(${config}::regconfig, ${`${last}:*`})`);
        return parts;
      });
    const german = perConfig('german');
    if (german.length === 0) {
      this.errors.push(
        tqlError('no-search-terms', item.span, { field: field.id, value: item.value }),
      );
      return null;
    }
    const english = perConfig('english');
    return sql`((${sql.join(german, sql` && `)}) || (${sql.join(english, sql` && `)}))`;
  }

  private text(clause: Clause): SQL {
    if (
      clause.field.id === 'description' &&
      (clause.operator === 'is' || clause.operator === 'is not')
    ) {
      return clause.operator === 'is'
        ? eq(issues.descriptionText, '')
        : sql`${issues.descriptionText} <> ''`;
    }
    const item = items(clause.operand)[0];
    if (item?.kind !== 'value') return sql`false`;
    const query = this.tsQuery(item, clause.field);
    if (!query) return sql`false`;
    this.hasText = true;
    const inIssue = (weight: 'a' | 'b' | null) =>
      weight
        ? sql`(${issues.searchVector} @@ ${query} and ts_filter(${issues.searchVector}, ${`{${weight}}`}::"char"[]) @@ ${query})`
        : sql`${issues.searchVector} @@ ${query}`;
    // Uncorrelated, so both GIN indexes do the work instead of a check per issue (TL-44, E-125).
    const commented = sql`select ${issueComments.issueId} from ${issueComments}
      where ${issueComments.deletedAt} is null and ${issueComments.searchVector} @@ ${query}`;
    // Row by row, the commented issues come as one array computed once (TL-90).
    const inComments = this.textByRow
      ? sql`${issues.id} = any(array(${commented}))`
      : sql`${issues.id} in (${commented})`;
    let match: SQL;
    switch (clause.field.id) {
      case 'summary':
        match = inIssue('a');
        break;
      case 'description':
        match = inIssue('b');
        break;
      case 'comment':
        match = inComments;
        break;
      default:
        match = this.textByRow
          ? sql`(${issues.searchVector} @@ ${query} or ${inComments})`
          : sql`${issues.id} in (
          select ${issues.id} from ${issues} where ${issues.searchVector} @@ ${query}
          union all ${commented})`;
    }
    return clause.operator === '~' ? match : not(match);
  }

  /**
   * The issues nearest in meaning (TL-49, E-139): the closest candidates by embedding, which
   * the other clauses and the permission filter then narrow.
   */
  private semantic(clause: Clause): SQL {
    const item = items(clause.operand)[0];
    const vector = item?.kind === 'value' ? this.vectors.get(item.value) : undefined;
    if (!vector) return sql`false`;
    this.similarity ??= distanceTo('issue', vector, issues.id);
    return sql`${issues.id} in (${nearestIds('issue', vector, SEMANTIC_CANDIDATES)})`;
  }

  // ---------------------------------------------------------------- labels, numbers, keys

  private labels(clause: Clause): SQL {
    const hasLabels = sql`cardinality(${issues.labels}) > 0`;
    if (clause.operator === 'is') return sql`cardinality(${issues.labels}) = 0`;
    if (clause.operator === 'is not') return hasLabels;
    const values = items(clause.operand).flatMap((item) =>
      item.kind === 'value' ? [item.value] : [],
    );
    if (values.length === 0) return sql`false`;
    const array = sql`array[${sql.join(
      values.map((value) => sql`${value}`),
      sql`, `,
    )}]::text[]`;
    const match = sql`${issues.labels} && ${array}`;
    return positive(clause.operator) ? match : (and(hasLabels, not(match)) as SQL);
  }

  private number(clause: Clause, column: SQLWrapper = issues.storyPoints): SQL {
    if (clause.operator === 'is') return isNull(column);
    if (clause.operator === 'is not') return isNotNull(column);
    const values = items(clause.operand).flatMap((item) =>
      item.kind === 'value' ? [Number(item.value)] : [],
    );
    if (values.length === 0) return sql`false`;
    if (clause.operator === 'in') return inArray(column, values);
    if (clause.operator === 'not in')
      return and(isNotNull(column), not(inArray(column, values))) as SQL;
    return sql`${column} ${sql.raw(clause.operator === '!=' ? '<>' : clause.operator)} ${values[0]}`;
  }

  private issueKey(clause: Clause): SQL {
    const column = clause.field.id === 'parent' ? issues.parentId : issues.id;
    if (clause.operator === 'is') return isNull(column);
    if (clause.operator === 'is not') return isNotNull(column);
    const keys = items(clause.operand).flatMap((item) =>
      item.kind === 'value' ? [item.value.toUpperCase()] : [],
    );
    const matches: SQL[] = [];
    if (keys.length > 0) {
      if (clause.field.id === 'key') matches.push(inArray(issues.key, keys));
      else {
        // An alias, so the subquery does not shadow the outer issues table.
        const list = sql.join(
          keys.map((key) => sql`${key}`),
          sql`, `,
        );
        matches.push(
          sql`${issues.parentId} in (select p.id from issues p where p.key in (${list}))`,
        );
      }
    }
    for (const item of items(clause.operand)) {
      // The caller's recently viewed issues (TL-17).
      if (item.kind === 'function' && item.fn.name === 'issueHistory') {
        matches.push(
          sql`${column} in (select r.target_id from recent_items r where r.user_id = ${this.context.userId} and r.kind = 'issue')`,
        );
      }
    }
    for (const item of items(clause.operand)) {
      if (item.kind !== 'function' || item.fn.name !== 'linkedIssues') continue;
      const linked = this.linkedIssues(clause.field, item);
      if (linked) matches.push(sql`${column} in ${linked}`);
    }
    if (matches.length === 0) return sql`false`;
    const match = or(...matches) as SQL;
    if (positive(clause.operator)) return match;
    return clause.field.id === 'parent'
      ? (and(isNotNull(issues.parentId), not(match)) as SQL)
      : not(match);
  }

  // ---------------------------------------------------------------- history (TL-17, E-98)

  /** The ids a history clause names: statuses, priorities, resolutions or people. */
  private historyIds(field: FieldDef, operand: Operand): string[] {
    const ids: string[] = [];
    for (const item of items(operand)) {
      if (field.type === 'user') {
        if (item.kind === 'function') {
          if (item.fn.name === 'currentUser') ids.push(this.context.userId);
          else if (item.fn.name === 'agents') ids.push(...this.agentIds);
          continue;
        }
        const id = this.usersByValue.get(item.value.toLowerCase());
        if (id) ids.push(id);
        else this.notFound(field, item, item.value);
        continue;
      }
      if (item.kind !== 'value') continue;
      const meta = this.context.meta;
      const entries =
        field.type === 'status'
          ? meta.statuses
          : field.type === 'priority'
            ? meta.priorities
            : meta.resolutions;
      const found = this.metaIds(entries, item.value);
      if (found.length === 0) this.notFound(field, item, item.value);
      ids.push(...found);
    }
    return ids;
  }

  /** The time conditions of BY-less predicates on an instant or a period [start, finish). */
  private historyTime(predicates: HistoryPredicate[], start: SQL, finish: SQL | null): SQL[] {
    const conditions: SQL[] = [];
    const open = (point: SQL) =>
      finish ? sql`(${finish} is null or ${finish} > ${point})` : sql`${start} > ${point}`;
    for (const predicate of predicates) {
      if (!['after', 'before', 'on', 'during'].includes(predicate.kind)) continue;
      const list = items(predicate.operand);
      const first = list[0] ? this.instant(list[0]) : null;
      switch (predicate.kind) {
        case 'after':
          if (first) conditions.push(open(first));
          break;
        case 'before':
          if (first) conditions.push(sql`${start} < ${first}`);
          break;
        case 'on':
          if (first) {
            const day = sql`date_trunc('day', ${first})`;
            conditions.push(sql`${start} < ${day} + interval '1 day'`, open(day));
          }
          break;
        case 'during': {
          const last = list[1] ? this.instant(list[1]) : null;
          if (first && last) conditions.push(sql`${start} <= ${last}`, open(first));
          break;
        }
        default:
          break;
      }
    }
    return conditions;
  }

  /**
   * WAS and CHANGED (TL-17, E-98). WAS looks at the periods a value held – from the creation
   * with the first change's old value (or today's value if nothing changed), then each change –
   * so it also matches the current and the original value, as in JQL. CHANGED looks at the
   * changes themselves.
   */
  private history(clause: Clause): SQL {
    const field = clause.field.id;
    const predicates = clause.history ?? [];
    const by = predicates
      .filter((predicate) => predicate.kind === 'by')
      .flatMap((predicate) =>
        this.historyIds({ ...clause.field, type: 'user' }, predicate.operand),
      );
    const hasBy = predicates.some((predicate) => predicate.kind === 'by');
    const changes = sql`from issue_change_items ci join issue_change_groups g on g.id = ci.group_id
      where g.issue_id = ${issues.id} and ci.field = ${field}`;
    const list = (ids: string[]) =>
      sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      );

    if (clause.operator === 'changed') {
      const conditions: SQL[] = [];
      for (const predicate of predicates) {
        if (predicate.kind !== 'from' && predicate.kind !== 'to') continue;
        const ids = this.historyIds(clause.field, predicate.operand);
        if (ids.length === 0) return sql`false`;
        const column = predicate.kind === 'from' ? sql`ci.from_value` : sql`ci.to_value`;
        conditions.push(sql`${column} in (${list(ids)})`);
      }
      if (hasBy) {
        if (by.length === 0) return sql`false`;
        conditions.push(sql`g.author_id in (${list(by)})`);
      }
      conditions.push(...this.historyTime(predicates, sql`g.created_at`, null));
      const extra = conditions.length > 0 ? sql` and ${sql.join(conditions, sql` and `)}` : sql``;
      return sql`exists (select 1 ${changes}${extra})`;
    }

    const ids = this.historyIds(clause.field, clause.operand);
    if (ids.length === 0) return clause.operator.startsWith('was not') ? sql`true` : sql`false`;
    const current =
      field === 'status'
        ? issues.statusId
        : field === 'priority'
          ? issues.priorityId
          : field === 'resolution'
            ? issues.resolutionId
            : issues.assigneeId;
    const conditions: SQL[] = [sql`p.value in (${list(ids)})`];
    if (hasBy) {
      if (by.length === 0) return sql`false`;
      conditions.push(sql`p.author in (${list(by)})`);
    }
    conditions.push(...this.historyTime(predicates, sql`p.start`, sql`p.finish`));
    const periods = sql`(
      select ci.to_value as value, g.created_at as start, g.author_id as author,
        lead(g.created_at) over (order by g.created_at, g.id) as finish
      ${changes}
      union all
      select coalesce(
          (select ci.from_value ${changes} order by g.created_at, g.id limit 1),
          case when exists (select 1 ${changes}) then null else ${current}::text end
        ), ${issues.createdAt}, ${issues.reporterId},
        (select g.created_at ${changes} order by g.created_at, g.id limit 1)
    ) p`;
    const was = sql`exists (select 1 from ${periods} where ${sql.join(conditions, sql` and `)})`;
    return clause.operator === 'was' || clause.operator === 'was in' ? was : not(was);
  }

  // ---------------------------------------------------------------- time tracking

  private duration(clause: Clause): SQL {
    const column =
      clause.field.id === 'originalEstimate'
        ? issues.originalEstimateSeconds
        : clause.field.id === 'remainingEstimate'
          ? issues.remainingEstimateSeconds
          : issues.timeSpentSeconds;
    if (clause.operator === 'is') return isNull(column);
    if (clause.operator === 'is not') return isNotNull(column);
    const values = items(clause.operand).flatMap((item) => {
      const seconds =
        item.kind === 'value' ? parseDuration(item.value, this.context.workingTime) : undefined;
      return seconds === undefined ? [] : [seconds];
    });
    if (values.length === 0) return sql`false`;
    if (clause.operator === 'in') return inArray(column, values);
    if (clause.operator === 'not in')
      return and(isNotNull(column), not(inArray(column, values))) as SQL;
    return sql`${column} ${sql.raw(clause.operator === '!=' ? '<>' : clause.operator)} ${values[0]}`;
  }

  // ---------------------------------------------------------------- components and links

  private component(clause: Clause): SQL {
    const anyComponent = exists(
      this.db
        .select({ one: sql`1` })
        .from(issueComponents)
        .where(eq(issueComponents.issueId, issues.id)),
    );
    if (clause.operator === 'is') return not(anyComponent);
    if (clause.operator === 'is not') return anyComponent;
    const ids: string[] = [];
    for (const item of items(clause.operand)) {
      if (item.kind !== 'value') continue;
      const wanted = item.value.toLowerCase();
      const found = this.context.components.filter(
        (component) => component.id === wanted || component.name.toLowerCase() === wanted,
      );
      if (found.length === 0) this.notFound(clause.field, item, item.value);
      ids.push(...found.map((component) => component.id));
    }
    if (ids.length === 0) return sql`false`;
    const match = exists(
      this.db
        .select({ one: sql`1` })
        .from(issueComponents)
        .where(
          and(eq(issueComponents.issueId, issues.id), inArray(issueComponents.componentId, ids)),
        ),
    );
    // Like != elsewhere: issues without any component do not match.
    return positive(clause.operator) ? match : (and(anyComponent, not(match)) as SQL);
  }

  /**
   * Link type ids per direction for a value. A direction phrase ("blockiert", "wird blockiert
   * von") means that direction; otherwise the type's key or name means both. Phrases win,
   * because a type's name may equal one of its phrases.
   */
  private linkDirections(value: string): { outward: string[]; inward: string[] } | null {
    const wanted = value.toLowerCase();
    const types = this.context.meta.linkTypes;
    const outward = types
      .filter((type) => type.outward.toLowerCase() === wanted)
      .map((type) => type.id);
    const inward = types
      .filter((type) => type.inward.toLowerCase() === wanted)
      .map((type) => type.id);
    if (outward.length + inward.length > 0) return { outward, inward };
    const whole = types
      .filter((type) => type.key === wanted || type.name.toLowerCase() === wanted)
      .map((type) => type.id);
    return whole.length > 0 ? { outward: whole, inward: whole } : null;
  }

  private typeFilter(ids: string[] | null): SQL {
    if (ids === null) return sql``;
    if (ids.length === 0) return sql` and false`;
    return sql` and l.type_id in (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )})`;
  }

  /** Ids of issues linked to the issue named in linkedIssues(key[, type]). */
  private linkedIssues(field: FieldDef, item: FunctionOperand): SQL | null {
    const key = (item.args[0] ?? '').toUpperCase();
    const id = this.issuesByKey.get(key);
    if (!id) {
      this.errors.push(tqlError('value-not-found', item.span, { field: field.id, value: key }));
      return null;
    }
    let directions: { outward: string[]; inward: string[] } | null = null;
    if (item.args[1] !== undefined) {
      directions = this.linkDirections(item.args[1]);
      if (!directions) {
        this.errors.push(
          tqlError('value-not-found', item.span, { field: 'issueLinkType', value: item.args[1] }),
        );
        return null;
      }
    }
    return sql`(select l.target_id from issue_links l where l.source_id = ${id}${this.typeFilter(
      directions?.outward ?? null,
    )} union select l.source_id from issue_links l where l.target_id = ${id}${this.typeFilter(
      directions?.inward ?? null,
    )})`;
  }

  /** Issues with a link of the given type to an issue the searcher can see. */
  private linkType(clause: Clause): SQL {
    const outward: string[] = [];
    const inward: string[] = [];
    for (const item of items(clause.operand)) {
      if (item.kind !== 'value') continue;
      const directions = this.linkDirections(item.value);
      if (!directions) this.notFound(clause.field, item, item.value);
      outward.push(...(directions?.outward ?? []));
      inward.push(...(directions?.inward ?? []));
    }
    if (outward.length + inward.length === 0 || this.context.projects.length === 0)
      return sql`false`;
    const visible = sql.join(
      this.context.projects.map((project) => sql`${project.id}`),
      sql`, `,
    );
    const side = (
      own: 'source_id' | 'target_id',
      other: 'source_id' | 'target_id',
      ids: string[],
    ) =>
      ids.length === 0
        ? sql`false`
        : sql`exists (select 1 from issue_links l join issues o on o.id = l.${sql.raw(other)}
            where l.${sql.raw(own)} = ${issues.id}${this.typeFilter(ids)}
              and o.deleted_at is null and o.project_id in (${visible}))`;
    const match = sql`(${side('source_id', 'target_id', outward)} or ${side('target_id', 'source_id', inward)})`;
    return positive(clause.operator) ? match : not(match);
  }

  // ---------------------------------------------------------------- dates

  private local(expression: SQL): SQL {
    return sql`(${expression} at time zone ${this.context.timeZone})`;
  }

  private fromLocal(expression: SQL): SQL {
    return sql`(${expression} at time zone ${this.context.timeZone})`;
  }

  /** A point in time (timestamptz) for a date literal or date function. */
  private instant(item: Item): SQL | null {
    if (item.kind === 'function') {
      const fn = item.fn;
      if (fn.name === 'now') return sql`now()`;
      const unit = fn.defaultUnit;
      if (!unit) return null;
      const increment = item.args[0] ? parseIncrement(item.args[0], unit) : undefined;
      const shifted = increment ? sql`(now() + ${interval([increment])})` : sql`now()`;
      const truncate = TRUNCATE_UNIT[unit] as string;
      const start = sql`date_trunc(${truncate}, ${this.local(shifted)})`;
      if (fn.name.startsWith('start')) return this.fromLocal(start);
      return sql`(${this.fromLocal(sql`(${start} + ${sql.raw(`interval '1 ${truncate}'`)})`)} - interval '1 microsecond')`;
    }
    const value = parseDateValue(item.value) as DateValue;
    if (value.kind === 'relative') return sql`(now() + ${interval(value.parts)})`;
    return this.fromLocal(sql`${`${value.date} ${value.time ?? '00:00'}`}::timestamp`);
  }

  private date(clause: Clause, customColumn?: SQL): SQL {
    const column: SQLWrapper =
      customColumn ??
      (clause.field.id === 'due'
        ? issues.dueDate
        : clause.field.id === 'startDate'
          ? issues.startDate
          : clause.field.id === 'created'
            ? issues.createdAt
            : clause.field.id === 'updated'
              ? issues.updatedAt
              : issues.resolvedAt);
    if (clause.operator === 'is') return isNull(column);
    if (clause.operator === 'is not') return isNotNull(column);
    const item = items(clause.operand)[0];
    if (!item) return sql`false`;
    const operator = sql.raw(clause.operator === '!=' ? '<>' : clause.operator);

    if (clause.field.type === 'date') {
      // Due dates have no time: compare with the local calendar day of the instant.
      const day =
        item.kind === 'value' && parseDateValue(item.value)?.kind === 'absolute'
          ? sql`${(parseDateValue(item.value) as { date: string }).date}::date`
          : sql`(${this.local(this.instant(item) ?? sql`now()`)})::date`;
      return sql`${column} ${operator} ${day}`;
    }

    const point = this.instant(item);
    if (!point) return sql`false`;
    // `created = 2026-10-28` means the whole local day, not just its first instant.
    const literal = item.kind === 'value' ? parseDateValue(item.value) : undefined;
    if (
      literal?.kind === 'absolute' &&
      !literal.time &&
      (clause.operator === '=' || clause.operator === '!=')
    ) {
      const sameDay = sql`(${column} >= ${point} and ${column} < ${point} + interval '1 day')`;
      return clause.operator === '=' ? sameDay : (and(isNotNull(column), not(sameDay)) as SQL);
    }
    return sql`${column} ${operator} ${point}`;
  }

  // ---------------------------------------------------------------- ordering

  /** Sorts by the position of the id in an ordered list (types, statuses, priorities, …). */
  private byPosition(column: AnyPgColumn, ids: string[]): SQL {
    if (ids.length === 0) return sql`${column}`;
    return sql`array_position(array[${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )}]::uuid[], ${column})`;
  }

  private orderExpression(field: FieldDef): SQL[] {
    const { meta } = this.context;
    if (field.custom) {
      const value = this.customText(field.custom.id);
      switch (field.custom.type) {
        case 'number':
          return [sql`${value}::numeric`];
        case 'date':
          return [sql`${value}::date`];
        case 'datetime':
          return [sql`${value}::timestamptz`];
        case 'checkbox':
          return [this.hasValue(field.custom.id)];
        default:
          return [sql`lower(${value})`];
      }
    }
    switch (field.id) {
      case 'project':
        return [sql`split_part(${issues.key}, '-', 1)`];
      case 'issuetype':
        return [
          this.byPosition(
            issues.issueTypeId,
            meta.issueTypes.map((type) => type.id),
          ),
        ];
      case 'status':
        return [
          this.byPosition(
            issues.statusId,
            [...meta.statuses]
              .sort(
                (a, b) =>
                  CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] ||
                  a.name.localeCompare(b.name),
              )
              .map((status) => status.id),
          ),
        ];
      case 'priority':
        return [
          this.byPosition(
            issues.priorityId,
            meta.priorities.map((priority) => priority.id),
          ),
        ];
      case 'resolution':
        return [
          this.byPosition(
            issues.resolutionId,
            [...meta.resolutions]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((entry) => entry.id),
          ),
        ];
      case 'assignee':
        return [sql`(select u.display_name from users u where u.id = ${issues.assigneeId})`];
      case 'reporter':
        return [sql`(select u.display_name from users u where u.id = ${issues.reporterId})`];
      case 'summary':
        return [sql`lower(${issues.summary})`];
      case 'storyPoints':
        return [sql`${issues.storyPoints}`];
      case 'startDate':
        return [sql`${issues.startDate}`];
      case 'due':
        return [sql`${issues.dueDate}`];
      case 'created':
        return [sql`${issues.createdAt}`];
      case 'updated':
        return [sql`${issues.updatedAt}`];
      case 'resolved':
        return [sql`${issues.resolvedAt}`];
      case 'key':
        return [sql`split_part(${issues.key}, '-', 1)`, sql`${issues.number}`];
      case 'rank':
        return [sql`${issues.rank}`];
      case 'originalEstimate':
        return [sql`${issues.originalEstimateSeconds}`];
      case 'remainingEstimate':
        return [sql`${issues.remainingEstimateSeconds}`];
      case 'timeSpent':
        return [sql`${issues.timeSpentSeconds}`];
      default:
        return [];
    }
  }

  private orderBy(query: Query): SQL[] {
    if (query.orderBy.length === 0) return [desc(issues.createdAt), desc(issues.id)];
    const terms = query.orderBy.flatMap((item) =>
      this.orderExpression(item.field).map((expression) =>
        // Columns that are never empty sort without NULLS LAST, so an index matches the order
        // (TL-44, E-125): newest of a million issues in 1 ms instead of sorting them all.
        NEVER_EMPTY.has(item.field.id)
          ? sql`${expression} ${sql.raw(item.direction)}`
          : sql`${expression} ${sql.raw(item.direction)} nulls last`,
      ),
    );
    // A stable tie-breaker keeps pages from overlapping; in the direction of the last term,
    // so the index (…, id) serves it read forwards or backwards.
    const last = query.orderBy.at(-1)?.direction ?? 'asc';
    return [...terms, last === 'desc' ? desc(issues.id) : asc(issues.id)];
  }
}
