import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PROJECT_PERMISSIONS, type ProjectPermission } from '@tasklore/shared';
import { and, eq, inArray, isNull, or, type SQL } from 'drizzle-orm';
import { AccessService } from '../access/access.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { groupMembers, projectRoleMembers, projects } from '../db/schema/index.js';

type Role = (typeof projectRoleMembers.$inferSelect)['role'];

/** The default permission scheme: what each project role may do. */
const ROLE_PERMISSIONS: Record<Role, readonly ProjectPermission[]> = {
  administrators: PROJECT_PERMISSIONS,
  developers: [
    'browse',
    'create-issues',
    'edit-issues',
    'transition-issues',
    'assign-issues',
    'comment',
  ],
  users: ['browse', 'create-issues', 'comment'],
};

/** Project-level permission checks; every tracking route goes through here. */
@Injectable()
export class ProjectAccessService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  /** Role assignments that apply to a user: directly or through one of their groups. */
  private memberCondition(userId: string): SQL {
    const userGroups = this.database.db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(eq(groupMembers.userId, userId));
    return or(
      eq(projectRoleMembers.userId, userId),
      inArray(projectRoleMembers.groupId, userGroups),
    ) as SQL;
  }

  async permissions(userId: string, projectId: string): Promise<Set<ProjectPermission>> {
    if (await this.access.hasGlobal(userId, 'admin')) return new Set(PROJECT_PERMISSIONS);
    const rows = await this.database.db
      .selectDistinct({ role: projectRoleMembers.role })
      .from(projectRoleMembers)
      .where(and(eq(projectRoleMembers.projectId, projectId), this.memberCondition(userId)));
    return new Set(rows.flatMap((row) => ROLE_PERMISSIONS[row.role]));
  }

  /** SQL condition limiting `projects` to those the user may browse. */
  async browsableCondition(userId: string): Promise<SQL> {
    if (await this.access.hasGlobal(userId, 'admin')) return isNull(projects.archivedAt);
    const memberships = this.database.db
      .selectDistinct({ projectId: projectRoleMembers.projectId })
      .from(projectRoleMembers)
      .where(this.memberCondition(userId));
    return and(isNull(projects.archivedAt), inArray(projects.id, memberships)) as SQL;
  }

  /**
   * Throws unless the principal holds the permission. Missing browse access looks like a
   * missing project (404), so project existence does not leak.
   */
  async require(
    principal: Principal,
    projectId: string,
    permission: ProjectPermission,
  ): Promise<Set<ProjectPermission>> {
    if (principal.via === 'token') {
      const needed = permission === 'browse' ? ['issues:read', 'issues:write'] : ['issues:write'];
      if (!principal.scopes.some((scope) => needed.includes(scope))) {
        throw new ForbiddenException(`This token lacks the ${needed.at(-1)} scope`);
      }
    }
    const granted = await this.permissions(principal.userId, projectId);
    if (!granted.has('browse')) throw new NotFoundException('Project not found');
    if (!granted.has(permission)) {
      throw new ForbiddenException(`Requires the project permission "${permission}"`);
    }
    return granted;
  }
}
