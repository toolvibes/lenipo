import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  Board,
  BoardData,
  BoardSummary,
  CreateBoardRequest,
  Issue,
  MoveCardRequest,
  UpdateBoardRequest,
} from '@toolvibes/shared';
import { parse } from '@toolvibes/tql';
import { and, asc, eq, getTableColumns, inArray, isNull, not, type SQL, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import { type DatabaseHandle, type Executor, isUniqueViolation } from '../db/client.js';
import {
  boardColumnStatuses,
  boardColumns,
  boardQuickFilters,
  boards,
  favourites,
  issues,
  projects,
  sprintIssues,
  sprints,
} from '../db/schema/index.js';
import { signal } from '../realtime/signals.js';
import { QueryException } from '../search/query-exception.js';
import { SearchService } from '../search/search.service.js';
import { CustomFieldService } from '../tracking/custom-field.service.js';
import { IssueService } from '../tracking/issue.service.js';
import { MetaService } from '../tracking/meta.service.js';
import { ProjectService } from '../tracking/project.service.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';

const { searchVector: _searchVector, ...issueColumns } = getTableColumns(issues);
const BOARD_LIMIT = 500;

/** Built-in quick filters (T-BRD-07). */
const BUILT_IN: Record<string, string> = {
  mine: 'assignee = currentUser()',
  recent: 'updated >= -1d',
};

type BoardRow = typeof boards.$inferSelect;

/** Boards over a TQL scope, located in a project (T-BRD-01 to -07, E-53). */
@Injectable()
export class BoardService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(IssueService) private readonly issueService: IssueService,
    @Inject(SearchService) private readonly search: SearchService,
    @Inject(CustomFieldService) private readonly customFields: CustomFieldService,
    @Inject(MetaService) private readonly meta: MetaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- reading

  /** Whether the caller starred the board (TL-6). */
  private starred(userId: string) {
    return sql<boolean>`exists (select 1 from ${favourites} where ${favourites.userId} = ${userId} and ${favourites.kind} = 'board' and ${favourites.targetId} = ${boards.id})`;
  }

  private async row(principal: Principal, id: string, permission: 'browse' | 'administer') {
    const [row] = await this.database.db
      .select({
        board: boards,
        project: { key: projects.key, name: projects.name },
        favourite: this.starred(principal.userId),
      })
      .from(boards)
      .innerJoin(projects, eq(projects.id, boards.projectId))
      .where(and(eq(boards.id, id), isNull(projects.archivedAt)));
    if (!row) throw new NotFoundException('Board not found');
    try {
      const permissions = await this.projectAccess.require(
        principal,
        row.board.projectId,
        'browse',
      );
      if (permission === 'administer' && !permissions.has('administer')) {
        throw new ForbiddenException('Only administrators of the board’s project configure it');
      }
      return { ...row, canConfigure: permissions.has('administer') };
    } catch (error) {
      // A board in a hidden project does not exist for the caller.
      if (error instanceof NotFoundException) throw new NotFoundException('Board not found');
      throw error;
    }
  }

  private async present(
    board: BoardRow,
    project: { key: string; name: string },
    canConfigure: boolean,
    favourite: boolean,
  ): Promise<Board> {
    const db = this.database.db;
    const [columns, mapping, quickFilters] = await Promise.all([
      db
        .select()
        .from(boardColumns)
        .where(eq(boardColumns.boardId, board.id))
        .orderBy(asc(boardColumns.position)),
      db
        .select()
        .from(boardColumnStatuses)
        .where(eq(boardColumnStatuses.boardId, board.id))
        .orderBy(asc(boardColumnStatuses.position)),
      db
        .select()
        .from(boardQuickFilters)
        .where(eq(boardQuickFilters.boardId, board.id))
        .orderBy(asc(boardQuickFilters.position)),
    ]);
    return {
      id: board.id,
      name: board.name,
      type: board.type,
      project,
      query: board.query,
      swimlanes: board.swimlanes,
      hideDoneAfterDays: board.hideDoneAfterDays,
      estimation: board.estimation,
      parallelSprints: board.parallelSprints,
      columns: columns.map((column) => ({
        id: column.id,
        name: column.name,
        statusIds: mapping
          .filter((entry) => entry.columnId === column.id)
          .map((entry) => entry.statusId),
        wipMin: column.wipMin,
        wipMax: column.wipMax,
      })),
      quickFilters: quickFilters.map(({ id, name, query }) => ({ id, name, query })),
      canConfigure,
      favourite,
    };
  }

  async list(principal: Principal, projectKey?: string): Promise<BoardSummary[]> {
    // Visibility only: the project list would also count every issue (TL-44, E-125).
    const visible = await this.database.db
      .select({ id: projects.id, key: projects.key })
      .from(projects)
      .where(await this.projectAccess.browsableCondition(principal.userId));
    const keys = projectKey
      ? visible.filter((project) => project.key === projectKey.toUpperCase())
      : visible;
    if (keys.length === 0) return [];
    const rows = await this.database.db
      .select({
        board: boards,
        project: { key: projects.key, name: projects.name },
        favourite: this.starred(principal.userId),
      })
      .from(boards)
      .innerJoin(projects, eq(projects.id, boards.projectId))
      .where(
        inArray(
          boards.projectId,
          keys.map((project) => project.id),
        ),
      )
      .orderBy(asc(projects.key), asc(sql`lower(${boards.name})`));
    return rows.map(({ board, project, favourite }) => ({
      id: board.id,
      name: board.name,
      type: board.type,
      project,
      favourite,
    }));
  }

  async get(principal: Principal, id: string): Promise<Board> {
    const { board, project, canConfigure, favourite } = await this.row(principal, id, 'browse');
    return this.present(board, project, canConfigure, favourite);
  }

  // ---------------------------------------------------------------- scope

  /** The conditions of a query without its ORDER BY; boards always sort by rank. */
  private async conditions(query: string): Promise<string> {
    const catalogue = await this.customFields.catalogue();
    const parsed = parse(query, catalogue);
    if (!parsed.query || parsed.errors.length > 0) throw new QueryException(parsed.errors);
    const span = parsed.query.orderSpan;
    return (span ? query.slice(0, span.start) + query.slice(span.end) : query).trim();
  }

  private async scope(principal: Principal, parts: string[]) {
    const conditions = (await Promise.all(parts.map((part) => this.conditions(part)))).filter(
      Boolean,
    );
    const text = conditions.map((part) => `(${part})`).join(' AND ');
    return this.search.compile(principal, text);
  }

  /** The compiled scope of a board query, e.g. for its backlog. */
  scopeOf(principal: Principal, query: string) {
    return this.scope(principal, [query]);
  }

  async issues(
    principal: Principal,
    id: string,
    filters: string[],
    sprintId?: string,
  ): Promise<BoardData> {
    const { board, project, canConfigure, favourite } = await this.row(principal, id, 'browse');
    const presented = await this.present(board, project, canConfigure, favourite);
    const custom = new Map(presented.quickFilters.map((filter) => [filter.id, filter.query]));
    const extra = filters.map((filter) => {
      const query = BUILT_IN[filter] ?? custom.get(filter);
      if (!query) throw new BadRequestException(`Unknown quick filter "${filter}"`);
      return query;
    });
    const compiled = await this.scope(principal, [board.query, ...extra]);
    const mapped = presented.columns.flatMap((column) => column.statusIds);
    // A Scrum board shows the issues of its active sprints (E-55); with parallel sprints all
    // of them or the chosen one (E-113).
    const running =
      board.type === 'scrum'
        ? await this.database.db
            .select()
            .from(sprints)
            .where(and(eq(sprints.boardId, board.id), eq(sprints.state, 'active')))
            .orderBy(asc(sprints.startedAt), asc(sprints.createdAt))
        : [];
    const presentSprint = (row: (typeof running)[number]) => ({
      id: row.id,
      boardId: row.boardId,
      name: row.name,
      goal: row.goal,
      state: row.state,
      startDate: row.startDate,
      endDate: row.endDate,
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      capacity: row.capacity,
    });
    const chosen = sprintId ? running.filter((row) => row.id === sprintId) : running;
    const active = chosen[0];
    const sprint = active ? presentSprint(active) : null;
    const activeSprints = running.map(presentSprint);
    const empty = {
      board: presented,
      sprint,
      activeSprints,
      issues: [],
      truncated: false,
      reachable: {},
    };
    if (compiled.projectIds.length === 0 || mapped.length === 0) return empty;
    if (board.type === 'scrum' && !active) return empty;

    const conditions: Array<SQL | undefined> = [
      inArray(issues.projectId, compiled.projectIds),
      isNull(issues.deletedAt),
      compiled.where,
      inArray(issues.statusId, mapped),
      active
        ? sql`exists (select 1 from ${sprintIssues} si where si.issue_id = ${issues.id}
            and si.sprint_id in (${sql.join(
              chosen.map((row) => sql`${row.id}`),
              sql`, `,
            )}) and si.removed_at is null)`
        : undefined,
    ];
    if (board.type === 'kanban' && board.hideDoneAfterDays) {
      const meta = await this.meta.load();
      const done = meta.statuses
        .filter((status) => status.category === 'done')
        .map((status) => status.id);
      if (done.length > 0) {
        conditions.push(
          not(
            and(
              inArray(issues.statusId, done),
              sql`coalesce(${issues.resolvedAt}, ${issues.updatedAt}) < now() - make_interval(days => ${board.hideDoneAfterDays})`,
            ) as SQL,
          ),
        );
      }
    }
    const rows = await this.database.db
      .select(issueColumns)
      .from(issues)
      .where(and(...conditions))
      .orderBy(asc(issues.rank), asc(issues.id))
      .limit(BOARD_LIMIT + 1);
    const shown = rows.slice(0, BOARD_LIMIT);
    const summaries = await this.issueService.summarize(principal.userId, shown);

    // Where each card may go now, so the board can mark the reachable columns.
    const reachable: Record<string, string[]> = {};
    const offered = await this.issueService.offered(
      principal.userId,
      shown.filter((_, index) => summaries[index]?.canTransition),
    );
    for (const [issueId, transitions] of offered) {
      reachable[issueId] = transitions.map((transition) => transition.to);
    }
    return {
      board: presented,
      sprint,
      activeSprints,
      issues: summaries,
      truncated: rows.length > BOARD_LIMIT,
      reachable,
    };
  }

  // ---------------------------------------------------------------- moving cards

  /** Into a column through the workflow (first reachable status of the column), then ranked. */
  async move(principal: Principal, id: string, request: MoveCardRequest): Promise<Issue> {
    const board = await this.get(principal, id);
    const column = board.columns.find((entry) => entry.id === request.columnId);
    if (!column) throw new BadRequestException('Unknown column');
    let issue = await this.issueService.get(principal, request.issueKey);
    if (!column.statusIds.includes(issue.status.id)) {
      const transitions = await this.issueService.transitions(principal, issue.key);
      const target = column.statusIds
        .map((statusId) => transitions.find((transition) => transition.to.id === statusId))
        .find(Boolean);
      if (!target) {
        const reachable = board.columns
          .filter((entry) =>
            transitions.some((transition) => entry.statusIds.includes(transition.to.id)),
          )
          .map((entry) => entry.name);
        throw new ConflictException(
          `${issue.key} cannot move to "${column.name}" from its status${reachable.length > 0 ? `; possible: ${reachable.join(', ')}` : ''}`,
        );
      }
      issue = await this.issueService.transition(principal, issue.key, {
        transitionId: target.id,
        fields: request.fields,
        comment: request.comment,
      });
    }
    if (request.afterKey || request.beforeKey) {
      await this.issueService.rank(principal, issue.key, {
        afterKey: request.afterKey,
        beforeKey: request.beforeKey,
      });
    }
    return issue;
  }

  // ---------------------------------------------------------------- configuration

  async create(principal: Principal, request: CreateBoardRequest): Promise<Board> {
    const project = await this.projects.findBrowsable(principal, request.projectKey);
    await this.projectAccess.require(principal, project.id, 'administer');
    const query = request.query ?? `project = ${project.key}`;
    await this.scope(principal, [query]);
    const details = await this.projects.details(principal, project.key);
    const id = uuidv7();
    await this.database.db.transaction((tx) =>
      this.insertBoard(tx, {
        id,
        name: request.name,
        type: request.type,
        projectId: project.id,
        query,
        statuses: details.statuses,
      }),
    );
    await this.audit.record({
      action: 'board.created',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'board',
      targetId: id,
      details: { name: request.name, project: project.key },
    });
    return this.get(principal, id);
  }

  /**
   * A new board inside a transaction, with one column per status in workflow order as a start.
   * Also used by the welcome steps (E-71).
   */
  async insertBoard(
    tx: Executor,
    board: {
      id: string;
      name: string;
      type: 'scrum' | 'kanban';
      projectId: string;
      query: string;
      statuses: Array<{ id: string; name: string }>;
    },
  ): Promise<void> {
    await tx.insert(boards).values({
      id: board.id,
      name: board.name,
      type: board.type,
      projectId: board.projectId,
      query: board.query,
      hideDoneAfterDays: board.type === 'kanban' ? 14 : null,
    });
    await this.writeColumns(
      tx,
      board.id,
      board.statuses.map((status) => ({ name: status.name, statusIds: [status.id] })),
    );
  }

  private async writeColumns(
    tx: Executor,
    boardId: string,
    columns: Array<{
      id?: string;
      name: string;
      statusIds: string[];
      wipMin?: number | null;
      wipMax?: number | null;
    }>,
  ): Promise<void> {
    const all = columns.flatMap((column) => column.statusIds);
    if (new Set(all).size !== all.length) {
      throw new BadRequestException('A status can belong to only one column');
    }
    for (const column of columns) {
      if (column.wipMin != null && column.wipMax != null && column.wipMin > column.wipMax) {
        throw new BadRequestException(`"${column.name}": the minimum is above the maximum`);
      }
    }
    const existing = await tx
      .select({ id: boardColumns.id })
      .from(boardColumns)
      .where(eq(boardColumns.boardId, boardId));
    const known = new Set(existing.map((row) => row.id));
    const kept = new Set(columns.flatMap((column) => (column.id ? [column.id] : [])));
    for (const id of kept) {
      if (!known.has(id)) throw new BadRequestException('Unknown column');
    }
    await tx.delete(boardColumnStatuses).where(eq(boardColumnStatuses.boardId, boardId));
    const dropped = [...known].filter((id) => !kept.has(id));
    if (dropped.length > 0) await tx.delete(boardColumns).where(inArray(boardColumns.id, dropped));
    for (const [position, column] of columns.entries()) {
      const id = column.id ?? uuidv7();
      const values = {
        name: column.name,
        position,
        wipMin: column.wipMin ?? null,
        wipMax: column.wipMax ?? null,
      };
      if (column.id) await tx.update(boardColumns).set(values).where(eq(boardColumns.id, id));
      else await tx.insert(boardColumns).values({ id, boardId, ...values });
      if (column.statusIds.length > 0) {
        await tx.insert(boardColumnStatuses).values(
          column.statusIds.map((statusId, index) => ({
            boardId,
            columnId: id,
            statusId,
            position: index,
          })),
        );
      }
    }
  }

  async update(principal: Principal, id: string, request: UpdateBoardRequest): Promise<Board> {
    const { board } = await this.row(principal, id, 'administer');
    const query = request.query ?? board.query;
    if (request.query !== undefined) await this.scope(principal, [query]);
    for (const filter of request.quickFilters ?? []) {
      await this.scope(principal, [query, filter.query]);
    }
    if (request.columns) {
      const meta = await this.meta.load();
      for (const statusId of request.columns.flatMap((column) => column.statusIds)) {
        if (!meta.status.has(statusId)) throw new BadRequestException('Unknown status');
      }
    }
    try {
      await this.database.db.transaction(async (tx) => {
        await tx
          .update(boards)
          .set({
            ...(request.name !== undefined ? { name: request.name } : {}),
            ...(request.query !== undefined ? { query: request.query } : {}),
            ...(request.swimlanes !== undefined ? { swimlanes: request.swimlanes } : {}),
            ...(request.hideDoneAfterDays !== undefined
              ? { hideDoneAfterDays: request.hideDoneAfterDays }
              : {}),
            ...(request.estimation !== undefined ? { estimation: request.estimation } : {}),
            ...(request.parallelSprints !== undefined
              ? { parallelSprints: request.parallelSprints }
              : {}),
            updatedAt: sql`now()`,
          })
          .where(eq(boards.id, id));
        if (request.columns) await this.writeColumns(tx, id, request.columns);
        if (request.quickFilters) {
          await tx.delete(boardQuickFilters).where(eq(boardQuickFilters.boardId, id));
          if (request.quickFilters.length > 0) {
            await tx.insert(boardQuickFilters).values(
              request.quickFilters.map((filter, position) => ({
                id: filter.id ?? uuidv7(),
                boardId: id,
                name: filter.name,
                query: filter.query,
                position,
              })),
            );
          }
        }
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException('Quick filter names must be unique');
      throw error;
    }
    await signal(this.database.db, { type: 'board', boardId: id });
    await this.audit.record({
      action: 'board.updated',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'board',
      targetId: id,
      details: { fields: Object.keys(request) },
    });
    return this.get(principal, id);
  }

  async delete(principal: Principal, id: string): Promise<void> {
    await this.row(principal, id, 'administer');
    await this.database.db.delete(boards).where(eq(boards.id, id));
    await signal(this.database.db, { type: 'board', boardId: id });
    await this.audit.record({
      action: 'board.deleted',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'board',
      targetId: id,
    });
  }
}
