import { Inject, Injectable } from '@nestjs/common';
import type {
  AverageAge,
  ControlChart,
  FieldSeries,
  FieldSeriesRequest,
  PeriodRequest,
  ScopeProgress,
  ScopeProgressRequest,
  SeriesField,
  TimePivot,
  TimePivotRequest,
  TimeReport,
  TimeReportRequest,
} from '@toolvibes/shared';
import { and, asc, desc, eq, gte, inArray, isNotNull, lt, type SQL, sql } from 'drizzle-orm';
import { BoardService } from '../boards/board.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  issueChangeGroups,
  issueChangeItems,
  issues,
  issueWorklogs,
  projects,
  sprints,
  users,
} from '../db/schema/index.js';
import { requireIssueScope } from '../search/search.service.js';
import { MetaService } from '../tracking/meta.service.js';
import { StatisticsService } from './statistics.service.js';

/** Reports rebuild the past from at most this many issues per request (E-102). */
const MAX_ISSUES = 5_000;
const DAY = 86_400_000;

/** The history field and current column behind a series field. */
const HISTORY: Record<Exclude<SeriesField, 'statusCategory'>, string> = {
  status: 'status',
  priority: 'priority',
  assignee: 'assignee',
  issueType: 'issuetype',
};

interface Change {
  at: number;
  from: string | null;
  to: string | null;
}

/** The value at a moment: the last change up to then, else the value before the next change. */
function valueAt(changes: Change[], at: number, current: string | null): string | null {
  let before: Change | undefined;
  for (const change of changes) {
    if (change.at <= at) before = change;
    else return before ? before.to : change.from;
  }
  return before ? before.to : current;
}

function spread(values: number[]) {
  if (values.length === 0) return { average: null, median: null, p85: null };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
  const round = (value: number | undefined) =>
    value === undefined ? null : Math.round(value * 10) / 10;
  return {
    average: round(values.reduce((sum, value) => sum + value, 0) / values.length),
    median: round(at(0.5)),
    p85: round(at(0.85)),
  };
}

/** The last `days` calendar days in a time zone, oldest first, with the end of each day. */
function daysIn(timeZone: string, days: number): { date: string; end: number }[] {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
  const result: { date: string; end: number }[] = [];
  const base = Date.parse(`${today}T00:00:00Z`);
  // The zone's offset today, close enough for the end of each day.
  const local = new Date(new Date().toLocaleString('en-US', { timeZone })).getTime();
  const offset =
    local - new Date(new Date().toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
  for (let index = days - 1; index >= 0; index--) {
    const start = base - index * DAY;
    result.push({
      date: new Date(start).toISOString().slice(0, 10),
      end: Math.min(Date.now(), start + DAY - offset - 1),
    });
  }
  return result;
}

/**
 * Time-based reports rebuilt on request from the change history (TL-21, E-102): cumulative
 * flow and fields over time, control chart, average age, release and epic progress, time
 * tracking. Every report sees only the issues the caller may see.
 */
@Injectable()
export class AnalysisService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(StatisticsService) private readonly statistics: StatisticsService,
    @Inject(MetaService) private readonly meta: MetaService,
    @Inject(BoardService) private readonly boards: BoardService,
  ) {}

  private async matching(principal: Principal, query: string, extra?: SQL) {
    requireIssueScope(principal);
    const scope = await this.statistics.scope(principal, query);
    if (!scope) return { timeZone: 'UTC', rows: [], truncated: false };
    const rows = await this.database.db
      .select({
        id: issues.id,
        key: issues.key,
        summary: issues.summary,
        createdAt: issues.createdAt,
        resolvedAt: issues.resolvedAt,
        statusId: issues.statusId,
        priorityId: issues.priorityId,
        assigneeId: issues.assigneeId,
        issueTypeId: issues.issueTypeId,
        resolutionId: issues.resolutionId,
        storyPoints: issues.storyPoints,
        originalEstimateSeconds: issues.originalEstimateSeconds,
        remainingEstimateSeconds: issues.remainingEstimateSeconds,
        timeSpentSeconds: issues.timeSpentSeconds,
        projectId: issues.projectId,
        parentId: issues.parentId,
      })
      .from(issues)
      .where(and(scope.where, extra))
      .orderBy(asc(issues.createdAt))
      .limit(MAX_ISSUES + 1);
    return {
      timeZone: scope.timeZone,
      rows: rows.slice(0, MAX_ISSUES),
      truncated: rows.length > MAX_ISSUES,
    };
  }

  /** Changes of one history field per issue, oldest first. */
  private async changes(issueIds: string[], field: string): Promise<Map<string, Change[]>> {
    const result = new Map<string, Change[]>();
    for (let index = 0; index < issueIds.length; index += 1_000) {
      const rows = await this.database.db
        .select({
          issueId: issueChangeGroups.issueId,
          at: issueChangeGroups.createdAt,
          from: issueChangeItems.fromValue,
          to: issueChangeItems.toValue,
        })
        .from(issueChangeItems)
        .innerJoin(issueChangeGroups, eq(issueChangeGroups.id, issueChangeItems.groupId))
        .where(
          and(
            eq(issueChangeItems.field, field),
            inArray(issueChangeGroups.issueId, issueIds.slice(index, index + 1_000)),
          ),
        )
        .orderBy(asc(issueChangeGroups.createdAt), asc(issueChangeItems.id));
      for (const row of rows) {
        const list = result.get(row.issueId) ?? [];
        list.push({ at: row.at.getTime(), from: row.from, to: row.to });
        result.set(row.issueId, list);
      }
    }
    return result;
  }

  async fieldSeries(principal: Principal, request: FieldSeriesRequest): Promise<FieldSeries> {
    const { timeZone, rows, truncated } = await this.matching(principal, request.query);
    const days = daysIn(timeZone, request.days);
    const meta = await this.meta.load();
    const field = request.field === 'statusCategory' ? 'status' : request.field;
    const history = await this.changes(
      rows.map((row) => row.id),
      HISTORY[field],
    );
    const counts = new Map<string | null, number[]>();
    for (const row of rows) {
      const created = row.createdAt.getTime();
      const current =
        field === 'status'
          ? row.statusId
          : field === 'priority'
            ? row.priorityId
            : field === 'assignee'
              ? row.assigneeId
              : row.issueTypeId;
      const own = history.get(row.id) ?? [];
      for (const [index, day] of days.entries()) {
        if (created > day.end) continue;
        let value = valueAt(own, day.end, current);
        if (request.field === 'statusCategory') {
          value = value ? (meta.status.get(value)?.category ?? null) : null;
        }
        const line = counts.get(value) ?? Array.from({ length: days.length }, () => 0);
        line[index] = (line[index] ?? 0) + 1;
        counts.set(value, line);
      }
    }
    // Statuses in workflow order (to do → done), others by size.
    const order = (key: string | null) => {
      if (request.field === 'statusCategory') {
        return ['todo', 'in_progress', 'done'].indexOf(key ?? '');
      }
      if (request.field === 'status' && key) {
        const category = meta.status.get(key)?.category;
        return ['todo', 'in_progress', 'done'].indexOf(category ?? 'todo');
      }
      return 0;
    };
    const keys = [...counts.keys()].sort(
      (a, b) =>
        order(a) - order(b) ||
        (counts.get(b)?.at(-1) ?? 0) - (counts.get(a)?.at(-1) ?? 0) ||
        String(a).localeCompare(String(b)),
    );
    const names = new Map<string, string>();
    if (request.field === 'assignee') {
      const ids = keys.filter((key): key is string => key !== null);
      if (ids.length > 0) {
        for (const user of await this.database.db
          .select({ id: users.id, name: users.displayName })
          .from(users)
          .where(inArray(users.id, ids))) {
          names.set(user.id, user.name);
        }
      }
    } else if (request.field !== 'statusCategory') {
      const index =
        request.field === 'status'
          ? meta.status
          : request.field === 'priority'
            ? meta.priority
            : meta.issueType;
      for (const [id, entry] of index) names.set(id, entry.name);
    }
    return {
      dates: days.map((day) => day.date),
      values: keys.map((key) => ({
        key,
        label: key === null ? '' : (names.get(key) ?? key),
        color: null,
      })),
      counts: keys.map((key) => counts.get(key) ?? []),
      truncated,
    };
  }

  async controlChart(principal: Principal, request: PeriodRequest): Promise<ControlChart> {
    const since = new Date(Date.now() - request.days * DAY);
    const { rows, truncated } = await this.matching(
      principal,
      request.query,
      and(isNotNull(issues.resolvedAt), gte(issues.resolvedAt, since)),
    );
    const meta = await this.meta.load();
    const history = await this.changes(
      rows.map((row) => row.id),
      'status',
    );
    const points = rows
      .filter((row) => row.resolvedAt)
      .map((row) => {
        const resolved = row.resolvedAt?.getTime() ?? 0;
        const started = (history.get(row.id) ?? []).find(
          (change) => change.to !== null && meta.status.get(change.to)?.category === 'in_progress',
        );
        const days = (from: number) => Math.round(((resolved - from) / DAY) * 100) / 100;
        return {
          key: row.key,
          summary: row.summary,
          resolvedAt: row.resolvedAt?.toISOString() ?? '',
          leadDays: days(row.createdAt.getTime()),
          cycleDays: started && started.at <= resolved ? days(started.at) : null,
        };
      })
      .sort((a, b) => a.resolvedAt.localeCompare(b.resolvedAt));
    return {
      points,
      lead: spread(points.map((point) => point.leadDays)),
      cycle: spread(points.flatMap((point) => (point.cycleDays === null ? [] : [point.cycleDays]))),
      truncated,
    };
  }

  async averageAge(principal: Principal, request: PeriodRequest): Promise<AverageAge> {
    const { timeZone, rows, truncated } = await this.matching(principal, request.query);
    const days = daysIn(timeZone, request.days);
    // Resolution changes tell when an issue was open; reopened issues count again.
    const history = await this.changes(
      rows.map((row) => row.id),
      'resolution',
    );
    return {
      points: days.map((day) => {
        let open = 0;
        let age = 0;
        for (const row of rows) {
          const created = row.createdAt.getTime();
          if (created > day.end) continue;
          if (valueAt(history.get(row.id) ?? [], day.end, row.resolutionId) !== null) continue;
          open++;
          age += (day.end - created) / DAY;
        }
        return {
          date: day.date,
          open,
          averageDays: open === 0 ? 0 : Math.round((age / open) * 10) / 10,
        };
      }),
      truncated,
    };
  }

  /**
   * Scope and done work of a release or epic at the end of each closed sprint of a board.
   * Scope counts today's issues of the query from their creation; done means resolved.
   */
  async scopeProgress(principal: Principal, request: ScopeProgressRequest): Promise<ScopeProgress> {
    const board = await this.boards.get(principal, request.boardId);
    const { rows } = await this.matching(principal, request.query);
    const closed = (
      await this.database.db
        .select({ name: sprints.name, completedAt: sprints.completedAt })
        .from(sprints)
        .where(
          and(
            eq(sprints.boardId, request.boardId),
            eq(sprints.state, 'closed'),
            isNotNull(sprints.completedAt),
          ),
        )
        .orderBy(desc(sprints.completedAt))
        .limit(20)
    ).reverse();
    const estimate = (row: (typeof rows)[number]) =>
      board.estimation === 'storyPoints'
        ? (row.storyPoints ?? 0)
        : board.estimation === 'originalEstimate'
          ? (row.originalEstimateSeconds ?? 0)
          : 1;
    const at = (moment: number) => {
      let scope = 0;
      let done = 0;
      for (const row of rows) {
        if (row.createdAt.getTime() > moment) continue;
        scope += estimate(row);
        if (row.resolvedAt && row.resolvedAt.getTime() <= moment) done += estimate(row);
      }
      return { scope, done };
    };
    let previous = 0;
    let previousDone = 0;
    const perSprint = closed.map((sprint) => {
      const value = at(sprint.completedAt?.getTime() ?? 0);
      const entry = {
        name: sprint.name,
        completedAt: sprint.completedAt?.toISOString() ?? '',
        scope: value.scope,
        added: value.scope - previous,
        done: value.done,
        remaining: value.scope - value.done,
        completed: value.done - previousDone,
      };
      previous = value.scope;
      previousDone = value.done;
      return entry;
    });
    const now = at(Date.now());
    const recent = perSprint.slice(-3);
    const velocity =
      recent.length === 0
        ? 0
        : recent.reduce((sum, sprint) => sum + sprint.completed, 0) / recent.length;
    const remaining = now.scope - now.done;
    return {
      estimation: board.estimation,
      sprints: perSprint.map(({ completed: _completed, ...sprint }) => sprint),
      scope: now.scope,
      done: now.done,
      remaining,
      velocity: Math.round(velocity * 10) / 10,
      forecastSprints: velocity > 0 ? Math.ceil(remaining / velocity) : null,
    };
  }

  /** Logged time grouped by issue, project, person or epic, per day, week or month (TL-24). */
  async timePivot(principal: Principal, request: TimePivotRequest): Promise<TimePivot> {
    const { timeZone, rows } = await this.matching(principal, request.query);
    const empty = { columns: [], rows: [], totals: [], total: 0 };
    if (rows.length === 0) return empty;
    const local = sql`${issueWorklogs.startedAt} at time zone ${timeZone}`;
    const bucket =
      request.period === 'day'
        ? sql<string>`to_char(${local}, 'YYYY-MM-DD')`
        : request.period === 'week'
          ? sql<string>`to_char(date_trunc('week', ${local}), 'YYYY-MM-DD')`
          : request.period === 'month'
            ? sql<string>`to_char(date_trunc('month', ${local}), 'YYYY-MM-DD')`
            : sql<string>`'total'`;
    const logged = await this.database.db
      .select({
        bucket,
        issueId: issueWorklogs.issueId,
        authorId: issueWorklogs.authorId,
        seconds: sql<number>`sum(${issueWorklogs.timeSpentSeconds})::int`,
      })
      .from(issueWorklogs)
      .where(
        and(
          inArray(
            issueWorklogs.issueId,
            rows.map((row) => row.id),
          ),
          sql`(${local})::date >= ${request.from}::date`,
          sql`(${local})::date <= ${request.to}::date`,
        ),
      )
      // By position: the time zone is a parameter, so the expression would not match.
      .groupBy(sql`1`, sql`2`, sql`3`);
    const byIssue = new Map(rows.map((row) => [row.id, row]));
    const meta = await this.meta.load();
    const labels = new Map<string | null, string>();
    let groupOf: (entry: (typeof logged)[number]) => string | null;
    if (request.groupBy === 'issue') {
      for (const row of rows) labels.set(row.id, `${row.key} ${row.summary}`);
      groupOf = (entry) => entry.issueId;
    } else if (request.groupBy === 'project') {
      const ids = [...new Set(rows.map((row) => row.projectId))];
      for (const project of await this.database.db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(inArray(projects.id, ids))) {
        labels.set(project.id, project.name);
      }
      groupOf = (entry) => byIssue.get(entry.issueId)?.projectId ?? null;
    } else if (request.groupBy === 'person') {
      const ids = [...new Set(logged.flatMap((entry) => (entry.authorId ? [entry.authorId] : [])))];
      if (ids.length > 0) {
        for (const user of await this.database.db
          .select({ id: users.id, name: users.displayName })
          .from(users)
          .where(inArray(users.id, ids))) {
          labels.set(user.id, user.name);
        }
      }
      groupOf = (entry) => entry.authorId;
    } else {
      // The nearest ancestor of epic level (a subtask's story's epic, too).
      const ancestors = new Map<
        string,
        { id: string; key: string; summary: string; parentId: string | null; level: number }
      >();
      let pending = [...new Set(rows.flatMap((row) => (row.parentId ? [row.parentId] : [])))];
      for (let depth = 0; depth < 3 && pending.length > 0; depth++) {
        const found = await this.database.db
          .select({
            id: issues.id,
            key: issues.key,
            summary: issues.summary,
            parentId: issues.parentId,
            typeId: issues.issueTypeId,
          })
          .from(issues)
          .where(inArray(issues.id, pending));
        for (const entry of found) {
          ancestors.set(entry.id, {
            ...entry,
            level: meta.issueType.get(entry.typeId)?.hierarchyLevel ?? 0,
          });
        }
        pending = found.flatMap((entry) =>
          entry.parentId && !ancestors.has(entry.parentId) ? [entry.parentId] : [],
        );
      }
      const epicOf = (issueId: string): string | null => {
        const row = byIssue.get(issueId);
        if (row && (meta.issueType.get(row.issueTypeId)?.hierarchyLevel ?? 0) >= 1) return row.id;
        let parent = row?.parentId ?? null;
        for (let depth = 0; parent && depth < 3; depth++) {
          const ancestor = ancestors.get(parent);
          if (!ancestor) return null;
          if (ancestor.level >= 1) return ancestor.id;
          parent = ancestor.parentId;
        }
        return null;
      };
      for (const ancestor of ancestors.values()) {
        labels.set(ancestor.id, `${ancestor.key} ${ancestor.summary}`);
      }
      for (const row of rows) labels.set(row.id, `${row.key} ${row.summary}`);
      groupOf = (entry) => epicOf(entry.issueId);
    }
    const columns = [...new Set(logged.map((entry) => entry.bucket))].sort();
    const table = new Map<string | null, number[]>();
    for (const entry of logged) {
      const key = groupOf(entry);
      const line = table.get(key) ?? columns.map(() => 0);
      const index = columns.indexOf(entry.bucket);
      line[index] = (line[index] ?? 0) + entry.seconds;
      table.set(key, line);
    }
    const result = [...table.entries()]
      .map(([key, values]) => ({
        key,
        label: key === null ? '' : (labels.get(key) ?? key),
        values,
        total: values.reduce((sum, value) => sum + value, 0),
      }))
      .sort((a, b) => b.total - a.total);
    const totals = columns.map((_, index) =>
      result.reduce((sum, row) => sum + (row.values[index] ?? 0), 0),
    );
    return { columns, rows: result, totals, total: totals.reduce((sum, value) => sum + value, 0) };
  }

  async timeReport(principal: Principal, request: TimeReportRequest): Promise<TimeReport> {
    const { timeZone, rows, truncated } = await this.matching(principal, request.query);
    const ids = rows.map((row) => row.id);
    const logged =
      ids.length === 0
        ? []
        : await this.database.db
            .select({
              issueId: issueWorklogs.issueId,
              authorId: issueWorklogs.authorId,
              seconds: sql<number>`sum(${issueWorklogs.timeSpentSeconds})::int`,
            })
            .from(issueWorklogs)
            .where(
              and(
                inArray(issueWorklogs.issueId, ids),
                sql`(${issueWorklogs.startedAt} at time zone ${timeZone})::date >= ${request.from}::date`,
                lt(
                  sql`(${issueWorklogs.startedAt} at time zone ${timeZone})::date`,
                  sql`${request.to}::date + 1`,
                ),
              ),
            )
            .groupBy(issueWorklogs.issueId, issueWorklogs.authorId);
    const byIssue = new Map<string, number>();
    const byPerson = new Map<string | null, number>();
    for (const row of logged) {
      byIssue.set(row.issueId, (byIssue.get(row.issueId) ?? 0) + row.seconds);
      byPerson.set(row.authorId, (byPerson.get(row.authorId) ?? 0) + row.seconds);
    }
    const authorIds = [...byPerson.keys()].filter((id): id is string => id !== null);
    const names = new Map(
      (authorIds.length === 0
        ? []
        : await this.database.db
            .select({ id: users.id, displayName: users.displayName })
            .from(users)
            .where(inArray(users.id, authorIds))
      ).map((user) => [user.id, user]),
    );
    // Issues with any time: estimated, spent or logged in the period.
    const shown = rows.filter(
      (row) =>
        row.originalEstimateSeconds !== null ||
        row.timeSpentSeconds > 0 ||
        row.remainingEstimateSeconds !== null ||
        byIssue.has(row.id),
    );
    const list = shown.map((row) => ({
      key: row.key,
      summary: row.summary,
      originalEstimateSeconds: row.originalEstimateSeconds,
      timeSpentSeconds: row.timeSpentSeconds,
      remainingEstimateSeconds: row.remainingEstimateSeconds,
      loggedSeconds: byIssue.get(row.id) ?? 0,
    }));
    const sum = (pick: (entry: (typeof list)[number]) => number | null) =>
      list.reduce((total, entry) => total + (pick(entry) ?? 0), 0);
    return {
      issues: list,
      people: [...byPerson.entries()]
        .map(([id, seconds]) => ({
          user: id ? (names.get(id) ?? null) : null,
          loggedSeconds: seconds,
        }))
        .sort((a, b) => b.loggedSeconds - a.loggedSeconds),
      totals: {
        originalEstimateSeconds: sum((entry) => entry.originalEstimateSeconds),
        timeSpentSeconds: sum((entry) => entry.timeSpentSeconds),
        remainingEstimateSeconds: sum((entry) => entry.remainingEstimateSeconds),
        loggedSeconds: sum((entry) => entry.loggedSeconds),
      },
      truncated,
    };
  }
}
