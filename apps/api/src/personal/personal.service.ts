import { Inject, Injectable } from '@nestjs/common';
import type { Favourite, FavouriteKind, RecentItem, RecentKind } from '@tasklore/shared';
import { and, desc, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { favourites, issues, projects, recentItems } from '../db/schema/index.js';
import { FilterService } from '../search/filter.service.js';
import { IssueService } from '../tracking/issue.service.js';
import { ProjectService } from '../tracking/project.service.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';

const RECENT_KEEP = 50;

/** Favourites and recently viewed items of the caller (P-GEN-05, E-46). */
@Injectable()
export class PersonalService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(IssueService) private readonly issues: IssueService,
    @Inject(FilterService) private readonly filters: FilterService,
  ) {}

  // ---------------------------------------------------------------- favourites

  /** Resolves a reference (project key, filter id) to the id of something the caller can see. */
  private async target(principal: Principal, kind: FavouriteKind, ref: string): Promise<string> {
    if (kind === 'project') return (await this.projects.findBrowsable(principal, ref)).id;
    return (await this.filters.get(principal, ref)).id;
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

  /** Starred projects and filters in the order they were starred; hidden ones are skipped. */
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
    return rows.flatMap((row): Favourite[] => {
      if (row.kind === 'project') {
        const project = visibleProjects.get(row.targetId);
        return project
          ? [{ kind: 'project', id: project.id, ref: project.key, name: project.name }]
          : [];
      }
      const filter = favouriteFilters.get(row.targetId);
      return filter ? [{ kind: 'filter', id: filter.id, ref: filter.id, name: filter.name }] : [];
    });
  }

  // ---------------------------------------------------------------- recently viewed

  /** Called by the web app when a person opens something; keeps the newest 50. */
  async recordView(principal: Principal, kind: RecentKind, ref: string): Promise<void> {
    const targetId =
      kind === 'project'
        ? (await this.projects.findBrowsable(principal, ref)).id
        : (await this.issues.authorize(principal, ref, 'browse')).issue.id;
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
    });
  }

  /** Recently opened issues and projects the caller can still see, newest first. */
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
              ),
            )
        : [];
    const summaries = new Map(
      (await this.issues.summarize(issueRows)).map((summary) => [summary.id, summary]),
    );
    const projectsById = new Map(
      (await this.projects.list(principal)).map((project) => [project.id, project]),
    );
    const items: RecentItem[] = [];
    for (const row of rows) {
      const viewedAt = row.viewedAt.toISOString();
      if (row.kind === 'issue') {
        const issue = summaries.get(row.targetId);
        if (issue)
          items.push({ kind: 'issue', ref: issue.key, name: issue.summary, viewedAt, issue });
      } else {
        const project = projectsById.get(row.targetId);
        if (project)
          items.push({ kind: 'project', ref: project.key, name: project.name, viewedAt });
      }
      if (items.length >= limit) break;
    }
    return items;
  }
}
