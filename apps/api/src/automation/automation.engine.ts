import { timingSafeEqual } from 'node:crypto';
import {
  Inject,
  Injectable,
  NotFoundException,
  type OnApplicationBootstrap,
  UnauthorizedException,
} from '@nestjs/common';
import { markdownToDoc } from '@tasklore/editor';
import {
  AUTOMATION_ACTOR_ID,
  type AutomationAction,
  type AutomationComponent,
  type AutomationCondition,
  AutomationRuleInput,
  type AutomationRunLine,
  type AutomationRunStatus,
  type AutomationTrigger,
  type Issue,
  type RichText,
  type UpdateIssueRequest,
} from '@tasklore/shared';
import { and, asc, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { AppConfig } from '../core/config.js';
import type { Principal } from '../core/http/principal.js';
import type { Logger } from '../core/logger.js';
import { CONFIG, DATABASE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle, Executor } from '../db/client.js';
import {
  automationQueue,
  automationRules,
  automationRuns,
  type domainEvents,
  groupMembers,
  groups,
  issues,
  issueWatchers,
  projects,
  users,
} from '../db/schema/index.js';
import { Mailer } from '../notifications/mailer.js';
import { SearchService } from '../search/search.service.js';
import { IssueService } from '../tracking/issue.service.js';
import { MetaService } from '../tracking/meta.service.js';
import { postJson } from '../webhooks/http.js';
import { PageService } from '../wiki/page.service.js';
import { automationContext } from './context.js';
import { cronMatches, parseCron } from './cron.js';
import { render } from './smart-values.js';

type EventRow = typeof domainEvents.$inferSelect;
type RuleRow = typeof automationRules.$inferSelect;
type QueueRow = typeof automationQueue.$inferSelect;

const MAX_DEPTH = 10;
const MAX_RUNS_PER_MINUTE = 100;
const MAX_BRANCH = 100;
const KEEP_RUNS_DAYS = 90;

/** The trigger types an outbox event can start, with a label for the audit log. */
function triggersOf(row: EventRow): { types: AutomationTrigger['type'][]; label: string } {
  switch (row.type) {
    case 'issue.created':
      return { types: ['issue-created'], label: 'Vorgang erstellt' };
    case 'issue.updated': {
      const payload = row.payload as { migration?: boolean };
      if (payload.migration) return { types: [], label: '' };
      return {
        types: ['issue-updated', 'issue-transitioned', 'field-changed'],
        label: 'Vorgang geändert',
      };
    }
    case 'issue.commented': {
      const payload = row.payload as { edited?: boolean };
      return payload.edited
        ? { types: [], label: '' }
        : { types: ['comment-added'], label: 'Kommentar hinzugefügt' };
    }
    case 'sprint.started':
      return { types: ['sprint-started'], label: 'Sprint gestartet' };
    case 'sprint.completed':
      return { types: ['sprint-completed'], label: 'Sprint abgeschlossen' };
    case 'version.released':
      return { types: ['version-released'], label: 'Version veröffentlicht' };
    default:
      return { types: [], label: '' };
  }
}

interface ChangedItem {
  field: string;
  fromDisplay: string | null;
  toDisplay: string | null;
}

function triggerMatches(trigger: AutomationTrigger, row: EventRow): boolean {
  const items = ((row.payload as { items?: ChangedItem[] }).items ?? []) as ChangedItem[];
  const same = (expected: string, actual: string | null) =>
    !expected.trim() || expected.trim().toLowerCase() === (actual ?? '').toLowerCase();
  switch (trigger.type) {
    case 'issue-transitioned': {
      const status = items.find((item) => item.field === 'status');
      return (
        !!status && same(trigger.from, status.fromDisplay) && same(trigger.to, status.toDisplay)
      );
    }
    case 'field-changed':
      return items.some((item) =>
        trigger.fields.some((field) => field.toLowerCase() === item.field.toLowerCase()),
      );
    default:
      return true;
  }
}

/** Splits a trailing ORDER BY so a query can be narrowed with AND. */
function narrow(query: string, scope: string | null): string {
  const order = /\border\s+by\b[\s\S]*$/i.exec(query);
  const where = (order ? query.slice(0, order.index) : query).trim();
  const parts = [scope, where ? `(${where})` : null].filter(Boolean);
  return `${parts.join(' AND ')}${order ? ` ${order[0]}` : ''}`.trim();
}

class RuleFailure extends Error {}

interface RunState {
  rule: RuleRow;
  /** Key of the rule's project; null for global rules. */
  scope: string | null;
  principal: Principal;
  issue: Issue | null;
  initiator: { id: string; displayName: string; email: string } | null;
  data: Record<string, unknown>;
  timeZone: string;
  log: AutomationRunLine[];
  acted: boolean;
}

/**
 * Runs automation rules (TL-22, E-103): the outbox worker queues matching rules per event,
 * schedules and incoming webhooks queue them too, and each queued run executes on its own as
 * the built-in actor, logged per rule. Chain depth, self-triggering and a rate limit stop loops.
 */
@Injectable()
export class AutomationEngine implements OnApplicationBootstrap {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(IssueService) private readonly issues: IssueService,
    @Inject(SearchService) private readonly search: SearchService,
    @Inject(PageService) private readonly pages: PageService,
    @Inject(MetaService) private readonly meta: MetaService,
    @Inject(Mailer) private readonly mailer: Mailer,
  ) {}

  /** The actor exists as a deactivated account: it shows in histories but never signs in. */
  async onApplicationBootstrap(): Promise<void> {
    await this.database.db
      .insert(users)
      .values({
        id: AUTOMATION_ACTOR_ID,
        email: 'automation@tasklore.invalid',
        displayName: 'Automatisierung',
        status: 'deactivated',
        onboardedAt: new Date(),
      })
      .onConflictDoNothing();
  }

  // ---------------------------------------------------------------- queueing

  /** Outbox consumer: queues the rules this event triggers, in the event's transaction. */
  async enqueue(tx: Executor, row: EventRow): Promise<void> {
    const { types, label } = triggersOf(row);
    if (types.length === 0) return;
    let projectId: string | null = null;
    if (row.issueId) {
      const [issue] = await tx
        .select({ projectId: issues.projectId, deletedAt: issues.deletedAt })
        .from(issues)
        .where(eq(issues.id, row.issueId));
      if (!issue || issue.deletedAt) return;
      projectId = issue.projectId;
    } else {
      projectId = (row.payload as { projectId?: string }).projectId ?? null;
    }
    if (!projectId) return;
    const rules = await tx
      .select()
      .from(automationRules)
      .where(
        and(
          eq(automationRules.enabled, true),
          or(isNull(automationRules.projectId), eq(automationRules.projectId, projectId)),
          inArray(sql`${automationRules.trigger}->>'type'`, types),
        ),
      );
    for (const rule of rules) {
      const trigger = rule.trigger as AutomationTrigger;
      if (!triggerMatches(trigger, row)) continue;
      // Its own changes do not start a rule again unless it says so (E-103).
      if (row.automationRuleId === rule.id && !rule.allowSelfTrigger) continue;
      const payload = row.payload as Record<string, unknown>;
      await tx.insert(automationQueue).values({
        ruleId: rule.id,
        issueId: row.issueId,
        initiatorId: row.actorId,
        depth: row.automationDepth + 1,
        trigger: label,
        data: row.type.startsWith('sprint.')
          ? { sprint: { id: payload.sprintId, name: payload.name } }
          : row.type === 'version.released'
            ? { version: { id: payload.versionId, name: payload.name } }
            : row.type === 'issue.commented'
              ? { comment: { body: payload.excerpt } }
              : {},
      });
    }
  }

  /** Scheduled rules whose cron matches this minute, once per minute (call every minute). */
  async tickSchedules(now = new Date()): Promise<void> {
    const minute = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
    const rules = await this.database.db
      .select({ rule: automationRules, timeZone: users.timeZone })
      .from(automationRules)
      .leftJoin(users, eq(users.id, automationRules.ownerId))
      .where(
        and(
          eq(automationRules.enabled, true),
          sql`${automationRules.trigger}->>'type' = 'schedule'`,
          or(isNull(automationRules.lastScheduledAt), lt(automationRules.lastScheduledAt, minute)),
        ),
      );
    for (const { rule, timeZone } of rules) {
      const trigger = rule.trigger as Extract<AutomationTrigger, { type: 'schedule' }>;
      const cron = parseCron(trigger.cron);
      if (!cron || !cronMatches(cron, minute, timeZone ?? 'Europe/Berlin')) continue;
      await this.database.db
        .update(automationRules)
        .set({ lastScheduledAt: minute })
        .where(eq(automationRules.id, rule.id));
      await this.queueFor(rule, trigger.query, 'Zeitplan', {});
    }
  }

  /** Queues a rule for the issues of a query (at most 100), or once without an issue. */
  private async queueFor(
    rule: RuleRow,
    query: string,
    label: string,
    data: Record<string, unknown>,
    initiatorId: string | null = null,
    keys?: string[],
  ): Promise<number> {
    const scope = await this.scopeKey(rule);
    const principal = this.principal(rule);
    let issueIds: (string | null)[] = [null];
    if (keys && keys.length > 0) {
      const found = await this.issues.lookup(principal, keys);
      const visible = found.filter((entry) => !scope || entry.key.startsWith(`${scope}-`));
      issueIds = await this.idsOf(visible.map((entry) => entry.key));
    } else if (query.trim()) {
      const result = await this.search.search(principal, {
        query: narrow(query, scope ? `project = ${scope}` : null),
        limit: MAX_BRANCH,
        offset: 0,
      });
      issueIds = result.issues.map((issue) => issue.id);
    }
    for (const issueId of issueIds) {
      await this.database.db
        .insert(automationQueue)
        .values({ ruleId: rule.id, issueId, initiatorId, depth: 1, trigger: label, data });
    }
    return issueIds.length;
  }

  private async idsOf(keys: string[]): Promise<string[]> {
    if (keys.length === 0) return [];
    const rows = await this.database.db
      .select({ id: issues.id })
      .from(issues)
      .where(inArray(issues.key, keys));
    return rows.map((row) => row.id);
  }

  /** An incoming webhook call: checks the secret, then queues the rule. */
  async incoming(ruleId: string, token: string, body: Record<string, unknown>): Promise<number> {
    const [rule] = await this.database.db
      .select()
      .from(automationRules)
      .where(eq(automationRules.id, ruleId));
    const trigger = rule?.trigger as AutomationTrigger | undefined;
    if (!rule || trigger?.type !== 'incoming-webhook' || !rule.webhookToken) {
      throw new NotFoundException('Rule not found');
    }
    const expected = Buffer.from(rule.webhookToken);
    const given = Buffer.from(token);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw new UnauthorizedException('Wrong token');
    }
    if (!rule.enabled) return 0;
    const keys = Array.isArray(body.issues)
      ? body.issues.filter((key): key is string => typeof key === 'string')
      : undefined;
    return this.queueFor(rule, '', 'Eingehender Webhook', { webhookData: body }, null, keys);
  }

  // ---------------------------------------------------------------- running

  /** Takes queued runs and executes them one after another; returns how many ran. */
  async runDue(limit = 20): Promise<number> {
    const items = await this.database.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(automationQueue)
        .orderBy(asc(automationQueue.id))
        .limit(limit)
        .for('update', { skipLocked: true });
      if (rows.length > 0) {
        await tx.delete(automationQueue).where(
          inArray(
            automationQueue.id,
            rows.map((row) => row.id),
          ),
        );
      }
      return rows;
    });
    for (const item of items) {
      try {
        await this.run(item);
      } catch (error) {
        this.logger.error({ err: error, rule: item.ruleId }, 'Automation run failed');
      }
    }
    return items.length;
  }

  /** Runs everything queued, including what the runs queue in turn through the outbox. */
  async drain(processEvents: () => Promise<void>): Promise<void> {
    for (let round = 0; round < 50; round++) {
      await processEvents();
      if ((await this.runDue()) === 0) return;
    }
  }

  private principal(rule: RuleRow): Principal {
    return { userId: AUTOMATION_ACTOR_ID, via: 'automation', ruleId: rule.id };
  }

  private async scopeKey(rule: RuleRow): Promise<string | null> {
    if (!rule.projectId) return null;
    const [project] = await this.database.db
      .select({ key: projects.key })
      .from(projects)
      .where(eq(projects.id, rule.projectId));
    return project?.key ?? '-';
  }

  private async record(
    rule: RuleRow,
    started: number,
    status: AutomationRunStatus,
    trigger: string,
    issueKey: string | null,
    log: AutomationRunLine[],
  ): Promise<void> {
    await this.database.db.insert(automationRuns).values({
      id: uuidv7(),
      ruleId: rule.id,
      startedAt: new Date(started),
      durationMs: Date.now() - started,
      status,
      trigger,
      issueKey,
      log,
    });
  }

  async run(item: QueueRow): Promise<void> {
    const started = Date.now();
    const [rule] = await this.database.db
      .select()
      .from(automationRules)
      .where(eq(automationRules.id, item.ruleId));
    if (!rule?.enabled) return;
    const parsed = AutomationRuleInput.shape.components.safeParse(rule.components);
    if (!parsed.success) {
      await this.record(rule, started, 'error', item.trigger, null, [
        { level: 'error', message: 'Die Regel ist ungültig gespeichert.' },
      ]);
      return;
    }
    if (item.depth > MAX_DEPTH) {
      await this.record(rule, started, 'loop', item.trigger, null, [
        {
          level: 'error',
          message: `Abgebrochen: Regeln haben sich ${MAX_DEPTH}-mal gegenseitig ausgelöst.`,
        },
      ]);
      return;
    }
    const [recent] = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(automationRuns)
      .where(
        and(
          eq(automationRuns.ruleId, rule.id),
          gte(automationRuns.startedAt, new Date(started - 60_000)),
        ),
      );
    if ((recent?.count ?? 0) >= MAX_RUNS_PER_MINUTE) {
      const reason = `Mehr als ${MAX_RUNS_PER_MINUTE} Ausführungen in einer Minute; die Regel wurde ausgeschaltet.`;
      await this.database.db
        .update(automationRules)
        .set({ enabled: false, disabledReason: reason })
        .where(eq(automationRules.id, rule.id));
      await this.record(rule, started, 'throttled', item.trigger, null, [
        { level: 'error', message: reason },
      ]);
      return;
    }

    const principal = this.principal(rule);
    const [owner] = rule.ownerId
      ? await this.database.db
          .select({ timeZone: users.timeZone })
          .from(users)
          .where(eq(users.id, rule.ownerId))
      : [];
    const [initiator] = item.initiatorId
      ? await this.database.db
          .select({ id: users.id, displayName: users.displayName, email: users.email })
          .from(users)
          .where(eq(users.id, item.initiatorId))
      : [];
    let issue: Issue | null = null;
    if (item.issueId) {
      const [row] = await this.database.db
        .select({ key: issues.key, deletedAt: issues.deletedAt })
        .from(issues)
        .where(eq(issues.id, item.issueId));
      if (!row || row.deletedAt) return;
      issue = await this.issues.get(principal, row.key);
    }
    const state: RunState = {
      rule,
      scope: await this.scopeKey(rule),
      principal,
      issue,
      initiator: initiator ?? null,
      data: item.data as Record<string, unknown>,
      timeZone: owner?.timeZone ?? 'Europe/Berlin',
      log: [],
      acted: false,
    };
    let failed = false;
    await automationContext.run({ ruleId: rule.id, depth: item.depth }, async () => {
      try {
        await this.runList(parsed.data, state);
      } catch (error) {
        failed = true;
        state.log.push({
          level: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });
    await this.record(
      rule,
      started,
      failed ? 'error' : state.acted ? 'success' : 'no-match',
      item.trigger,
      issue?.key ?? null,
      state.log,
    );
  }

  /** Runs components in order; false when a condition stopped the list. */
  private async runList(components: AutomationComponent[], state: RunState): Promise<boolean> {
    for (const component of components) {
      switch (component.type) {
        case 'tql':
        case 'compare':
        case 'user': {
          const ok = await this.check(component, state);
          state.log.push({
            level: 'info',
            message: `${this.describeCondition(component)}: ${ok ? 'erfüllt' : 'nicht erfüllt'}`,
          });
          if (!ok) return false;
          break;
        }
        case 'if': {
          const results: boolean[] = [];
          for (const condition of component.conditions) {
            results.push(await this.check(condition, state));
          }
          const ok = component.match === 'all' ? results.every(Boolean) : results.some(Boolean);
          state.log.push({ level: 'info', message: `Wenn: ${ok ? 'dann' : 'sonst'}` });
          await this.runList(ok ? component.onTrue : component.onFalse, state);
          break;
        }
        case 'branch': {
          const targets = await this.branchIssues(component, state);
          state.log.push({
            level: 'info',
            message: `Verzweigung (${component.over}): ${targets.length} Vorgänge`,
          });
          for (const target of targets) {
            await this.runList(component.components, { ...state, issue: target });
          }
          break;
        }
        default:
          await this.act(component, state);
          state.acted = true;
      }
    }
    return true;
  }

  private values(state: RunState): Record<string, unknown> {
    const issue = state.issue;
    return {
      now: new Date(),
      rule: { name: state.rule.name },
      initiator: state.initiator,
      issue: issue && {
        ...issue,
        url: `${(this.config.PUBLIC_URL ?? '').replace(/\/$/, '')}/issues/${issue.key}`,
        description: undefined,
      },
      ...state.data,
    };
  }

  private text(template: string, state: RunState): string {
    return render(template, { values: this.values(state), timeZone: state.timeZone });
  }

  private describeCondition(condition: AutomationCondition): string {
    switch (condition.type) {
      case 'tql':
        return `TQL ${condition.mode} „${condition.query}“`;
      case 'compare':
        return `Vergleich ${condition.left} ${condition.operator} ${condition.right}`;
      case 'user':
        return `Person ${condition.who} ${condition.check} ${condition.value}`;
    }
  }

  private async count(query: string, state: RunState): Promise<number> {
    const result = await this.search.search(state.principal, {
      query: narrow(query, state.scope ? `project = ${state.scope}` : null),
      limit: 1,
      offset: 0,
    });
    return result.total;
  }

  private async check(condition: AutomationCondition, state: RunState): Promise<boolean> {
    switch (condition.type) {
      case 'tql': {
        const query = this.text(condition.query, state);
        if (condition.mode === 'matches') {
          if (!state.issue) return false;
          return (await this.count(narrow(query, `key = ${state.issue.key}`), state)) > 0;
        }
        const found = await this.count(query, state);
        return condition.mode === 'some' ? found > 0 : found === 0;
      }
      case 'compare': {
        const left = this.text(condition.left, state).trim();
        const right = this.text(condition.right, state).trim();
        const a = left.toLowerCase();
        const b = right.toLowerCase();
        const numbers =
          left !== '' && right !== '' && !Number.isNaN(+left) && !Number.isNaN(+right);
        switch (condition.operator) {
          case 'equals':
            return a === b;
          case 'not-equals':
            return a !== b;
          case 'contains':
            return a.includes(b);
          case 'not-contains':
            return !a.includes(b);
          case 'empty':
            return a === '';
          case 'not-empty':
            return a !== '';
          case 'greater':
            return numbers ? +left > +right : left > right;
          case 'less':
            return numbers ? +left < +right : left < right;
        }
        return false;
      }
      case 'user': {
        const id =
          condition.who === 'initiator'
            ? (state.initiator?.id ?? null)
            : condition.who === 'assignee'
              ? (state.issue?.assignee?.id ?? null)
              : (state.issue?.reporter?.id ?? null);
        switch (condition.check) {
          case 'empty':
            return id === null;
          case 'not-empty':
            return id !== null;
          case 'is':
          case 'is-not': {
            const same = id !== null && id === condition.value.trim();
            return condition.check === 'is' ? same : !same;
          }
          case 'in-group':
          case 'not-in-group': {
            const [member] = id
              ? await this.database.db
                  .select({ userId: groupMembers.userId })
                  .from(groupMembers)
                  .innerJoin(groups, eq(groups.id, groupMembers.groupId))
                  .where(and(eq(groupMembers.userId, id), eq(groups.name, condition.value.trim())))
              : [];
            return condition.check === 'in-group' ? !!member : !member;
          }
        }
      }
    }
  }

  private inScope(state: RunState, key: string): boolean {
    return !state.scope || key.startsWith(`${state.scope}-`);
  }

  private async load(state: RunState, key: string): Promise<Issue | null> {
    if (!this.inScope(state, key)) {
      state.log.push({ level: 'info', message: `${key} liegt außerhalb des Projekts der Regel.` });
      return null;
    }
    return this.issues.get(state.principal, key).catch(() => null);
  }

  private async branchIssues(
    branch: Extract<AutomationComponent, { type: 'branch' }>,
    state: RunState,
  ): Promise<Issue[]> {
    let keys: string[] = [];
    if (branch.over === 'query') {
      const result = await this.search.search(state.principal, {
        query: narrow(
          this.text(branch.query, state),
          state.scope ? `project = ${state.scope}` : null,
        ),
        limit: MAX_BRANCH,
        offset: 0,
      });
      keys = result.issues.map((issue) => issue.key);
    } else if (state.issue) {
      keys =
        branch.over === 'subtasks'
          ? state.issue.children.map((child) => child.key)
          : branch.over === 'parent'
            ? state.issue.parent
              ? [state.issue.parent.key]
              : []
            : state.issue.links.map((link) => link.issue.key);
    }
    const loaded: Issue[] = [];
    for (const key of keys.slice(0, MAX_BRANCH)) {
      const issue = await this.load(state, key);
      if (issue) loaded.push(issue);
    }
    return loaded;
  }

  private need(state: RunState): Issue {
    if (!state.issue) throw new RuleFailure('Diese Aktion braucht einen Vorgang.');
    return state.issue;
  }

  private async refresh(state: RunState, issue: Issue): Promise<void> {
    state.issue = issue;
  }

  private async act(action: AutomationAction, state: RunState): Promise<void> {
    const { principal } = state;
    switch (action.type) {
      case 'set-field': {
        const issue = this.need(state);
        const value = this.text(action.value, state).trim();
        const request: UpdateIssueRequest = {};
        if (action.field === 'summary') request.summary = value;
        else if (action.field === 'description') request.description = { markdown: value };
        else if (action.field === 'priority') {
          const meta = await this.meta.load();
          const priority = meta.priorities.find(
            (entry) =>
              entry.key === value.toLowerCase() || entry.name.toLowerCase() === value.toLowerCase(),
          );
          if (!priority) throw new RuleFailure(`Unbekannte Priorität „${value}“.`);
          request.priority = priority.key;
        } else if (action.field === 'dueDate' || action.field === 'startDate') {
          if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            throw new RuleFailure(`„${value}“ ist kein Datum (JJJJ-MM-TT).`);
          }
          request[action.field] = value || null;
        } else if (action.field === 'storyPoints') {
          request.storyPoints = value === '' ? null : Number(value.replace(',', '.'));
        } else {
          const words = value.split(/[\s,]+/).filter(Boolean);
          const current = new Set(issue.labels);
          for (const word of words) {
            if (action.field === 'labels-add') current.add(word);
            else current.delete(word);
          }
          request.labels = [...current];
        }
        await this.refresh(state, await this.issues.update(principal, issue.key, request));
        state.log.push({ level: 'info', message: `${issue.key}: Feld ${action.field} gesetzt` });
        return;
      }
      case 'transition': {
        const issue = this.need(state);
        const target = this.text(action.to, state).trim().toLowerCase();
        if (issue.status.name.toLowerCase() === target) {
          state.log.push({ level: 'info', message: `${issue.key} ist schon in „${action.to}“.` });
          return;
        }
        const transitions = await this.issues.transitions(principal, issue.key);
        const transition = transitions.find((entry) => entry.to.name.toLowerCase() === target);
        if (!transition) {
          throw new RuleFailure(`${issue.key}: kein Übergang nach „${action.to}“.`);
        }
        await this.refresh(
          state,
          await this.issues.transition(principal, issue.key, {
            transitionId: transition.id,
            ...(transition.setsResolution ? { resolution: 'done' } : {}),
          }),
        );
        state.log.push({ level: 'info', message: `${issue.key} → ${transition.to.name}` });
        return;
      }
      case 'assign': {
        const issue = this.need(state);
        const assigneeId =
          action.to === 'initiator'
            ? (state.initiator?.id ?? null)
            : action.to === 'reporter'
              ? (issue.reporter?.id ?? null)
              : action.to === 'user'
                ? action.userId || null
                : null;
        await this.refresh(state, await this.issues.update(principal, issue.key, { assigneeId }));
        state.log.push({ level: 'info', message: `${issue.key} zugewiesen` });
        return;
      }
      case 'comment': {
        const issue = this.need(state);
        await this.issues.addComment(principal, issue.key, {
          body: { markdown: this.text(action.body, state) },
        });
        state.log.push({ level: 'info', message: `${issue.key}: kommentiert` });
        return;
      }
      case 'create-issue': {
        const projectKey =
          this.text(action.projectKey, state).trim().toUpperCase() ||
          state.issue?.project.key ||
          state.scope;
        if (!projectKey) throw new RuleFailure('Für den neuen Vorgang fehlt das Projekt.');
        if (state.scope && projectKey !== state.scope) {
          throw new RuleFailure('Projektregeln legen nur im eigenen Projekt Vorgänge an.');
        }
        const created = await this.issues.create(principal, {
          projectKey,
          issueType: action.issueType,
          summary: this.text(action.summary, state).slice(0, 255) || 'Neuer Vorgang',
          description: action.description
            ? { markdown: this.text(action.description, state) }
            : null,
          parentKey: action.subtask ? this.need(state).key : null,
          assigneeId: null,
          labels: [],
          storyPoints: null,
        } as never);
        state.log.push({ level: 'info', message: `${created.key} angelegt` });
        return;
      }
      case 'clone-issue': {
        const issue = this.need(state);
        const summary = this.text(action.summary, state).trim();
        const clone = await this.issues.clone(principal, issue.key, {
          ...(summary ? { summary } : {}),
          includeSubtasks: action.includeSubtasks,
        });
        state.log.push({ level: 'info', message: `${issue.key} geklont als ${clone.key}` });
        return;
      }
      case 'link': {
        const issue = this.need(state);
        const target = this.text(action.target, state).trim().toUpperCase();
        if (!this.inScope(state, target)) {
          throw new RuleFailure(`${target} liegt außerhalb des Projekts der Regel.`);
        }
        await this.issues.addLink(principal, issue.key, {
          type: action.linkType,
          direction: action.direction,
          issueKey: target,
        });
        state.log.push({ level: 'info', message: `${issue.key} verknüpft mit ${target}` });
        return;
      }
      case 'email': {
        const recipients = new Set<string>();
        const issue = state.issue;
        const ids: string[] = [];
        if (action.to.includes('assignee') && issue?.assignee) ids.push(issue.assignee.id);
        if (action.to.includes('reporter') && issue?.reporter) ids.push(issue.reporter.id);
        if (action.to.includes('initiator') && state.initiator) ids.push(state.initiator.id);
        if (action.to.includes('watchers') && issue) {
          const watchers = await this.database.db
            .select({ userId: issueWatchers.userId })
            .from(issueWatchers)
            .where(eq(issueWatchers.issueId, issue.id));
          ids.push(...watchers.map((watcher) => watcher.userId));
        }
        if (ids.length > 0) {
          const rows = await this.database.db
            .select({ email: users.email, status: users.status })
            .from(users)
            .where(inArray(users.id, ids));
          for (const row of rows) if (row.status === 'active') recipients.add(row.email);
        }
        for (const address of this.text(action.addresses, state).split(/[,;\s]+/)) {
          if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) recipients.add(address.toLowerCase());
        }
        const subject = this.text(action.subject, state).slice(0, 200);
        const body = this.text(action.body, state);
        const html = body
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>');
        for (const to of recipients) {
          await this.mailer.send({ to, subject, text: body, html: `<p>${html}</p>` });
        }
        state.log.push({ level: 'info', message: `E-Mail an ${recipients.size} Empfänger` });
        return;
      }
      case 'webhook': {
        const body = action.body.trim()
          ? this.text(action.body, state)
          : JSON.stringify({
              rule: { id: state.rule.id, name: state.rule.name },
              issue: state.issue
                ? {
                    key: state.issue.key,
                    summary: state.issue.summary,
                    status: state.issue.status.name,
                    project: state.issue.project.key,
                  }
                : null,
              ...state.data,
            });
        const result = await postJson(
          action.url,
          { 'content-type': 'application/json', 'user-agent': 'Tasklore-Automation' },
          body,
          { allowPrivate: this.config.WEBHOOK_ALLOW_PRIVATE_NETWORKS, timeoutMs: 10_000 },
        );
        if (result.status >= 400) {
          throw new RuleFailure(`Webhook antwortete mit ${result.status}.`);
        }
        state.log.push({ level: 'info', message: `Webhook aufgerufen (${result.status})` });
        return;
      }
      case 'create-page': {
        const title = this.text(action.title, state).trim().slice(0, 255) || 'Neue Seite';
        const content = markdownToDoc(this.text(action.content, state)) as RichText;
        const page = await this.pages.create(principal, action.spaceKey, {
          title,
          parentId: action.parentId || null,
        });
        await this.pages.publish(principal, page.id, {
          title,
          content,
          comment: `Automatisierung: ${state.rule.name}`,
        });
        state.log.push({ level: 'info', message: `Seite „${title}“ angelegt` });
        return;
      }
    }
  }

  /** Removes runs older than 90 days. */
  async cleanUp(): Promise<void> {
    await this.database.db
      .delete(automationRuns)
      .where(lt(automationRuns.startedAt, new Date(Date.now() - KEEP_RUNS_DAYS * 86_400_000)));
  }
}
