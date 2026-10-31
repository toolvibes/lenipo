import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AddSpaceMemberRequest,
  CreateSpaceRequest,
  Space,
  SpaceMember,
  SpacePermission,
  SpaceSummary,
  UpdateSpaceRequest,
} from '@tasklore/shared';
import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import { type DatabaseHandle, type Executor, isUniqueViolation } from '../db/client.js';
import {
  favourites,
  groups,
  pages,
  pageWatches,
  projects,
  spaceRoleMembers,
  spaces,
  users,
} from '../db/schema/index.js';
import { USERS_GROUP } from '../identity/group.service.js';
import { signal } from '../realtime/signals.js';
import { ProjectService } from '../tracking/project.service.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';
import { SpaceAccessService } from './space-access.service.js';
import { setWatch } from './watches.js';

export type SpaceRow = typeof spaces.$inferSelect;

/** Wiki spaces and their role assignments (W-SPC-01, -03, -08; E-59). */
@Injectable()
export class SpaceService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(SpaceAccessService) private readonly spaceAccess: SpaceAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
  ) {}

  /** The creator administers the space; all signed-in users may edit it. */
  async create(principal: Principal, request: CreateSpaceRequest): Promise<Space> {
    if ('scopes' in principal && !principal.scopes.includes('admin')) {
      throw new ForbiddenException('Creating spaces with a token requires the admin scope');
    }
    if (!(await this.access.hasGlobal(principal.userId, 'create-spaces'))) {
      throw new ForbiddenException('Requires the global permission "create-spaces"');
    }
    const id = uuidv7();
    try {
      await this.database.db.transaction((tx) =>
        this.insertSpace(tx, principal.userId, id, request),
      );
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(`The space key "${request.key}" is already taken`);
      throw error;
    }
    await this.audit.record({
      action: 'space.created',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'space',
      targetId: id,
      details: { key: request.key },
    });
    return this.get(principal, request.key);
  }

  /**
   * The rows of a new space inside a transaction: the creator administers it, everyone in
   * "users" edits. `projectId` links it right away (welcome steps, E-71).
   */
  async insertSpace(
    tx: Executor,
    userId: string,
    id: string,
    request: CreateSpaceRequest | (Omit<CreateSpaceRequest, 'type'> & { type: 'personal' }),
    projectId: string | null = null,
  ) {
    await tx.insert(spaces).values({
      id,
      key: request.key,
      name: request.name,
      description: request.description,
      createdById: userId,
      projectId,
      type: request.type ?? 'team',
    });
    await tx.insert(spaceRoleMembers).values({
      id: uuidv7(),
      spaceId: id,
      role: 'administrators',
      userId,
    });
    const [everyone] = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.name, USERS_GROUP));
    // A personal space is private until its owner shares it (TL-29, E-110).
    if (everyone && request.type !== 'personal') {
      await tx
        .insert(spaceRoleMembers)
        .values({ id: uuidv7(), spaceId: id, role: 'editors', groupId: everyone.id });
    }
  }

  async list(principal: Principal): Promise<SpaceSummary[]> {
    if ('scopes' in principal && !principal.scopes.some((scope) => scope.startsWith('wiki:'))) {
      throw new ForbiddenException('This token lacks the wiki:read scope');
    }
    const rows = await this.database.db
      .select()
      .from(spaces)
      .where(await this.spaceAccess.viewableCondition(principal.userId))
      .orderBy(asc(spaces.name));
    return this.summaries(principal.userId, rows);
  }

  /** Spaces linked with a project the caller may browse, as far as the caller may view them. */
  async ofProject(principal: Principal, projectKey: string): Promise<SpaceSummary[]> {
    const project = await this.projects.findBrowsable(principal, projectKey);
    const rows = await this.database.db
      .select()
      .from(spaces)
      .where(
        and(
          eq(spaces.projectId, project.id),
          await this.spaceAccess.viewableCondition(principal.userId),
        ),
      )
      .orderBy(asc(spaces.name));
    return this.summaries(principal.userId, rows);
  }

  /** Finds a space the principal may use as asked; otherwise 404 or 403. */
  async find(
    principal: Principal,
    key: string,
    permission: SpacePermission = 'view',
  ): Promise<{ space: SpaceRow; permissions: Set<SpacePermission> }> {
    const [space] = await this.database.db
      .select()
      .from(spaces)
      .where(eq(spaces.key, key.toUpperCase()));
    if (!space || space.archivedAt) throw new NotFoundException('Space not found');
    const permissions = await this.spaceAccess.require(principal, space.id, permission);
    return { space, permissions };
  }

  /** The caller's personal space, created on first use with a free key like PLENA (TL-29). */
  async personal(principal: Principal): Promise<Space> {
    const [existing] = await this.database.db
      .select({ key: spaces.key })
      .from(spaces)
      .where(and(eq(spaces.type, 'personal'), eq(spaces.createdById, principal.userId)));
    if (existing) return this.get(principal, existing.key);
    const [user] = await this.database.db
      .select({ displayName: users.displayName })
      .from(users)
      .where(eq(users.id, principal.userId));
    const base =
      `P${(user?.displayName ?? 'USER')
        .normalize('NFD')
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase()}`.slice(0, 8) || 'PUSER';
    const taken = new Set(
      (await this.database.db.select({ key: spaces.key }).from(spaces)).map((row) => row.key),
    );
    let key = base.length >= 2 ? base : `${base}X`;
    for (let index = 2; taken.has(key); index++) key = `${base.slice(0, 8)}${index}`;
    const id = uuidv7();
    await this.database.db.transaction((tx) =>
      this.insertSpace(tx, principal.userId, id, {
        key,
        name: user?.displayName ?? key,
        description: '',
        type: 'personal',
      }),
    );
    return this.get(principal, key);
  }

  async get(principal: Principal, key: string): Promise<Space> {
    const { space, permissions } = await this.find(principal, key);
    const [summary] = await this.summaries(principal.userId, [space]);
    return { ...(summary as SpaceSummary), permissions: [...permissions].sort() };
  }

  async update(principal: Principal, key: string, request: UpdateSpaceRequest): Promise<Space> {
    const { space } = await this.find(principal, key, 'administer');
    if (request.homePageId) {
      const [home] = await this.database.db
        .select({ id: pages.id })
        .from(pages)
        .where(
          and(
            eq(pages.id, request.homePageId),
            eq(pages.spaceId, space.id),
            isNull(pages.deletedAt),
          ),
        );
      if (!home) throw new BadRequestException('The home page must be a page of this space');
    }
    const { projectKey, ...changes } = request;
    let projectId: string | null | undefined;
    if (projectKey !== undefined) {
      projectId = projectKey ? await this.linkableProject(principal, projectKey) : null;
      // Unlinking needs the project side too, unless the caller cannot see it any more.
      if (projectId === null && space.projectId) {
        const granted = await this.projectAccess.permissions(principal.userId, space.projectId);
        if (granted.has('browse') && !granted.has('administer')) {
          throw new ForbiddenException('Requires the project permission "administer"');
        }
      }
    }
    await this.database.db
      .update(spaces)
      .set({ ...changes, ...(projectId !== undefined ? { projectId } : {}) })
      .where(eq(spaces.id, space.id));
    if (projectId !== undefined && projectId !== space.projectId) {
      await this.audit.record({
        action: projectId ? 'space.project-linked' : 'space.project-unlinked',
        actorId: principal.userId,
        via: principal.via,
        targetType: 'space',
        targetId: space.id,
        details: { projectKey: projectKey ?? null },
      });
    }
    await signal(this.database.db, { type: 'space', spaceKey: space.key });
    return this.get(principal, key);
  }

  /** A project to link with: the caller must administer it as well (E-60). */
  private async linkableProject(principal: Principal, projectKey: string): Promise<string> {
    const project = await this.projects.findBrowsable(principal, projectKey);
    const granted = await this.projectAccess.permissions(principal.userId, project.id);
    if (!granted.has('administer')) {
      throw new ForbiddenException('Requires the project permission "administer"');
    }
    return project.id;
  }

  /** Follows or stops following everything in the space (E-65). */
  async watch(principal: Principal, key: string, on: boolean): Promise<Space> {
    const { space } = await this.find(principal, key);
    await setWatch(this.database.db, principal.userId, { kind: 'space', spaceId: space.id }, on);
    return this.get(principal, key);
  }

  // ---------------------------------------------------------------- role assignments

  async members(principal: Principal, key: string): Promise<SpaceMember[]> {
    const { space } = await this.find(principal, key, 'administer');
    const rows = await this.database.db
      .select({
        id: spaceRoleMembers.id,
        role: spaceRoleMembers.role,
        userId: users.id,
        userName: users.displayName,
        groupId: groups.id,
        groupName: groups.name,
      })
      .from(spaceRoleMembers)
      .leftJoin(users, eq(users.id, spaceRoleMembers.userId))
      .leftJoin(groups, eq(groups.id, spaceRoleMembers.groupId))
      .where(eq(spaceRoleMembers.spaceId, space.id))
      .orderBy(asc(spaceRoleMembers.role), asc(users.displayName), asc(groups.name));
    return rows.map((row) => ({
      id: row.id,
      role: row.role,
      user: row.userId ? { id: row.userId, displayName: row.userName ?? '' } : null,
      group: row.groupId ? { id: row.groupId, name: row.groupName ?? '' } : null,
    }));
  }

  async addMember(principal: Principal, key: string, request: AddSpaceMemberRequest) {
    const { space } = await this.find(principal, key, 'administer');
    if ('userId' in request) {
      const [user] = await this.database.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, request.userId));
      if (!user) throw new BadRequestException('Unknown user');
    } else {
      const [group] = await this.database.db
        .select({ id: groups.id })
        .from(groups)
        .where(eq(groups.id, request.groupId));
      if (!group) throw new BadRequestException('Unknown group');
    }
    const id = uuidv7();
    try {
      await this.database.db.insert(spaceRoleMembers).values({
        id,
        spaceId: space.id,
        role: request.role,
        userId: 'userId' in request ? request.userId : null,
        groupId: 'groupId' in request ? request.groupId : null,
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('This role is already assigned');
      throw error;
    }
    await this.audit.record({
      action: 'space.role-granted',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'space',
      targetId: space.id,
      details: { ...request },
    });
    return this.members(principal, key);
  }

  /** The last administrator assignment stays, so the space never becomes unmanageable. */
  async removeMember(principal: Principal, key: string, memberId: string): Promise<void> {
    const { space } = await this.find(principal, key, 'administer');
    const [member] = await this.database.db
      .select()
      .from(spaceRoleMembers)
      .where(and(eq(spaceRoleMembers.id, memberId), eq(spaceRoleMembers.spaceId, space.id)));
    if (!member) throw new NotFoundException('Role assignment not found');
    if (member.role === 'administrators') {
      const [admins] = await this.database.db
        .select({ total: count() })
        .from(spaceRoleMembers)
        .where(
          and(eq(spaceRoleMembers.spaceId, space.id), eq(spaceRoleMembers.role, 'administrators')),
        );
      if ((admins?.total ?? 0) <= 1) {
        throw new ConflictException('A space needs at least one administrator');
      }
    }
    await this.database.db.delete(spaceRoleMembers).where(eq(spaceRoleMembers.id, memberId));
    await this.audit.record({
      action: 'space.role-revoked',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'space',
      targetId: space.id,
      details: { role: member.role, userId: member.userId, groupId: member.groupId },
    });
  }

  /** Adds the caller's star and the linked project, if the caller may browse it. */
  private async summaries(userId: string, rows: SpaceRow[]): Promise<SpaceSummary[]> {
    if (rows.length === 0) return [];
    const db = this.database.db;
    const starred = new Set(
      (
        await db
          .select({ targetId: favourites.targetId })
          .from(favourites)
          .where(
            and(
              eq(favourites.userId, userId),
              eq(favourites.kind, 'space'),
              inArray(
                favourites.targetId,
                rows.map((row) => row.id),
              ),
            ),
          )
      ).map((row) => row.targetId),
    );
    const watched = new Set(
      (
        await db
          .select({ spaceId: pageWatches.spaceId })
          .from(pageWatches)
          .where(
            and(
              eq(pageWatches.userId, userId),
              eq(pageWatches.kind, 'space'),
              inArray(
                pageWatches.spaceId,
                rows.map((row) => row.id),
              ),
            ),
          )
      ).map((row) => row.spaceId),
    );
    const projectIds = [...new Set(rows.flatMap((row) => (row.projectId ? [row.projectId] : [])))];
    const linked = new Map(
      projectIds.length === 0
        ? []
        : (
            await db
              .select({ id: projects.id, key: projects.key, name: projects.name })
              .from(projects)
              .where(
                and(
                  inArray(projects.id, projectIds),
                  await this.projectAccess.browsableCondition(userId),
                ),
              )
          ).map((project) => [project.id, { key: project.key, name: project.name }]),
    );
    return rows.map((space) => ({
      id: space.id,
      key: space.key,
      name: space.name,
      description: space.description,
      homePageId: space.homePageId,
      createdAt: space.createdAt.toISOString(),
      favourite: starred.has(space.id),
      watching: watched.has(space.id),
      type: (space.type as SpaceSummary['type']) ?? 'team',
      project: (space.projectId && linked.get(space.projectId)) || null,
    }));
  }
}
