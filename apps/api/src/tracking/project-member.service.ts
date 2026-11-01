import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AddProjectMemberRequest, ProjectMember } from '@toolvibes/shared';
import { and, asc, count, eq, isNull } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { groups, projectRoleMembers, users } from '../db/schema/index.js';
import { ProjectService } from './project.service.js';
import { ProjectAccessService } from './project-access.service.js';

/**
 * Who holds which role in a project (T-PRJ-07, TL-65): people or whole groups, managed by the
 * project's administration like the roles of a wiki space (E-60).
 */
@Injectable()
export class ProjectMemberService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectAccessService) private readonly access: ProjectAccessService,
    @Inject(AuditService) private readonly audit: AuditService,
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
    return this.list(principal, key);
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
