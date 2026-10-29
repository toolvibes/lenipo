import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  Burndown,
  BurndownPoint,
  EstimationField,
  IssueSummary,
  Sprint,
  SprintReport,
  SprintReportEntry,
  Velocity,
} from '@tasklore/shared';
import { and, asc, desc, eq, getTableColumns, inArray, isNull } from 'drizzle-orm';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  issueChangeGroups,
  issueChangeItems,
  issues,
  sprintIssues,
  sprints,
} from '../db/schema/index.js';
import { SearchService } from '../search/search.service.js';
import { IssueService } from '../tracking/issue.service.js';
import { MetaService } from '../tracking/meta.service.js';
import { BoardService } from './board.service.js';

const { searchVector: _searchVector, ...issueColumns } = getTableColumns(issues);
const VELOCITY_SPRINTS = 7;
const FIELD_OF: Record<EstimationField, string | null> = {
  storyPoints: 'storyPoints',
  originalEstimate: 'originalEstimate',
  issueCount: null,
};

type SprintRow = typeof sprints.$inferSelect;
type MemberRow = typeof sprintIssues.$inferSelect;

interface Change {
  at: number;
  field: string;
  from: string | null;
  to: string | null;
}

function presentSprint(row: SprintRow): Sprint {
  return {
    id: row.id,
    boardId: row.boardId,
    name: row.name,
    goal: row.goal,
    state: row.state,
    startDate: row.startDate,
    endDate: row.endDate,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

/**
 * The value a field had at a moment, from the issue's change history: the last change up to
 * then, else the value before the first later change, else the current value.
 */
function valueAt(changes: Change[], field: string, at: number, current: string | null) {
  const own = changes.filter((change) => change.field === field);
  const before = own.filter((change) => change.at <= at).at(-1);
  if (before) return before.to;
  const after = own.find((change) => change.at > at);
  return after ? after.from : current;
}

/** Burndown, velocity and sprint report of Scrum boards (T-RPT-01 to -03, E-56). */
@Injectable()
export class ReportService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(BoardService) private readonly boards: BoardService,
    @Inject(IssueService) private readonly issueService: IssueService,
    @Inject(SearchService) private readonly search: SearchService,
    @Inject(MetaService) private readonly meta: MetaService,
  ) {}

  private async sprint(principal: Principal, sprintId: string) {
    const [row] = await this.database.db.select().from(sprints).where(eq(sprints.id, sprintId));
    if (!row) throw new NotFoundException('Sprint not found');
    const board = await this.boards.get(principal, row.boardId);
    return { row, board, estimation: row.estimation ?? board.estimation };
  }

  private async members(sprintId: string) {
    return this.database.db
      .select({ row: sprintIssues, issue: issueColumns })
      .from(sprintIssues)
      .innerJoin(issues, eq(issues.id, sprintIssues.issueId))
      .where(and(eq(sprintIssues.sprintId, sprintId), isNull(issues.deletedAt)));
  }

  private async doneStatuses(): Promise<Set<string>> {
    const meta = await this.meta.load();
    return new Set(
      meta.statuses.filter((status) => status.category === 'done').map((status) => status.id),
    );
  }

  // ---------------------------------------------------------------- burndown

  async burndown(principal: Principal, sprintId: string): Promise<Burndown> {
    const { row: sprint, estimation } = await this.sprint(principal, sprintId);
    if (!sprint.startedAt) throw new BadRequestException('The sprint has not started');
    const start = sprint.startedAt.getTime();
    const end = (sprint.completedAt ?? new Date()).getTime();
    const members = await this.members(sprintId);
    const done = await this.doneStatuses();
    const issueIds = [...new Set(members.map((member) => member.issue.id))];
    const field = FIELD_OF[estimation];
    const fields = ['status', ...(field ? [field] : [])];
    const history =
      issueIds.length > 0
        ? await this.database.db
            .select({
              issueId: issueChangeGroups.issueId,
              at: issueChangeGroups.createdAt,
              field: issueChangeItems.field,
              from: issueChangeItems.fromValue,
              to: issueChangeItems.toValue,
            })
            .from(issueChangeItems)
            .innerJoin(issueChangeGroups, eq(issueChangeGroups.id, issueChangeItems.groupId))
            .where(
              and(
                inArray(issueChangeGroups.issueId, issueIds),
                inArray(issueChangeItems.field, fields),
              ),
            )
            .orderBy(asc(issueChangeGroups.createdAt), asc(issueChangeItems.id))
        : [];
    const changesOf = new Map<string, Change[]>();
    for (const entry of history) {
      const list = changesOf.get(entry.issueId) ?? [];
      list.push({ at: entry.at.getTime(), field: entry.field, from: entry.from, to: entry.to });
      changesOf.set(entry.issueId, list);
    }
    const issueOf = new Map(members.map((member) => [member.issue.id, member.issue]));
    const rowsOf = new Map<string, MemberRow[]>();
    for (const member of members) {
      rowsOf.set(member.issue.id, [...(rowsOf.get(member.issue.id) ?? []), member.row]);
    }

    const current = (issueId: string, name: string) => {
      const issue = issueOf.get(issueId);
      if (!issue) return null;
      if (name === 'status') return issue.statusId;
      if (name === 'storyPoints') return issue.storyPoints?.toString() ?? null;
      return issue.originalEstimateSeconds?.toString() ?? null;
    };
    const estimateAt = (issueId: string, at: number) => {
      if (!field) return 1;
      const value = valueAt(changesOf.get(issueId) ?? [], field, at, current(issueId, field));
      return value === null ? 0 : Number(value);
    };
    const doneAt = (issueId: string, at: number) =>
      done.has(
        valueAt(changesOf.get(issueId) ?? [], 'status', at, current(issueId, 'status')) ?? '',
      );
    const memberAt = (issueId: string, at: number) =>
      (rowsOf.get(issueId) ?? []).some(
        (row) => row.addedAt.getTime() <= at && (row.removedAt?.getTime() ?? Infinity) > at,
      );

    let remaining = 0;
    for (const issueId of issueIds) {
      if (memberAt(issueId, start) && !doneAt(issueId, start))
        remaining += estimateAt(issueId, start);
    }
    const committed = remaining;
    const events: Array<Omit<BurndownPoint, 'remaining'> & { time: number }> = [];
    const keyOf = (issueId: string) => issueOf.get(issueId)?.key ?? null;
    const push = (time: number, type: BurndownPoint['type'], issueId: string, delta: number) => {
      if (delta === 0 && type !== 'done' && type !== 'reopened') return;
      events.push({
        time,
        at: new Date(time).toISOString(),
        type,
        issueKey: keyOf(issueId),
        delta,
      });
    };

    for (const member of members) {
      const { row, issue } = member;
      const added = row.addedAt.getTime();
      if (added > start && added <= end) {
        push(added, 'added', issue.id, doneAt(issue.id, added) ? 0 : estimateAt(issue.id, added));
      }
      const removed = row.removedAt?.getTime();
      if (removed !== undefined && removed > start && removed <= end) {
        push(
          removed,
          'removed',
          issue.id,
          doneAt(issue.id, removed) ? 0 : -estimateAt(issue.id, removed),
        );
      }
    }
    for (const [issueId, changes] of changesOf) {
      for (const change of changes) {
        if (change.at <= start || change.at > end || !memberAt(issueId, change.at - 1)) continue;
        if (change.field === 'status') {
          const was = done.has(change.from ?? '');
          const is = done.has(change.to ?? '');
          if (was === is) continue;
          const value = estimateAt(issueId, change.at);
          push(change.at, is ? 'done' : 'reopened', issueId, is ? -value : value);
        } else if (!doneAt(issueId, change.at)) {
          push(change.at, 'estimate', issueId, Number(change.to ?? 0) - Number(change.from ?? 0));
        }
      }
    }
    events.sort((a, b) => a.time - b.time);

    const points: BurndownPoint[] = [
      {
        at: new Date(start).toISOString(),
        type: 'start',
        issueKey: null,
        delta: 0,
        remaining: committed,
      },
    ];
    for (const { time: _time, ...event } of events) {
      remaining += event.delta;
      points.push({ ...event, remaining });
    }
    if (!sprint.completedAt) {
      points.push({
        at: new Date(end).toISOString(),
        type: 'now',
        issueKey: null,
        delta: 0,
        remaining,
      });
    }
    return {
      sprint: presentSprint(sprint),
      estimation,
      committed,
      plannedEnd: sprint.endDate ? new Date(`${sprint.endDate}T23:59:59Z`).toISOString() : null,
      points,
    };
  }

  // ---------------------------------------------------------------- velocity

  /** Committed (at start) against completed (at close) for the last closed sprints. */
  async velocity(principal: Principal, boardId: string): Promise<Velocity> {
    const board = await this.boards.get(principal, boardId);
    const closed = await this.database.db
      .select()
      .from(sprints)
      .where(and(eq(sprints.boardId, boardId), eq(sprints.state, 'closed')))
      .orderBy(desc(sprints.completedAt))
      .limit(VELOCITY_SPRINTS);
    const ids = closed.map((sprint) => sprint.id);
    const rows =
      ids.length > 0
        ? await this.database.db
            .select()
            .from(sprintIssues)
            .where(inArray(sprintIssues.sprintId, ids))
        : [];
    return {
      estimation: board.estimation,
      sprints: closed.reverse().map((sprint) => {
        const own = rows.filter((row) => row.sprintId === sprint.id);
        const committed = own
          .filter((row) => !row.addedAfterStart)
          .reduce((sum, row) => sum + (row.estimateAtStart ?? 0), 0);
        const completed = own
          .filter((row) => row.completed && !row.removedAt)
          .reduce((sum, row) => sum + (row.estimateAtCompletion ?? 0), 0);
        return { sprint: presentSprint(sprint), committed, completed };
      }),
    };
  }

  // ---------------------------------------------------------------- sprint report

  async report(principal: Principal, sprintId: string): Promise<SprintReport> {
    const { row: sprint, estimation } = await this.sprint(principal, sprintId);
    if (!sprint.startedAt) throw new BadRequestException('The sprint has not started');
    const members = await this.members(sprintId);
    const done = await this.doneStatuses();
    // Only issues the caller may see appear, like everywhere else.
    const visible = new Set((await this.search.compile(principal, '')).projectIds);
    const shown = members.filter((member) => visible.has(member.issue.projectId));
    const summaries = await this.issueService.summarize(
      principal.userId,
      shown.map((member) => member.issue),
    );
    const summaryOf = new Map(summaries.map((summary) => [summary.id, summary]));
    const field = FIELD_OF[estimation];
    const entry = (member: (typeof shown)[number]): SprintReportEntry => {
      const issue = summaryOf.get(member.issue.id) as IssueSummary;
      const now =
        field === null
          ? 1
          : field === 'storyPoints'
            ? member.issue.storyPoints
            : member.issue.originalEstimateSeconds;
      return {
        issue,
        estimate: member.row.estimateAtCompletion ?? now,
        addedAfterStart: member.row.addedAfterStart,
      };
    };
    const startedAt = sprint.startedAt.getTime();
    const inSprint = shown.filter((member) => !member.row.removedAt);
    const finished = (member: (typeof shown)[number]) =>
      member.row.completed ?? done.has(member.issue.statusId);
    return {
      sprint: presentSprint(sprint),
      estimation,
      completed: inSprint.filter(finished).map(entry),
      notCompleted: inSprint.filter((member) => !finished(member)).map(entry),
      removed: shown
        .filter((member) => member.row.removedAt && member.row.removedAt.getTime() >= startedAt)
        .map(entry),
    };
  }
}
