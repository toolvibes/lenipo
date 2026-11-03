import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type BoardSummary,
  type DashboardSummary,
  DEFAULT_ISSUE_COLUMNS,
  type Favourite,
  type FavouriteKind,
  IssueColumns,
  type RecentItem,
  type RecentKind,
} from '@toolvibes/shared';
import { and, desc, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import { BoardService } from '../boards/board.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import { DashboardService } from '../dashboards/dashboard.service.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  favourites,
  issues,
  projects,
  recentItems,
  spaces,
  userPreferences,
} from '../db/schema/index.js';
import { FilterService } from '../search/filter.service.js';
import { IssueService } from '../tracking/issue.service.js';
import { securityVisible } from '../tracking/issue-security.js';
import { ProjectService } from '../tracking/project.service.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';
import { PageService } from '../wiki/page.service.js';
import { recordPageView } from '../wiki/page-analytics.service.js';
import { SpaceService } from '../wiki/space.service.js';
import { SpaceAccessService } from '../wiki/space-access.service.js';

const RECENT_KEEP = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISSUE_COLUMNS = 'issue-columns';

/** Favourites and recently viewed items of the caller (P-GEN-05, E-46). */
@Injectable()
export class PersonalService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(IssueService) private readonly issues: IssueService,
    @Inject(FilterService) private readonly filters: FilterService,
    @Inject(SpaceService) private readonly spaces: SpaceService,
    @Inject(SpaceAccessService) private readonly spaceAccess: SpaceAccessService,
    @Inject(PageService) private readonly pages: PageService,
    @Inject(BoardService) private readonly boards: BoardService,
    @Inject(DashboardService) private readonly dashboards: DashboardService,
  ) {}

  // ---------------------------------------------------------------- favourites

  /** Resolves a reference (key or id) to the id of something the caller can see. */
  private async target(
    principal: Principal,
    kind: FavouriteKind | RecentKind,
    ref: string,
  ): Promise<string> {
    switch (kind) {
      case 'project':
        return (await this.projects.findBrowsable(principal, ref)).id;
      case 'filter':
        return (await this.filters.get(principal, ref)).id;
      case 'issue':
        return (await this.issues.authorize(principal, ref, 'browse')).issue.id;
      case 'space':
        return (await this.spaces.find(principal, ref)).space.id;
      case 'page':
        return (await this.pages.authorize(principal, ref, 'view')).page.id;
      case 'board':
        if (!UUID.test(ref)) throw new NotFoundException('Board not found');
        return (await this.boards.get(principal, ref)).id;
      case 'dashboard':
        if (!UUID.test(ref)) throw new NotFoundException('Dashboard not found');
        return (await this.dashboards.get(principal, ref)).id;
    }
  }

  /** Spaces and pages among the rows that the user can still see, by id. */
  private async wikiTargets(userId: string, rows: { kind: string; targetId: string }[]) {
    const spaceIds = rows.filter((row) => row.kind === 'space').map((row) => row.targetId);
    const pageIds = rows.filter((row) => row.kind === 'page').map((row) => row.targetId);
    const visibleSpaces = new Map(
      spaceIds.length === 0
        ? []
        : (
            await this.database.db
              .select({ id: spaces.id, key: spaces.key, name: spaces.name })
              .from(spaces)
              .where(
                and(inArray(spaces.id, spaceIds), await this.spaceAccess.viewableCondition(userId)),
              )
          ).map((space) => [space.id, space]),
    );
    return { spaces: visibleSpaces, pages: await this.pages.visible(userId, pageIds) };
  }

  /** Boards among the rows that the user can still see, by id. */
  private async visibleBoards(principal: Principal, rows: { kind: string }[]) {
    if (!rows.some((row) => row.kind === 'board')) return new Map<string, BoardSummary>();
    return new Map((await this.boards.list(principal)).map((board) => [board.id, board]));
  }

  async setFavourite(
    principal: Principal,
    kind: FavouriteKind,
    ref: string,
    on: boolean,
  ): Promise<void> {
    const targetId = await this.target(principal, kind, ref);
    const db = this.database.db;
    if (on) {
      await db
        .insert(favourites)
        .values({ userId: principal.userId, kind, targetId })
        .onConflictDoNothing();
    } else {
      await db
        .delete(favourites)
        .where(
          and(
            eq(favourites.userId, principal.userId),
            eq(favourites.kind, kind),
            eq(favourites.targetId, targetId),
          ),
        );
    }
  }

  /** Starred items in the order they were starred; ones the caller can no longer see are skipped. */
  async favourites(principal: Principal): Promise<Favourite[]> {
    const rows = await this.database.db
      .select()
      .from(favourites)
      .where(eq(favourites.userId, principal.userId))
      .orderBy(favourites.createdAt);
    const visibleProjects = new Map(
      (await this.projects.list(principal)).map((project) => [project.id, project]),
    );
    const favouriteFilters = new Map(
      (await this.filters.list(principal, 'favourites')).map((filter) => [filter.id, filter]),
    );
    const wiki = await this.wikiTargets(principal.userId, rows);
    const visibleBoards = await this.visibleBoards(principal, rows);
    const starredDashboards = rows.some((row) => row.kind === 'dashboard')
      ? new Map(
          (await this.dashboards.list(principal, 'favourites')).map((entry) => [entry.id, entry]),
        )
      : new Map<string, DashboardSummary>();
    return rows.flatMap((row): Favourite[] => {
      switch (row.kind) {
        case 'project': {
          const project = visibleProjects.get(row.targetId);
          return project
            ? [{ kind: 'project', id: project.id, ref: project.key, name: project.name }]
            : [];
        }
        case 'filter': {
          const filter = favouriteFilters.get(row.targetId);
          return filter
            ? [{ kind: 'filter', id: filter.id, ref: filter.id, name: filter.name }]
            : [];
        }
        case 'space': {
          const space = wiki.spaces.get(row.targetId);
          return space ? [{ kind: 'space', id: space.id, ref: space.key, name: space.name }] : [];
        }
        case 'board': {
          const board = visibleBoards.get(row.targetId);
          return board
            ? [
                {
                  kind: 'board',
                  id: board.id,
                  ref: board.id,
                  name: board.name,
                  projectKey: board.project.key,
                },
              ]
            : [];
        }
        case 'dashboard': {
          const dashboard = starredDashboards.get(row.targetId);
          return dashboard
            ? [{ kind: 'dashboard', id: dashboard.id, ref: dashboard.id, name: dashboard.name }]
            : [];
        }
        default: {
          const page = wiki.pages.get(row.targetId);
          return page
            ? [
                {
                  kind: 'page',
                  id: page.id,
                  ref: page.id,
                  name: page.title,
                  spaceKey: page.spaceKey,
                },
              ]
            : [];
        }
      }
    });
  }

  // ---------------------------------------------------------------- recently viewed

  /** Called by the web app when a person opens something; keeps the newest 50. */
  async recordView(principal: Principal, kind: RecentKind, ref: string): Promise<void> {
    const targetId = await this.target(principal, kind, ref);
    const db = this.database.db;
    await db.transaction(async (tx) => {
      await tx
        .insert(recentItems)
        .values({ userId: principal.userId, kind, targetId })
        .onConflictDoUpdate({
          target: [recentItems.userId, recentItems.kind, recentItems.targetId],
          set: { viewedAt: sql`now()` },
        });
      const keep = tx
        .select({ targetId: recentItems.targetId })
        .from(recentItems)
        .where(eq(recentItems.userId, principal.userId))
        .orderBy(desc(recentItems.viewedAt))
        .limit(RECENT_KEEP);
      await tx
        .delete(recentItems)
        .where(
          and(eq(recentItems.userId, principal.userId), notInArray(recentItems.targetId, keep)),
        );
      // Page analytics count the same opening (W-PAG-14, TL-51).
      if (kind === 'page') await recordPageView(tx, targetId, principal.userId);
    });
  }

  /** Recently opened items the caller can still see, newest first. */
  async recent(principal: Principal, limit: number): Promise<RecentItem[]> {
    const db = this.database.db;
    const rows = await db
      .select()
      .from(recentItems)
      .where(eq(recentItems.userId, principal.userId))
      .orderBy(desc(recentItems.viewedAt))
      .limit(RECENT_KEEP);
    const visible = db
      .select({ id: projects.id })
      .from(projects)
      .where(await this.projectAccess.browsableCondition(principal.userId));
    const issueIds = rows.filter((row) => row.kind === 'issue').map((row) => row.targetId);
    const issueRows =
      issueIds.length > 0
        ? await db
            .select()
            .from(issues)
            .where(
              and(
                inArray(issues.id, issueIds),
                isNull(issues.deletedAt),
                inArray(issues.projectId, visible),
                securityVisible(principal.userId),
              ),
            )
        : [];
    const summaries = new Map(
      (await this.issues.summarize(principal.userId, issueRows)).map((summary) => [
        summary.id,
        summary,
      ]),
    );
    const projectsById = new Map(
      (await this.projects.list(principal)).map((project) => [project.id, project]),
    );
    const wiki = await this.wikiTargets(principal.userId, rows);
    const visibleBoards = await this.visibleBoards(principal, rows);
    const items: RecentItem[] = [];
    for (const row of rows) {
      const viewedAt = row.viewedAt.toISOString();
      if (row.kind === 'issue') {
        const issue = summaries.get(row.targetId);
        if (issue)
          items.push({ kind: 'issue', ref: issue.key, name: issue.summary, viewedAt, issue });
      } else if (row.kind === 'project') {
        const project = projectsById.get(row.targetId);
        if (project)
          items.push({ kind: 'project', ref: project.key, name: project.name, viewedAt });
      } else if (row.kind === 'space') {
        const space = wiki.spaces.get(row.targetId);
        if (space) items.push({ kind: 'space', ref: space.key, name: space.name, viewedAt });
      } else if (row.kind === 'board') {
        const board = visibleBoards.get(row.targetId);
        if (board)
          items.push({
            kind: 'board',
            ref: board.id,
            name: board.name,
            projectKey: board.project.key,
            viewedAt,
          });
      } else {
        const page = wiki.pages.get(row.targetId);
        if (page)
          items.push({
            kind: 'page',
            ref: page.id,
            name: page.title,
            spaceKey: page.spaceKey,
            viewedAt,
          });
      }
      if (items.length >= limit) break;
    }
    return items;
  }

  // ---------------------------------------------------------------- preferences

  /** The caller's columns for issue result lists; the default until they choose (E-48). */
  async issueColumns(principal: Principal): Promise<IssueColumns> {
    const [row] = await this.database.db
      .select({ value: userPreferences.value })
      .from(userPreferences)
      .where(
        and(eq(userPreferences.userId, principal.userId), eq(userPreferences.key, ISSUE_COLUMNS)),
      );
    // A stored value from an older version may name columns that no longer exist.
    const stored = row ? IssueColumns.safeParse(row.value) : null;
    return stored?.success ? stored.data : { columns: DEFAULT_ISSUE_COLUMNS };
  }

  async setIssueColumns(principal: Principal, value: IssueColumns): Promise<IssueColumns> {
    await this.database.db
      .insert(userPreferences)
      .values({ userId: principal.userId, key: ISSUE_COLUMNS, value })
      .onConflictDoUpdate({
        target: [userPreferences.userId, userPreferences.key],
        set: { value, updatedAt: sql`now()` },
      });
    return value;
  }
}
