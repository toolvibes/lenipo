import {
  type Clause,
  type DateValue,
  type Duration,
  type Expression,
  type FieldDef,
  type FunctionOperand,
  type Operand,
  type Operator,
  parseDateValue,
  parseIncrement,
  type Query,
  STATUS_CATEGORY_NAMES,
  type TimeUnit,
  type TqlError,
  tqlError,
  type ValueOperand,
} from '@tasklore/tql';
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
  sql,
} from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { Executor } from '../db/client.js';
import {
  groupMembers,
  groups,
  issueComments,
  issues,
  issueWatchers,
  users,
} from '../db/schema/index.js';
import type { MetaIndex } from '../tracking/meta.service.js';

export interface CompileContext {
  userId: string;
  /** IANA time zone of the searcher; date functions and date literals use it. */
  timeZone: string;
  meta: MetaIndex;
  /** Projects the searcher may browse; other projects do not exist for the query. */
  projects: ReadonlyArray<{ id: string; key: string; name: string }>;
}

export interface CompiledQuery {
  where: SQL | undefined;
  orderBy: SQL[];
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
export class TqlCompiler {
  readonly errors: TqlError[] = [];
  private usersByValue = new Map<string, string>();
  private groupsByValue = new Map<string, string>();

  constructor(
    private readonly db: Executor,
    private readonly context: CompileContext,
  ) {}

  async compile(query: Query): Promise<CompiledQuery> {
    await this.resolvePeople(query.where);
    const where = query.where ? this.expression(query.where) : undefined;
    return { where, orderBy: this.orderBy(query) };
  }

  // ---------------------------------------------------------------- people and groups

  /** Looks up every user and group named in the query in two queries. */
  private async resolvePeople(expression: Expression | null): Promise<void> {
    const userValues = new Set<string>();
    const groupValues = new Set<string>();
    const visit = (node: Expression): void => {
      if (node.kind === 'and' || node.kind === 'or') node.items.forEach(visit);
      else if (node.kind === 'not') visit(node.expression);
      else if (node.field.type === 'user') {
        for (const item of items(node.operand)) {
          if (item.kind === 'value') userValues.add(item.value.toLowerCase());
          else if (item.fn.name === 'membersOf' && item.args[0]) {
            groupValues.add(item.args[0].toLowerCase());
          }
        }
      }
    };
    if (expression) visit(expression);

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

  private user(clause: Clause): SQL {
    const column =
      clause.field.id === 'assignee'
        ? issues.assigneeId
        : clause.field.id === 'reporter'
          ? issues.reporterId
          : null;
    if (clause.operator === 'is' || clause.operator === 'is not') {
      if (!column) return sql`false`;
      return clause.operator === 'is' ? isNull(column) : isNotNull(column);
    }
    const ids: string[] = [];
    const groupIds: string[] = [];
    for (const item of items(clause.operand)) {
      if (item.kind === 'function') {
        if (item.fn.name === 'currentUser') ids.push(this.context.userId);
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
    const matchUser = (target: AnyPgColumn): SQL =>
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
    const inIssue = (weight: 'a' | 'b' | null) =>
      weight
        ? sql`(${issues.searchVector} @@ ${query} and ts_filter(${issues.searchVector}, ${`{${weight}}`}::"char"[]) @@ ${query})`
        : sql`${issues.searchVector} @@ ${query}`;
    const inComments = exists(
      this.db
        .select({ one: sql`1` })
        .from(issueComments)
        .where(
          and(
            eq(issueComments.issueId, issues.id),
            isNull(issueComments.deletedAt),
            sql`${issueComments.searchVector} @@ ${query}`,
          ),
        ),
    );
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
        match = or(inIssue(null), inComments) as SQL;
    }
    return clause.operator === '~' ? match : not(match);
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

  private number(clause: Clause): SQL {
    const column = issues.storyPoints;
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
    if (keys.length === 0) return sql`false`;
    if (clause.field.id === 'key') {
      const match = inArray(issues.key, keys);
      return positive(clause.operator) ? match : not(match);
    }
    // An alias, so the subquery does not shadow the outer issues table.
    const list = sql.join(
      keys.map((key) => sql`${key}`),
      sql`, `,
    );
    const match = sql`${issues.parentId} in (select p.id from issues p where p.key in (${list}))`;
    return positive(clause.operator) ? match : (and(isNotNull(issues.parentId), not(match)) as SQL);
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

  private date(clause: Clause): SQL {
    const column =
      clause.field.id === 'due'
        ? issues.dueDate
        : clause.field.id === 'created'
          ? issues.createdAt
          : clause.field.id === 'updated'
            ? issues.updatedAt
            : issues.resolvedAt;
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
      default:
        return [];
    }
  }

  private orderBy(query: Query): SQL[] {
    if (query.orderBy.length === 0) return [desc(issues.createdAt), desc(issues.id)];
    const terms = query.orderBy.flatMap((item) =>
      this.orderExpression(item.field).map((expression) =>
        item.direction === 'asc'
          ? sql`${expression} asc nulls last`
          : sql`${expression} desc nulls last`,
      ),
    );
    // A stable tie-breaker keeps pages from overlapping.
    return [...terms, asc(issues.id)];
  }
}
