import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AccessCheckRequest,
  AccessCheckResult,
  AccessCheckStep,
  ProjectPermission,
  SpacePermission,
} from '@toolvibes/shared';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { AccessService } from '../access/access.service.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  DEFAULT_PERMISSION_SCHEME_ID,
  groupMembers,
  groups,
  issues,
  pageRestrictions,
  pages,
  permissionSchemeGrants,
  permissionSchemes,
  projectRoleMembers,
  projects,
  securityLevels,
  spaceRoleMembers,
  spaces,
  users,
} from '../db/schema/index.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';
import { passesEditList, seesPage } from './page-restrictions.js';
import { SpaceAccessService } from './space-access.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Explains a permission for one person (TL-15, P-PRM-05, E-96): the facts that lead to the
 * verdict, in the order the checks run. The verdict comes from the same services the app uses,
 * so explanation and behaviour cannot drift apart.
 */
@Injectable()
export class AccessCheckService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(SpaceAccessService) private readonly spaceAccess: SpaceAccessService,
  ) {}

  async check(request: AccessCheckRequest): Promise<AccessCheckResult> {
    const db = this.database.db;
    const [user] = await db
      .select({ id: users.id, displayName: users.displayName, status: users.status })
      .from(users)
      .where(
        UUID.test(request.user)
          ? eq(users.id, request.user)
          : eq(sql`lower(${users.email})`, request.user.toLowerCase()),
      );
    if (!user) throw new BadRequestException('Unknown user');
    const steps: AccessCheckStep[] = [];
    const step = (code: string, passed: boolean | null, params: Record<string, string> = {}) =>
      steps.push({ code, passed, params });
    const active = user.status === 'active';
    if (!active) step('inactive', false);
    const admin = await this.access.hasGlobal(user.id, 'admin');
    if (admin) step('global-admin', true);
    const groupIds = (
      await db
        .select({ id: groupMembers.groupId })
        .from(groupMembers)
        .where(eq(groupMembers.userId, user.id))
    ).map((row) => row.id);

    const granted =
      request.projectKey || request.issueKey
        ? await this.project(request, user.id, groupIds, admin, step)
        : await this.space(request, user.id, groupIds, admin, step);
    return {
      user: { id: user.id, displayName: user.displayName },
      granted: active && granted,
      steps,
    };
  }

  private async project(
    request: AccessCheckRequest,
    userId: string,
    groupIds: string[],
    admin: boolean,
    step: (code: string, passed: boolean | null, params?: Record<string, string>) => void,
  ): Promise<boolean> {
    const db = this.database.db;
    const permission: ProjectPermission = request.permission ?? 'browse';
    const [issue] = request.issueKey
      ? await db.select().from(issues).where(eq(issues.key, request.issueKey.toUpperCase()))
      : [];
    if (request.issueKey && !issue) throw new NotFoundException('Issue not found');
    const [project] = await db
      .select()
      .from(projects)
      .where(
        issue
          ? eq(projects.id, issue.projectId)
          : eq(projects.key, (request.projectKey ?? '').toUpperCase()),
      );
    if (!project) throw new NotFoundException('Project not found');

    // Roles held directly or through a group.
    const roles = await db
      .select({
        role: projectRoleMembers.role,
        userId: projectRoleMembers.userId,
        group: groups.name,
      })
      .from(projectRoleMembers)
      .leftJoin(groups, eq(groups.id, projectRoleMembers.groupId))
      .where(
        and(
          eq(projectRoleMembers.projectId, project.id),
          or(
            eq(projectRoleMembers.userId, userId),
            groupIds.length > 0 ? inArray(projectRoleMembers.groupId, groupIds) : undefined,
          ),
        ),
      );
    if (roles.length === 0) step('no-role', null, { project: project.name });
    for (const role of roles) {
      step('role', null, { role: role.role, via: role.userId ? '' : (role.group ?? '') });
    }

    // What the scheme grants for the permission, and which of it reaches the person.
    const schemeId = project.permissionSchemeId ?? DEFAULT_PERMISSION_SCHEME_ID;
    const [scheme] = await db
      .select({ name: permissionSchemes.name })
      .from(permissionSchemes)
      .where(eq(permissionSchemes.id, schemeId));
    const grants = await db
      .select({
        grantee: permissionSchemeGrants.grantee,
        role: permissionSchemeGrants.role,
        groupId: permissionSchemeGrants.groupId,
        group: groups.name,
        userId: permissionSchemeGrants.userId,
        user: users.displayName,
      })
      .from(permissionSchemeGrants)
      .leftJoin(groups, eq(groups.id, permissionSchemeGrants.groupId))
      .leftJoin(users, eq(users.id, permissionSchemeGrants.userId))
      .where(
        and(
          eq(permissionSchemeGrants.schemeId, schemeId),
          eq(permissionSchemeGrants.permission, permission),
        ),
      );
    const heldRoles = new Set(roles.map((role) => role.role));
    const describe = (grant: (typeof grants)[number]) =>
      grant.grantee === 'role'
        ? `role:${grant.role}`
        : grant.grantee === 'group'
          ? `group:${grant.group ?? ''}`
          : grant.grantee === 'user'
            ? `user:${grant.user ?? ''}`
            : `special:${grant.grantee}`;
    const matching = grants.filter(
      (grant) =>
        (grant.grantee === 'role' && grant.role && heldRoles.has(grant.role)) ||
        (grant.grantee === 'group' && grant.groupId && groupIds.includes(grant.groupId)) ||
        (grant.grantee === 'user' && grant.userId === userId) ||
        (issue && grant.grantee === 'assignee' && issue.assigneeId === userId) ||
        (issue && grant.grantee === 'reporter' && issue.reporterId === userId),
    );
    const params = { permission, scheme: scheme?.name ?? '' };
    for (const grant of matching) step('grant', true, { ...params, grantee: describe(grant) });
    if (matching.length === 0) {
      step('no-grant', admin ? null : false, {
        ...params,
        grantees: grants.map(describe).join(', '),
      });
    }

    const rights = issue
      ? await this.projectAccess.issuePermissions(userId, issue)
      : await this.projectAccess.permissions(userId, project.id);
    if (permission !== 'browse' && !rights.has('browse')) step('no-browse', false);
    let granted = rights.has(permission) && rights.has('browse');

    // Issue security is checked for everyone, administrators included (E-94).
    if (issue?.securityLevelId) {
      const [level] = await db
        .select({ name: securityLevels.name })
        .from(securityLevels)
        .where(eq(securityLevels.id, issue.securityLevelId));
      const sees = await this.projectAccess.seesIssue(userId, issue.id);
      step('security', sees, { level: level?.name ?? '' });
      granted &&= sees;
    }
    return granted;
  }

  private async space(
    request: AccessCheckRequest,
    userId: string,
    groupIds: string[],
    admin: boolean,
    step: (code: string, passed: boolean | null, params?: Record<string, string>) => void,
  ): Promise<boolean> {
    const db = this.database.db;
    const permission: SpacePermission = request.spacePermission ?? 'view';
    const [page] = request.pageId
      ? await db
          .select()
          .from(pages)
          .where(and(eq(pages.id, request.pageId), isNull(pages.deletedAt)))
      : [];
    if (request.pageId && !page) throw new NotFoundException('Page not found');
    const [space] = await db
      .select()
      .from(spaces)
      .where(
        page ? eq(spaces.id, page.spaceId) : eq(spaces.key, (request.spaceKey ?? '').toUpperCase()),
      );
    if (!space) throw new NotFoundException('Space not found');

    const roles = await db
      .select({ role: spaceRoleMembers.role, userId: spaceRoleMembers.userId, group: groups.name })
      .from(spaceRoleMembers)
      .leftJoin(groups, eq(groups.id, spaceRoleMembers.groupId))
      .where(
        and(
          eq(spaceRoleMembers.spaceId, space.id),
          or(
            eq(spaceRoleMembers.userId, userId),
            groupIds.length > 0 ? inArray(spaceRoleMembers.groupId, groupIds) : undefined,
          ),
        ),
      );
    if (roles.length === 0 && !admin) step('no-space-role', null, { space: space.name });
    for (const role of roles) {
      step('space-role', null, { role: role.role, via: role.userId ? '' : (role.group ?? '') });
    }
    const rights = await this.spaceAccess.permissions(userId, space.id);
    step('space-permission', rights.has(permission), { permission, space: space.name });
    let granted = rights.has(permission);
    if (!page) return granted;

    // View lists of the page and every page above it; nobody bypasses them (E-95).
    const chain: Array<{ id: string; title: string }> = [];
    let current: { id: string; title: string; parentId: string | null } | undefined = page;
    while (current) {
      chain.unshift({ id: current.id, title: current.title });
      const parentId: string | null = current.parentId;
      [current] = parentId
        ? await db
            .select({ id: pages.id, title: pages.title, parentId: pages.parentId })
            .from(pages)
            .where(eq(pages.id, parentId))
        : [];
    }
    const restricted = await db
      .select({ pageId: pageRestrictions.pageId, kind: pageRestrictions.kind })
      .from(pageRestrictions)
      .where(
        inArray(
          pageRestrictions.pageId,
          chain.map((entry) => entry.id),
        ),
      );
    for (const entry of chain) {
      if (!restricted.some((row) => row.pageId === entry.id && row.kind === 'view')) continue;
      const sees = await seesPage(db, userId, entry.id);
      step('page-view', sees, { page: entry.title });
    }
    granted &&= await seesPage(db, userId, page.id);
    if (permission === 'edit' || permission === 'administer') {
      if (restricted.some((row) => row.pageId === page.id && row.kind === 'edit')) {
        const may = await passesEditList(db, userId, page.id);
        step('page-edit', may, { page: page.title });
        if (permission === 'edit') granted &&= may;
      }
    }
    return granted;
  }
}
