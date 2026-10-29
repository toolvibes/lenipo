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
import { and, asc, count, eq, isNull } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import { type DatabaseHandle, isUniqueViolation } from '../db/client.js';
import { groups, pages, spaceRoleMembers, spaces, users } from '../db/schema/index.js';
import { USERS_GROUP } from '../identity/group.service.js';
import { signal } from '../realtime/signals.js';
import { SpaceAccessService } from './space-access.service.js';

export type SpaceRow = typeof spaces.$inferSelect;

/** Wiki spaces and their role assignments (W-SPC-01, -03, -08; E-59). */
@Injectable()
export class SpaceService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(SpaceAccessService) private readonly spaceAccess: SpaceAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
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
      await this.database.db.transaction(async (tx) => {
        await tx.insert(spaces).values({
          id,
          key: request.key,
          name: request.name,
          description: request.description,
          createdById: principal.userId,
        });
        await tx.insert(spaceRoleMembers).values({
          id: uuidv7(),
          spaceId: id,
          role: 'administrators',
          userId: principal.userId,
        });
        const [everyone] = await tx
          .select({ id: groups.id })
          .from(groups)
          .where(eq(groups.name, USERS_GROUP));
        if (everyone) {
          await tx
            .insert(spaceRoleMembers)
            .values({ id: uuidv7(), spaceId: id, role: 'editors', groupId: everyone.id });
        }
      });
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

  async list(principal: Principal): Promise<SpaceSummary[]> {
    if ('scopes' in principal && !principal.scopes.some((scope) => scope.startsWith('wiki:'))) {
      throw new ForbiddenException('This token lacks the wiki:read scope');
    }
    const rows = await this.database.db
      .select()
      .from(spaces)
      .where(await this.spaceAccess.viewableCondition(principal.userId))
      .orderBy(asc(spaces.name));
    return rows.map((row) => this.summary(row));
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

  async get(principal: Principal, key: string): Promise<Space> {
    const { space, permissions } = await this.find(principal, key);
    return { ...this.summary(space), permissions: [...permissions].sort() };
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
    await this.database.db.update(spaces).set(request).where(eq(spaces.id, space.id));
    await signal(this.database.db, { type: 'space', spaceKey: space.key });
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

  private summary(space: SpaceRow): SpaceSummary {
    return {
      id: space.id,
      key: space.key,
      name: space.name,
      description: space.description,
      homePageId: space.homePageId,
      createdAt: space.createdAt.toISOString(),
    };
  }
}
