import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AddProjectMemberRequest,
  ProjectMember,
  ProjectRole,
  SpaceRole,
} from '@toolvibes/shared';
import { and, asc, count, eq, isNull, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  groupMembers,
  groups,
  projectRoleMembers,
  spaceRoleMembers,
  spaces,
  users,
} from '../db/schema/index.js';
import { signal } from '../realtime/signals.js';
import { ProjectService } from './project.service.js';
import { ProjectAccessService } from './project-access.service.js';

/**
 * Who holds which role in a project (T-PRJ-07, TL-65): people or whole groups, managed by the
 * project's administration like the roles of a wiki space (E-60).
 */
/** Space level for a project role when sharing the linked spaces (TL-68). */
const SHARED_SPACE_ROLE: Record<ProjectRole, SpaceRole> = {
  administrators: 'administrators',
  developers: 'editors',
  users: 'commenters',
};

@Injectable()
export class ProjectMemberService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectAccessService) private readonly access: ProjectAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(AccessService) private readonly globalAccess: AccessService,
  ) {}

  private async administered(principal: Principal, key: string) {
    const project = await this.projects.findBrowsable(principal, key);
    await this.access.require(principal, project.id, 'administer');
    return project;
  }

  async list(principal: Principal, key: string): Promise<ProjectMember[]> {
    const project = await this.administered(principal, key);
    const rows = await this.database.db
      .select({
        id: projectRoleMembers.id,
        role: projectRoleMembers.role,
        userId: users.id,
        userName: users.displayName,
        external: users.external,
        groupId: groups.id,
        groupName: groups.name,
      })
      .from(projectRoleMembers)
      .leftJoin(users, eq(users.id, projectRoleMembers.userId))
      .leftJoin(groups, eq(groups.id, projectRoleMembers.groupId))
      .where(eq(projectRoleMembers.projectId, project.id))
      .orderBy(asc(projectRoleMembers.role), asc(users.displayName), asc(groups.name));
    return rows.map((row) => ({
      id: row.id,
      role: row.role,
      user: row.userId ? { id: row.userId, displayName: row.userName ?? '' } : null,
      group: row.groupId ? { id: row.groupId, name: row.groupName ?? '' } : null,
      external: row.external ?? false,
    }));
  }

  async add(
    principal: Principal,
    key: string,
    request: AddProjectMemberRequest,
  ): Promise<ProjectMember[]> {
    const project = await this.administered(principal, key);
    const db = this.database.db;
    const userId = 'userId' in request ? request.userId : null;
    const groupId = 'groupId' in request ? request.groupId : null;
    if (userId) {
      const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
      if (!user) throw new BadRequestException('Unknown user');
    } else if (groupId) {
      const [group] = await db.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId));
      if (!group) throw new BadRequestException('Unknown group');
    }
    // The unique index cannot catch this: one of user and group is always null.
    const [existing] = await db
      .select({ id: projectRoleMembers.id })
      .from(projectRoleMembers)
      .where(
        and(
          eq(projectRoleMembers.projectId, project.id),
          eq(projectRoleMembers.role, request.role),
          userId ? eq(projectRoleMembers.userId, userId) : isNull(projectRoleMembers.userId),
          groupId ? eq(projectRoleMembers.groupId, groupId) : isNull(projectRoleMembers.groupId),
        ),
      );
    if (existing) throw new ConflictException('This role is already assigned');
    await db
      .insert(projectRoleMembers)
      .values({ id: uuidv7(), projectId: project.id, role: request.role, userId, groupId });
    await this.audit.record({
      action: 'project.role-granted',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'project',
      targetId: project.id,
      details: { ...request },
    });
    if (request.shareSpace)
      await this.shareSpaces(principal, project.id, request.role, userId, groupId);
    return this.list(principal, key);
  }

  /**
   * The same level in the spaces linked to the project (TL-68, E-131): users comment, developers
   * edit, administrators administer. Only spaces the caller administers; a level already held
   * there stays.
   */
  private async shareSpaces(
    principal: Principal,
    projectId: string,
    role: ProjectRole,
    userId: string | null,
    groupId: string | null,
  ): Promise<void> {
    const db = this.database.db;
    const isAdmin = await this.globalAccess.isAdmin(principal);
    const linked = await db
      .select({ id: spaces.id, key: spaces.key })
      .from(spaces)
      .where(
        and(
          eq(spaces.projectId, projectId),
          isAdmin
            ? undefined
            : sql`exists (select 1 from ${spaceRoleMembers} m
                where m.space_id = ${spaces.id} and m.role = 'administrators'
                  and (m.user_id = ${principal.userId} or m.group_id in (
                    select ${groupMembers.groupId} from ${groupMembers}
                    where ${groupMembers.userId} = ${principal.userId})))`,
        ),
      );
    const spaceRole = SHARED_SPACE_ROLE[role];
    for (const space of linked) {
      const [held] = await db
        .select({ id: spaceRoleMembers.id })
        .from(spaceRoleMembers)
        .where(
          and(
            eq(spaceRoleMembers.spaceId, space.id),
            eq(spaceRoleMembers.role, spaceRole),
            userId ? eq(spaceRoleMembers.userId, userId) : isNull(spaceRoleMembers.userId),
            groupId ? eq(spaceRoleMembers.groupId, groupId) : isNull(spaceRoleMembers.groupId),
          ),
        );
      if (held) continue;
      await db
        .insert(spaceRoleMembers)
        .values({ id: uuidv7(), spaceId: space.id, role: spaceRole, userId, groupId });
      await this.audit.record({
        action: 'space.role-granted',
        actorId: principal.userId,
        via: principal.via,
        targetType: 'space',
        targetId: space.id,
        details: { role: spaceRole, userId, groupId, fromProject: true },
      });
      await signal(db, { type: 'space', spaceKey: space.key });
    }
  }

  /** The last administrator assignment stays, so the project never becomes unmanageable. */
  async remove(principal: Principal, key: string, memberId: string): Promise<void> {
    const project = await this.administered(principal, key);
    const db = this.database.db;
    const [member] = await db
      .select()
      .from(projectRoleMembers)
      .where(
        and(eq(projectRoleMembers.id, memberId), eq(projectRoleMembers.projectId, project.id)),
      );
    if (!member) throw new NotFoundException('Role assignment not found');
    if (member.role === 'administrators') {
      const [admins] = await db
        .select({ total: count() })
        .from(projectRoleMembers)
        .where(
          and(
            eq(projectRoleMembers.projectId, project.id),
            eq(projectRoleMembers.role, 'administrators'),
          ),
        );
      if ((admins?.total ?? 0) <= 1) {
        throw new ConflictException('A project needs at least one administrator');
      }
    }
    await db.delete(projectRoleMembers).where(eq(projectRoleMembers.id, memberId));
    await this.audit.record({
      action: 'project.role-revoked',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'project',
      targetId: project.id,
      details: { role: member.role, userId: member.userId, groupId: member.groupId },
    });
  }
}
