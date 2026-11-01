import { Inject, Injectable } from '@nestjs/common';
import type {
  CreatedResolved,
  CreatedResolvedRequest,
  StatisticField,
  Statistics,
  StatisticsRequest,
  StatisticValue,
} from '@toolvibes/shared';
import { and, count, eq, gte, inArray, isNull, type SQL, sql } from 'drizzle-orm';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  issueComponents,
  issues,
  projectComponents,
  projects,
  statuses,
  users,
} from '../db/schema/index.js';
import { requireIssueScope, SearchService } from '../search/search.service.js';
import { MetaService } from '../tracking/meta.service.js';

const MAX_VALUES = 50;

/** The value of a field per issue as text; labels and components give one row per value. */
function keyOf(field: StatisticField): SQL<string | null> {
  switch (field) {
    case 'status':
      return sql`${issues.statusId}::text`;
    case 'statusCategory':
      return sql`${statuses.category}::text`;
    case 'priority':
      return sql`${issues.priorityId}::text`;
    case 'assignee':
      return sql`${issues.assigneeId}::text`;
    case 'reporter':
      return sql`${issues.reporterId}::text`;
    case 'issueType':
      return sql`${issues.issueTypeId}::text`;
    case 'project':
      return sql`${issues.projectId}::text`;
    case 'resolution':
      return sql`${issues.resolutionId}::text`;
    case 'component':
      return sql`${projectComponents.name}`;
    case 'label':
      return sql`unnest(case when cardinality(${issues.labels}) = 0 then array[null]::text[] else ${issues.labels} end)`;
  }
}

/**
 * Counts and series for dashboard gadgets and reports (TL-20, E-101), always over the issues
 * the caller may see: the TQL permission filter and issue security apply.
 */
@Injectable()
export class StatisticsService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(SearchService) private readonly search: SearchService,
    @Inject(MetaService) private readonly meta: MetaService,
  ) {}

  /** The visible, not deleted issues of a query, and the caller's time zone; null without projects. */
  async scope(principal: Principal, query: string) {
    const compiled = await this.search.compile(principal, query);
    if (compiled.projectIds.length === 0) return null;
    return {
      timeZone: compiled.timeZone,
      where: and(
        inArray(issues.projectId, compiled.projectIds),
        isNull(issues.deletedAt),
        compiled.where,
      ) as SQL,
    };
  }

  async statistics(principal: Principal, request: StatisticsRequest): Promise<Statistics> {
    requireIssueScope(principal);
    const fields = request.y ? [request.x, request.y] : [request.x];
    const scope = await this.scope(principal, request.query);
    if (!scope) return { total: 0, x: [], y: request.y ? [] : null, counts: [] };
    const db = this.database.db;
    let inner = db
      .select({
        id: issues.id,
        x: keyOf(request.x).as('x'),
        y: keyOf(request.y ?? request.x).as('y'),
      })
      .from(issues)
      .$dynamic();
    if (fields.includes('statusCategory')) {
      inner = inner.innerJoin(statuses, eq(statuses.id, issues.statusId));
    }
    if (fields.includes('component')) {
      inner = inner
        .leftJoin(issueComponents, eq(issueComponents.issueId, issues.id))
        .leftJoin(projectComponents, eq(projectComponents.id, issueComponents.componentId));
    }
    const rows = inner.where(scope.where).as('rows');
    const [grouped, [total]] = await Promise.all([
      db
        .select({ x: rows.x, y: rows.y, count: sql<number>`count(distinct ${rows.id})::int` })
        .from(rows)
        .groupBy(rows.x, rows.y),
      db.select({ total: count() }).from(issues).where(scope.where),
    ]);
    const totals = (axis: 'x' | 'y') => {
      const sums = new Map<string | null, number>();
      for (const row of grouped) sums.set(row[axis], (sums.get(row[axis]) ?? 0) + row.count);
      // Most frequent first, "none" last.
      return [...sums.entries()]
        .sort(([a, m], [b, n]) => (a === null ? 1 : b === null ? -1 : n - m))
        .slice(0, MAX_VALUES)
        .map(([key]) => key);
    };
    const xKeys = totals('x');
    const yKeys = request.y ? totals('y') : [null];
    const xIndex = new Map(xKeys.map((key, index) => [key, index]));
    const yIndex = new Map(yKeys.map((key, index) => [key, index]));
    const counts = xKeys.map(() => yKeys.map(() => 0));
    for (const row of grouped) {
      const i = xIndex.get(row.x);
      const j = request.y ? yIndex.get(row.y) : 0;
      if (i === undefined || j === undefined) continue;
      const line = counts[i] as number[];
      line[j] = (line[j] ?? 0) + row.count;
    }
    return {
      total: total?.total ?? 0,
      x: await this.values(request.x, xKeys),
      y: request.y ? await this.values(request.y, yKeys as (string | null)[]) : null,
      counts,
    };
  }

  /** Names for the counted keys; the web app names "none" and status categories itself. */
  private async values(field: StatisticField, keys: (string | null)[]): Promise<StatisticValue[]> {
    const ids = keys.filter((key): key is string => key !== null);
    const names = new Map<string, string>();
    if (field === 'assignee' || field === 'reporter') {
      if (ids.length > 0) {
        for (const user of await this.database.db
          .select({ id: users.id, name: users.displayName })
          .from(users)
          .where(inArray(users.id, ids))) {
          names.set(user.id, user.name);
        }
      }
    } else if (field === 'project') {
      if (ids.length > 0) {
        for (const project of await this.database.db
          .select({ id: projects.id, name: projects.name })
          .from(projects)
          .where(inArray(projects.id, ids))) {
          names.set(project.id, project.name);
        }
      }
    } else if (['status', 'priority', 'issueType', 'resolution'].includes(field)) {
      const meta = await this.meta.load();
      const index =
        field === 'status'
          ? meta.status
          : field === 'priority'
            ? meta.priority
            : field === 'issueType'
              ? meta.issueType
              : meta.resolution;
      for (const [id, entry] of index) names.set(id, entry.name);
    }
    return keys.map((key) => ({
      key,
      label: key === null ? '' : (names.get(key) ?? key),
      color: null,
    }));
  }

  /** Issues created and resolved per day over the last days, in the caller's time zone. */
  async createdResolved(
    principal: Principal,
    request: CreatedResolvedRequest,
  ): Promise<CreatedResolved> {
    requireIssueScope(principal);
    const scope = await this.scope(principal, request.query);
    const timeZone = scope?.timeZone ?? 'UTC';
    const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
    const dates: string[] = [];
    const start = new Date(`${today}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - (request.days - 1));
    for (let day = 0; day < request.days; day++) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + day);
      dates.push(date.toISOString().slice(0, 10));
    }
    if (!scope) return { points: dates.map((date) => ({ date, created: 0, resolved: 0 })) };
    // A day before the window in UTC covers every time zone; the dates themselves filter exactly.
    const since = new Date(start);
    since.setUTCDate(since.getUTCDate() - 1);
    const perDay = (column: typeof issues.createdAt | typeof issues.resolvedAt) => {
      const day = sql<string>`to_char(${column} at time zone ${timeZone}, 'YYYY-MM-DD')`;
      return (
        this.database.db
          .select({ day, count: count() })
          .from(issues)
          .where(and(scope.where, gte(column, since)))
          // By position: the time zone is a parameter, so the expression would not match.
          .groupBy(sql`1`)
      );
    };
    const [created, resolved] = await Promise.all([
      perDay(issues.createdAt),
      perDay(issues.resolvedAt),
    ]);
    const createdBy = new Map(created.map((row) => [row.day, row.count]));
    const resolvedBy = new Map(resolved.map((row) => [row.day, row.count]));
    return {
      points: dates.map((date) => ({
        date,
        created: createdBy.get(date) ?? 0,
        resolved: resolvedBy.get(date) ?? 0,
      })),
    };
  }
}
