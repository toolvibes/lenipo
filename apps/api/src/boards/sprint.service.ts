import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  BacklogData,
  CompleteSprintRequest,
  CreateSprintRequest,
  EstimationField,
  IssueSummary,
  Sprint,
  StartSprintRequest,
  UpdateSprintRequest,
} from '@tasklore/shared';
import { and, asc, count, eq, getTableColumns, inArray, isNull, not, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle, Executor } from '../db/client.js';
import { boards, issues, sprintIssues, sprints } from '../db/schema/index.js';
import { emitProjectEvent } from '../notifications/events.js';
import { signal } from '../realtime/signals.js';
import { SearchService } from '../search/search.service.js';
import { recordChanges } from '../tracking/history.js';
import { IssueService } from '../tracking/issue.service.js';
import { securityVisible } from '../tracking/issue-security.js';
import { MetaService } from '../tracking/meta.service.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';
import { BoardService } from './board.service.js';

const { searchVector: _searchVector, ...issueColumns } = getTableColumns(issues);
const BACKLOG_LIMIT = 500;

type SprintRow = typeof sprints.$inferSelect;
type IssueRow = Omit<typeof issues.$inferSelect, 'searchVector'>;

function present(row: SprintRow): Sprint {
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

/** The value an issue adds to a sprint under the board's estimation (T-SPR-08). */
export function estimateOf(row: IssueRow, estimation: EstimationField): number | null {
  if (estimation === 'issueCount') return 1;
  if (estimation === 'originalEstimate') return row.originalEstimateSeconds;
  return row.storyPoints;
}

/** Sprints of Scrum boards and the backlog (T-SPR-01 to -03, -08, -10; E-55). */
@Injectable()
export class SprintService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(BoardService) private readonly boards: BoardService,
    @Inject(IssueService) private readonly issueService: IssueService,
    @Inject(SearchService) private readonly search: SearchService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(MetaService) private readonly meta: MetaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- loading

  /** A sprint and its board, with the right to plan in the board's project. */
  /** Tells automation rules of the board's project (TL-22, E-103). */
  private async emitSprint(
    tx: Executor,
    principal: Principal,
    boardId: string,
    type: 'sprint.started' | 'sprint.completed',
    sprint: SprintRow,
  ): Promise<void> {
    const [board] = await tx
      .select({ projectId: boards.projectId })
      .from(boards)
      .where(eq(boards.id, boardId));
    if (!board) return;
    await emitProjectEvent(tx, principal.userId, {
      type,
      projectId: board.projectId,
      sprintId: sprint.id,
      name: sprint.name,
    });
  }

  private async load(principal: Principal, sprintId: string, plan: boolean) {
    const [row] = await this.database.db.select().from(sprints).where(eq(sprints.id, sprintId));
    if (!row) throw new NotFoundException('Sprint not found');
    const board = await this.boards.get(principal, row.boardId);
    if (plan) await this.requirePlanning(principal, row.boardId);
    return { sprint: row, board };
  }

  /** Planning sprints needs `edit-issues` in the board's location project. */
  private async requirePlanning(principal: Principal, boardId: string) {
    const [board] = await this.database.db
      .select({ projectId: boards.projectId, type: boards.type })
      .from(boards)
      .where(eq(boards.id, boardId));
    if (!board) throw new NotFoundException('Board not found');
    if (board.type !== 'scrum') throw new BadRequestException('Only Scrum boards have sprints');
    await this.projectAccess.require(principal, board.projectId, 'edit-issues');
    return board;
  }

  async list(principal: Principal, boardId: string, state?: Sprint['state']): Promise<Sprint[]> {
    await this.boards.get(principal, boardId);
    const rows = await this.database.db
      .select()
      .from(sprints)
      .where(and(eq(sprints.boardId, boardId), state ? eq(sprints.state, state) : undefined))
      .orderBy(asc(sprints.createdAt));
    return rows.map(present);
  }

  /** The active sprint of a board, if one runs. */
  async active(boardId: string): Promise<Sprint | null> {
    const [row] = await this.database.db
      .select()
      .from(sprints)
      .where(and(eq(sprints.boardId, boardId), eq(sprints.state, 'active')));
    return row ? present(row) : null;
  }

  /** Ids of the issues currently in a sprint (open rows). */
  async memberIds(sprintId: string, db: Executor = this.database.db): Promise<string[]> {
    const rows = await db
      .select({ issueId: sprintIssues.issueId })
      .from(sprintIssues)
      .where(and(eq(sprintIssues.sprintId, sprintId), isNull(sprintIssues.removedAt)));
    return rows.map((row) => row.issueId);
  }

  // ---------------------------------------------------------------- planning

  async create(
    principal: Principal,
    boardId: string,
    request: CreateSprintRequest,
  ): Promise<Sprint> {
    await this.requirePlanning(principal, boardId);
    const board = await this.boards.get(principal, boardId);
    const [existing] = await this.database.db
      .select({ total: count() })
      .from(sprints)
      .where(eq(sprints.boardId, boardId));
    const id = uuidv7();
    const [row] = await this.database.db
      .insert(sprints)
      .values({
        id,
        boardId,
        name: request.name ?? `${board.name} Sprint ${(existing?.total ?? 0) + 1}`,
        goal: request.goal,
        startDate: request.startDate,
        endDate: request.endDate,
      })
      .returning();
    if (!row) throw new Error('Sprint insert returned no row');
    await signal(this.database.db, { type: 'board', boardId });
    return present(row);
  }

  async update(principal: Principal, sprintId: string, request: UpdateSprintRequest) {
    const { sprint } = await this.load(principal, sprintId, true);
    if (sprint.state === 'closed') throw new ConflictException('A closed sprint cannot change');
    const [row] = await this.database.db
      .update(sprints)
      .set(request)
      .where(eq(sprints.id, sprintId))
      .returning();
    await signal(this.database.db, { type: 'board', boardId: sprint.boardId });
    return present(row as SprintRow);
  }

  /** Only planned sprints can be deleted; their issues go back to the backlog. */
  async delete(principal: Principal, sprintId: string): Promise<void> {
    const { sprint } = await this.load(principal, sprintId, true);
    if (sprint.state !== 'future') {
      throw new ConflictException('Only planned sprints can be deleted');
    }
    const members = await this.memberIds(sprintId);
    await this.database.db.transaction(async (tx) => {
      for (const issueId of members) {
        await this.recordSprint(tx, principal, issueId, sprint.name, null);
      }
      await tx.delete(sprints).where(eq(sprints.id, sprintId));
      await signal(tx, { type: 'board', boardId: sprint.boardId });
    });
  }

  private async recordSprint(
    tx: Executor,
    principal: Principal,
    issueId: string,
    from: string | null,
    to: string | null,
  ) {
    if (from === to) return;
    await recordChanges(tx, issueId, principal, [
      { field: 'sprint', fromValue: from, toValue: to, fromDisplay: from, toDisplay: to },
    ]);
  }

  /** Moves issues into a sprint or (null) the backlog; each issue leaves its open sprint. */
  async moveIssues(principal: Principal, issueKeys: string[], sprintId: string | null) {
    let target: SprintRow | null = null;
    if (sprintId) {
      target = (await this.load(principal, sprintId, true)).sprint;
      if (target.state === 'closed') throw new ConflictException('The sprint is closed');
    }
    const loaded: IssueRow[] = [];
    for (const key of issueKeys) {
      loaded.push((await this.issueService.authorize(principal, key, 'edit-issues')).issue);
    }
    const board = target
      ? await this.database.db.select().from(boards).where(eq(boards.id, target.boardId))
      : [];
    const estimation = board[0]?.estimation ?? 'storyPoints';
    await this.database.db.transaction(async (tx) => {
      for (const issue of loaded) {
        const [current] = await tx
          .select({ row: sprintIssues, sprint: sprints })
          .from(sprintIssues)
          .innerJoin(sprints, eq(sprints.id, sprintIssues.sprintId))
          .where(
            and(
              eq(sprintIssues.issueId, issue.id),
              isNull(sprintIssues.removedAt),
              not(eq(sprints.state, 'closed')),
            ),
          );
        if (current?.sprint.id === target?.id) continue;
        if (current) {
          await tx
            .update(sprintIssues)
            .set({ removedAt: sql`now()` })
            .where(eq(sprintIssues.id, current.row.id));
        }
        if (target) {
          const running = target.state === 'active';
          await tx.insert(sprintIssues).values({
            id: uuidv7(),
            sprintId: target.id,
            issueId: issue.id,
            addedAfterStart: running,
            estimateAtStart: running ? estimateOf(issue, estimation) : null,
          });
        }
        await this.recordSprint(
          tx,
          principal,
          issue.id,
          current?.sprint.name ?? null,
          target?.name ?? null,
        );
      }
    });
  }

  async start(
    principal: Principal,
    sprintId: string,
    request: StartSprintRequest,
  ): Promise<Sprint> {
    const { sprint, board } = await this.load(principal, sprintId, true);
    if (sprint.state !== 'future') throw new ConflictException('This sprint is not planned');
    if (await this.active(board.id)) {
      throw new ConflictException('Another sprint of this board is running');
    }
    const members = await this.database.db
      .select({ row: sprintIssues, issue: issueColumns })
      .from(sprintIssues)
      .innerJoin(issues, eq(issues.id, sprintIssues.issueId))
      .where(and(eq(sprintIssues.sprintId, sprintId), isNull(sprintIssues.removedAt)));
    const [row] = await this.database.db.transaction(async (tx) => {
      // What the team committed to, for velocity and the sprint report.
      for (const member of members) {
        await tx
          .update(sprintIssues)
          .set({ estimateAtStart: estimateOf(member.issue, board.estimation) })
          .where(eq(sprintIssues.id, member.row.id));
      }
      await this.emitSprint(tx, principal, board.id, 'sprint.started', sprint);
      return tx
        .update(sprints)
        .set({
          state: 'active',
          startDate: request.startDate,
          endDate: request.endDate,
          ...(request.goal !== undefined ? { goal: request.goal } : {}),
          startedAt: sql`now()`,
          estimation: board.estimation,
        })
        .where(eq(sprints.id, sprintId))
        .returning();
    });
    await signal(this.database.db, { type: 'board', boardId: board.id });
    await this.audit.record({
      action: 'sprint.started',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'sprint',
      targetId: sprintId,
    });
    return present(row as SprintRow);
  }

  /**
   * Closes the active sprint. Every member keeps its row with `completed`; unfinished issues
   * also go to the backlog, a new sprint or a planned one (T-SPR-03).
   */
  async complete(
    principal: Principal,
    sprintId: string,
    request: CompleteSprintRequest,
  ): Promise<Sprint> {
    const { sprint, board } = await this.load(principal, sprintId, true);
    if (sprint.state !== 'active') throw new ConflictException('This sprint is not running');
    let target: SprintRow | null = null;
    if (request.moveTo === 'new') {
      const created = await this.create(principal, board.id, {
        goal: '',
        startDate: null,
        endDate: null,
      });
      [target = null] = await this.database.db
        .select()
        .from(sprints)
        .where(eq(sprints.id, created.id));
    } else if (request.moveTo !== 'backlog') {
      [target = null] = await this.database.db
        .select()
        .from(sprints)
        .where(and(eq(sprints.id, request.moveTo), eq(sprints.boardId, board.id)));
      if (target?.state !== 'future') {
        throw new BadRequestException('Unfinished issues can go to a planned sprint only');
      }
    }
    const meta = await this.meta.load();
    const done = new Set(
      meta.statuses.filter((status) => status.category === 'done').map((status) => status.id),
    );
    const estimation = sprint.estimation ?? board.estimation;
    const members = await this.database.db
      .select({ row: sprintIssues, issue: issueColumns })
      .from(sprintIssues)
      .innerJoin(issues, eq(issues.id, sprintIssues.issueId))
      .where(and(eq(sprintIssues.sprintId, sprintId), isNull(sprintIssues.removedAt)));
    const [row] = await this.database.db.transaction(async (tx) => {
      for (const member of members) {
        const finished = done.has(member.issue.statusId);
        await tx
          .update(sprintIssues)
          .set({
            completed: finished,
            estimateAtCompletion: estimateOf(member.issue, estimation),
          })
          .where(eq(sprintIssues.id, member.row.id));
        if (!finished && target) {
          await tx.insert(sprintIssues).values({
            id: uuidv7(),
            sprintId: target.id,
            issueId: member.issue.id,
          });
        }
        if (!finished) {
          await this.recordSprint(
            tx,
            principal,
            member.issue.id,
            sprint.name,
            target?.name ?? null,
          );
        }
      }
      await this.emitSprint(tx, principal, board.id, 'sprint.completed', sprint);
      return tx
        .update(sprints)
        .set({ state: 'closed', completedAt: sql`now()` })
        .where(eq(sprints.id, sprintId))
        .returning();
    });
    await signal(this.database.db, { type: 'board', boardId: board.id });
    await this.audit.record({
      action: 'sprint.completed',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'sprint',
      targetId: sprintId,
      details: { moveTo: target?.id ?? 'backlog' },
    });
    return present(row as SprintRow);
  }

  // ---------------------------------------------------------------- backlog

  /** Open sprints with their issues, then the backlog: not done, no epic, in no open sprint (T-SPR-01). */
  async backlog(principal: Principal, boardId: string): Promise<BacklogData> {
    const board = await this.boards.get(principal, boardId);
    if (board.type !== 'scrum') throw new BadRequestException('Only Scrum boards have a backlog');
    const compiled = await this.boards.scopeOf(principal, board.query);
    const open = await this.database.db
      .select()
      .from(sprints)
      .where(and(eq(sprints.boardId, boardId), not(eq(sprints.state, 'closed'))))
      .orderBy(sql`${sprints.state} = 'active' desc`, asc(sprints.createdAt));
    const visible = await this.search.compile(principal, '');
    const sprintSections = [];
    for (const sprint of open) {
      const ids = await this.memberIds(sprint.id);
      const rows =
        ids.length > 0 && visible.projectIds.length > 0
          ? await this.database.db
              .select(issueColumns)
              .from(issues)
              .where(
                and(
                  inArray(issues.id, ids),
                  inArray(issues.projectId, visible.projectIds),
                  isNull(issues.deletedAt),
                  securityVisible(principal.userId),
                ),
              )
              .orderBy(asc(issues.rank), asc(issues.id))
          : [];
      sprintSections.push({
        sprint: present(sprint),
        issues: await this.issueService.summarize(principal.userId, rows),
      });
    }
    let backlog: IssueSummary[] = [];
    let truncated = false;
    if (compiled.projectIds.length > 0) {
      const meta = await this.meta.load();
      const done = meta.statuses
        .filter((status) => status.category === 'done')
        .map((status) => status.id);
      // Epics are planned through their stories; the epic panel names them (TL-55).
      const epicTypes = meta.issueTypes
        .filter((type) => type.hierarchyLevel >= 1)
        .map((type) => type.id);
      const rows = await this.database.db
        .select(issueColumns)
        .from(issues)
        .where(
          and(
            inArray(issues.projectId, compiled.projectIds),
            isNull(issues.deletedAt),
            compiled.where,
            done.length > 0 ? not(inArray(issues.statusId, done)) : undefined,
            epicTypes.length > 0 ? not(inArray(issues.issueTypeId, epicTypes)) : undefined,
            sql`not exists (select 1 from ${sprintIssues} si join ${sprints} s on s.id = si.sprint_id
              where si.issue_id = ${issues.id} and si.removed_at is null and s.state <> 'closed')`,
          ),
        )
        .orderBy(asc(issues.rank), asc(issues.id))
        .limit(BACKLOG_LIMIT + 1);
      truncated = rows.length > BACKLOG_LIMIT;
      backlog = await this.issueService.summarize(principal.userId, rows.slice(0, BACKLOG_LIMIT));
    }
    return { board, sprints: sprintSections, backlog, truncated };
  }
}
