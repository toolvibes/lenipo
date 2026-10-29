import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateFilterRequest,
  FilterScope,
  FilterShare,
  FilterShareInput,
  SavedFilter,
  UpdateFilterRequest,
} from '@tasklore/shared';
import { and, asc, eq, exists, inArray, ne, or, type SQL, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AccessService } from '../access/access.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import { type DatabaseHandle, type Executor, isUniqueViolation } from '../db/client.js';
import {
  filterFavourites,
  filterShares,
  groupMembers,
  groups,
  projects,
  savedFilters,
  users,
} from '../db/schema/index.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';
import { requireIssueScope, SearchService } from './search.service.js';

type FilterRow = typeof savedFilters.$inferSelect;

function shareKey(share: FilterShareInput): string {
  switch (share.type) {
    case 'user':
      return `user:${share.userId}`;
    case 'group':
      return `group:${share.groupId}`;
    case 'project':
      return `project:${share.projectId}`;
    case 'authenticated':
      return 'authenticated';
  }
}

/** Saved TQL filters: the owner edits, shares grant read access (decision E-37). */
@Injectable()
export class FilterService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(SearchService) private readonly search: SearchService,
  ) {}

  /** Filters the user owns or that are shared with them, directly or through a group or project. */
  private async visibleCondition(userId: string): Promise<SQL> {
    const db = this.database.db;
    const myGroups = db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(eq(groupMembers.userId, userId));
    const myProjects = db
      .select({ id: projects.id })
      .from(projects)
      .where(await this.projectAccess.browsableCondition(userId));
    const shared = exists(
      db
        .select({ one: sql`1` })
        .from(filterShares)
        .where(
          and(
            eq(filterShares.filterId, savedFilters.id),
            or(
              eq(filterShares.type, 'authenticated'),
              eq(filterShares.userId, userId),
              inArray(filterShares.groupId, myGroups),
              inArray(filterShares.projectId, myProjects),
            ),
          ),
        ),
    );
    return or(eq(savedFilters.ownerId, userId), shared) as SQL;
  }

  private async present(userId: string, rows: FilterRow[]): Promise<SavedFilter[]> {
    if (rows.length === 0) return [];
    const db = this.database.db;
    const ids = rows.map((row) => row.id);
    const [owners, shares, favourites] = await Promise.all([
      db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(inArray(users.id, [...new Set(rows.map((row) => row.ownerId))])),
      db
        .select({
          filterId: filterShares.filterId,
          type: filterShares.type,
          userId: users.id,
          userName: users.displayName,
          groupId: groups.id,
          groupName: groups.name,
          projectId: projects.id,
          projectKey: projects.key,
          projectName: projects.name,
        })
        .from(filterShares)
        .leftJoin(users, eq(users.id, filterShares.userId))
        .leftJoin(groups, eq(groups.id, filterShares.groupId))
        .leftJoin(projects, eq(projects.id, filterShares.projectId))
        .where(inArray(filterShares.filterId, ids)),
      db
        .select({ filterId: filterFavourites.filterId })
        .from(filterFavourites)
        .where(and(eq(filterFavourites.userId, userId), inArray(filterFavourites.filterId, ids))),
    ]);
    const ownerById = new Map(owners.map((owner) => [owner.id, owner]));
    const favourite = new Set(favourites.map((entry) => entry.filterId));
    const sharesByFilter = new Map<string, FilterShare[]>();
    for (const share of shares) {
      let presented: FilterShare | null = null;
      if (share.type === 'authenticated') presented = { type: 'authenticated' };
      else if (share.type === 'user' && share.userId && share.userName) {
        presented = { type: 'user', user: { id: share.userId, displayName: share.userName } };
      } else if (share.type === 'group' && share.groupId && share.groupName) {
        presented = { type: 'group', group: { id: share.groupId, name: share.groupName } };
      } else if (
        share.type === 'project' &&
        share.projectId &&
        share.projectKey &&
        share.projectName
      ) {
        presented = {
          type: 'project',
          project: { id: share.projectId, key: share.projectKey, name: share.projectName },
        };
      }
      if (presented)
        sharesByFilter.set(share.filterId, [
          ...(sharesByFilter.get(share.filterId) ?? []),
          presented,
        ]);
    }
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      query: row.query,
      owner: ownerById.get(row.ownerId) ?? { id: row.ownerId, displayName: '' },
      shares: sharesByFilter.get(row.id) ?? [],
      favourite: favourite.has(row.id),
      editable: row.ownerId === userId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async list(principal: Principal, scope: FilterScope): Promise<SavedFilter[]> {
    requireIssueScope(principal);
    const { userId } = principal;
    const scoped: Record<FilterScope, SQL | undefined> = {
      visible: undefined,
      mine: eq(savedFilters.ownerId, userId),
      shared: ne(savedFilters.ownerId, userId),
      favourites: exists(
        this.database.db
          .select({ one: sql`1` })
          .from(filterFavourites)
          .where(
            and(
              eq(filterFavourites.filterId, savedFilters.id),
              eq(filterFavourites.userId, userId),
            ),
          ),
      ),
    };
    const rows = await this.database.db
      .select()
      .from(savedFilters)
      .where(and(await this.visibleCondition(userId), scoped[scope]))
      .orderBy(asc(sql`lower(${savedFilters.name})`), asc(savedFilters.id));
    return this.present(userId, rows);
  }

  /** Loads a filter the user can see; others look like they do not exist. */
  private async load(principal: Principal, id: string): Promise<FilterRow> {
    const [row] = await this.database.db
      .select()
      .from(savedFilters)
      .where(and(eq(savedFilters.id, id), await this.visibleCondition(principal.userId)));
    if (!row) throw new NotFoundException('Filter not found');
    return row;
  }

  async get(principal: Principal, id: string): Promise<SavedFilter> {
    requireIssueScope(principal);
    const [filter] = await this.present(principal.userId, [await this.load(principal, id)]);
    return filter as SavedFilter;
  }

  /** Checks every share target; sharing at all needs the global permission `share-filters`. */
  private async validateShares(
    principal: Principal,
    shares: FilterShareInput[],
  ): Promise<FilterShareInput[]> {
    const unique = [...new Map(shares.map((share) => [shareKey(share), share])).values()];
    if (unique.length === 0) return unique;
    const { userId } = principal;
    if (!(await this.access.hasGlobal(userId, 'share-filters'))) {
      throw new ForbiddenException('Requires the global permission "share-filters"');
    }
    const admin = await this.access.hasGlobal(userId, 'admin');
    const db = this.database.db;
    for (const share of unique) {
      if (share.type === 'user') {
        const [user] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, share.userId));
        if (!user) throw new BadRequestException('A shared user does not exist');
      } else if (share.type === 'group') {
        // Only groups one belongs to, so sharing does not reveal or reach foreign groups.
        const [group] = await db
          .select({ id: groups.id })
          .from(groups)
          .where(eq(groups.id, share.groupId));
        const [member] = await db
          .select({ userId: groupMembers.userId })
          .from(groupMembers)
          .where(and(eq(groupMembers.groupId, share.groupId), eq(groupMembers.userId, userId)));
        if (!group || (!member && !admin)) {
          throw new BadRequestException('Filters can only be shared with your own groups');
        }
      } else if (share.type === 'project') {
        const permissions = await this.projectAccess.permissions(userId, share.projectId);
        if (!permissions.has('browse'))
          throw new BadRequestException('A shared project does not exist');
      }
    }
    return unique;
  }

  private async replaceShares(
    db: Executor,
    filterId: string,
    shares: FilterShareInput[],
  ): Promise<void> {
    await db.delete(filterShares).where(eq(filterShares.filterId, filterId));
    if (shares.length === 0) return;
    await db.insert(filterShares).values(
      shares.map((share) => ({
        id: uuidv7(),
        filterId,
        type: share.type,
        userId: share.type === 'user' ? share.userId : null,
        groupId: share.type === 'group' ? share.groupId : null,
        projectId: share.type === 'project' ? share.projectId : null,
      })),
    );
  }

  async create(principal: Principal, request: CreateFilterRequest): Promise<SavedFilter> {
    requireIssueScope(principal, true);
    // A filter must be runnable by its owner when it is saved.
    await this.search.compile(principal, request.query);
    const shares = await this.validateShares(principal, request.shares);
    const id = uuidv7();
    try {
      await this.database.db.transaction(async (tx) => {
        await tx.insert(savedFilters).values({
          id,
          ownerId: principal.userId,
          name: request.name,
          description: request.description,
          query: request.query,
        });
        await this.replaceShares(tx, id, shares);
        if (request.favourite) {
          await tx.insert(filterFavourites).values({ userId: principal.userId, filterId: id });
        }
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`You already have a filter named "${request.name}"`);
      }
      throw error;
    }
    return this.get(principal, id);
  }

  private async loadOwned(principal: Principal, id: string): Promise<FilterRow> {
    const row = await this.load(principal, id);
    if (row.ownerId !== principal.userId) {
      throw new ForbiddenException('Only the owner can change this filter');
    }
    return row;
  }

  async update(
    principal: Principal,
    id: string,
    request: UpdateFilterRequest,
  ): Promise<SavedFilter> {
    requireIssueScope(principal, true);
    await this.loadOwned(principal, id);
    if (request.query !== undefined) await this.search.compile(principal, request.query);
    const shares = request.shares
      ? await this.validateShares(principal, request.shares)
      : undefined;
    try {
      await this.database.db.transaction(async (tx) => {
        await tx
          .update(savedFilters)
          .set({
            ...(request.name !== undefined ? { name: request.name } : {}),
            ...(request.description !== undefined ? { description: request.description } : {}),
            ...(request.query !== undefined ? { query: request.query } : {}),
            updatedAt: new Date(),
          })
          .where(eq(savedFilters.id, id));
        if (shares) await this.replaceShares(tx, id, shares);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`You already have a filter named "${request.name}"`);
      }
      throw error;
    }
    return this.get(principal, id);
  }

  async delete(principal: Principal, id: string): Promise<void> {
    requireIssueScope(principal, true);
    const row = await this.load(principal, id);
    if (
      row.ownerId !== principal.userId &&
      !(await this.access.hasGlobal(principal.userId, 'admin'))
    ) {
      throw new ForbiddenException('Only the owner can delete this filter');
    }
    await this.database.db.delete(savedFilters).where(eq(savedFilters.id, id));
  }

  async setFavourite(principal: Principal, id: string, favourite: boolean): Promise<void> {
    requireIssueScope(principal);
    await this.load(principal, id);
    const db = this.database.db;
    if (favourite) {
      await db
        .insert(filterFavourites)
        .values({ userId: principal.userId, filterId: id })
        .onConflictDoNothing();
    } else {
      await db
        .delete(filterFavourites)
        .where(
          and(eq(filterFavourites.userId, principal.userId), eq(filterFavourites.filterId, id)),
        );
    }
  }
}
