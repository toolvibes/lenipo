import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ProjectRole, UserRef } from '@toolvibes/shared';
import { PROJECT_PERMISSIONS, type ProjectPermission } from '@toolvibes/shared';
import { and, eq, ilike, inArray, isNull, or, type SQL, sql } from 'drizzle-orm';
import { AccessService, pausedError } from '../access/access.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  DEFAULT_PERMISSION_SCHEME_ID,
  globalPermissionGrants,
  groupMembers,
  issues,
  projects,
  users,
} from '../db/schema/index.js';
import { securityVisible } from './issue-security.js';
import type { RuleViewer } from './workflow.js';

export interface Relational {
  assignee: Set<ProjectPermission>;
  reporter: Set<ProjectPermission>;
}

/** Project rights plus the per-issue grants that apply to `userId` on this issue. */
export function withRelational(
  granted: Set<ProjectPermission>,
  relational: Relational,
  issue: { assigneeId: string | null; reporterId: string | null },
  userId: string,
): Set<ProjectPermission> {
  if (!granted.has('browse')) return granted;
  const all = new Set(granted);
  if (issue.assigneeId === userId) for (const entry of relational.assignee) all.add(entry);
  if (issue.reporterId === userId) for (const entry of relational.reporter) all.add(entry);
  return all;
}

/**
 * Whether a grant of the project's permission scheme (`g`) applies to a user (TL-70, E-82):
 * through a project role they hold directly or via a group, a group of theirs, or by name.
 * `project` and `user` are SQL expressions, so the same rule works for one project, as a
 * correlated condition on `projects`, and for listing people.
 */
function grantApplies(project: SQL, scheme: SQL, user: SQL): SQL {
  const userGroups = sql`select gm.group_id from group_members gm where gm.user_id = ${user}`;
  return sql`g.scheme_id = coalesce(${scheme}, ${DEFAULT_PERMISSION_SCHEME_ID}::uuid) and (
    (g.grantee = 'role' and g.role in (
      select m.role from project_role_members m
      where m.project_id = ${project} and (m.user_id = ${user} or m.group_id in (${userGroups}))))
    or (g.grantee = 'group' and g.group_id in (${userGroups}))
    or (g.grantee = 'user' and g.user_id = ${user}))`;
}

/** Project-level permission checks; every tracking route goes through here. */
@Injectable()
export class ProjectAccessService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  async permissions(userId: string, projectId: string): Promise<Set<ProjectPermission>> {
    return this.holdPaused(userId, projectId, await this.granted(userId, projectId));
  }

  /** A paused agent only reads (TL-98, E-150). */
  private async holdPaused(
    userId: string,
    projectId: string,
    granted: Set<ProjectPermission>,
  ): Promise<Set<ProjectPermission>> {
    if (granted.has('browse') && (await this.access.agentPause(userId, projectId))) {
      return new Set<ProjectPermission>(['browse']);
    }
    return granted;
  }

  /** What the permission scheme grants, without the Not-Aus of agents. */
  async granted(userId: string, projectId: string): Promise<Set<ProjectPermission>> {
    if (await this.access.hasGlobal(userId, 'admin')) return new Set(PROJECT_PERMISSIONS);
    const scheme = sql`(select p.permission_scheme_id from projects p where p.id = ${projectId})`;
    const rows = await this.database.db.execute<{ permission: ProjectPermission }>(
      sql`select distinct g.permission from permission_scheme_grants g
        where ${grantApplies(sql`${projectId}::uuid`, scheme, sql`${userId}::uuid`)}`,
    );
    return new Set([...rows].map((row) => row.permission));
  }

  /**
   * Whether the agent needs a person's approval to move an issue into this status (TL-98,
   * E-150). Runs of an approved request carry `approval:` as token id and pass.
   */
  async needsApproval(principal: Principal, projectId: string, statusId: string): Promise<boolean> {
    if ('tokenId' in principal && principal.tokenId.startsWith('approval:')) return false;
    if (!(await this.access.isAgent(principal.userId))) return false;
    const [row] = await this.database.db
      .select({ statuses: projects.agentApprovalStatusIds })
      .from(projects)
      .where(eq(projects.id, projectId));
    return row?.statuses.includes(statusId) ?? false;
  }

  /** The viewer of a project's issues, for transition conditions (TL-11). */
  async ruleViewer(userId: string, projectId: string): Promise<RuleViewer> {
    const [isAdmin, rows] = await Promise.all([
      this.access.hasGlobal(userId, 'admin'),
      this.database.db.execute<{ role: ProjectRole }>(
        sql`select distinct m.role from project_role_members m
          where m.project_id = ${projectId} and (m.user_id = ${userId}
            or m.group_id in (select gm.group_id from group_members gm where gm.user_id = ${userId}))`,
      ),
    ]);
    return { userId, isAdmin, roles: new Set([...rows].map((row) => row.role)) };
  }

  /** SQL condition limiting `projects` to those the user may browse. */
  async browsableCondition(userId: string): Promise<SQL> {
    if (await this.access.hasGlobal(userId, 'admin')) return isNull(projects.archivedAt);
    return and(
      isNull(projects.archivedAt),
      sql`exists (select 1 from permission_scheme_grants g where g.permission = 'browse' and ${grantApplies(
        sql`${projects.id}`,
        sql`${projects.permissionSchemeId}`,
        sql`${userId}::uuid`,
      )})`,
    ) as SQL;
  }

  /**
   * Active users who may browse the project under its permission scheme, and global
   * administrators. Used for assignees and @-mentions (E-39).
   */
  async browsingUsers(projectId: string, query: string, limit: number): Promise<UserRef[]> {
    const db = this.database.db;
    const scheme = sql`(select p.permission_scheme_id from projects p where p.id = ${projectId})`;
    const mayBrowse = sql`exists (select 1 from permission_scheme_grants g where g.permission = 'browse' and ${grantApplies(
      sql`${projectId}::uuid`,
      scheme,
      sql`${users.id}`,
    )})`;
    const admins = db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .innerJoin(globalPermissionGrants, eq(globalPermissionGrants.groupId, groupMembers.groupId))
      .where(inArray(globalPermissionGrants.permission, ['admin', 'system-admin']));
    const escaped = query.replace(/[\\%_]/g, (char) => `\\${char}`);
    const pattern = `%${escaped}%`;
    // Names whose first or a later word starts with the query come first ("Mi" → Mira before Admin).
    const rank = sql`case when ${users.displayName} ilike ${`${escaped}%`} then 0
      when ${users.displayName} ilike ${`% ${escaped}%`} then 1 else 2 end`;
    return db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(
        and(
          eq(users.status, 'active'),
          query ? ilike(users.displayName, pattern) : undefined,
          or(mayBrowse, inArray(users.id, admins)),
        ),
      )
      .orderBy(rank, users.displayName)
      .limit(limit);
  }

  /**
   * What the scheme gives to the assignee and the reporter of an issue (TL-72): those grants
   * apply per issue, on top of the project rights; the input allows only `ISSUE_PERMISSIONS`.
   */
  async relationalGrants(projectId: string): Promise<Relational> {
    const rows = await this.database.db.execute<{
      grantee: 'assignee' | 'reporter';
      permission: ProjectPermission;
    }>(
      sql`select g.grantee, g.permission from permission_scheme_grants g
        where g.grantee in ('assignee', 'reporter')
          and g.scheme_id = coalesce(
            (select p.permission_scheme_id from projects p where p.id = ${projectId}),
            ${DEFAULT_PERMISSION_SCHEME_ID}::uuid)`,
    );
    const grants: Relational = { assignee: new Set(), reporter: new Set() };
    for (const row of rows) grants[row.grantee].add(row.permission);
    return grants;
  }

  /** The rights on one issue: the project's, plus what its assignee or reporter gets. */
  async issuePermissions(
    userId: string,
    issue: { projectId: string; assigneeId: string | null; reporterId: string | null },
  ): Promise<Set<ProjectPermission>> {
    const granted = await this.granted(userId, issue.projectId);
    const all =
      !granted.has('browse') || (issue.assigneeId !== userId && issue.reporterId !== userId)
        ? granted
        : withRelational(granted, await this.relationalGrants(issue.projectId), issue, userId);
    return this.holdPaused(userId, issue.projectId, all);
  }

  /** Like {@link require}, but with the rights on one issue. */
  async requireForIssue(
    principal: Principal,
    issue: {
      id?: string;
      projectId: string;
      assigneeId: string | null;
      reporterId: string | null;
      securityLevelId?: string | null;
    },
    permission: ProjectPermission,
  ): Promise<Set<ProjectPermission>> {
    this.checkScope(principal, permission);
    // A level the user is not granted hides the issue like a missing one (TL-13, E-94).
    if (issue.securityLevelId && !(await this.seesIssue(principal.userId, issue.id ?? ''))) {
      throw new NotFoundException('Issue not found');
    }
    const granted = await this.issuePermissions(principal.userId, issue);
    return this.checkGranted(granted, permission, principal.userId, issue.projectId);
  }

  /** Whether issue security lets the user see the issue (TL-13, E-94). */
  async seesIssue(userId: string, issueId: string): Promise<boolean> {
    const [row] = await this.database.db
      .select({ id: issues.id })
      .from(issues)
      .where(and(eq(issues.id, issueId), securityVisible(userId)));
    return !!row;
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
    this.checkScope(principal, permission);
    const granted = await this.permissions(principal.userId, projectId);
    return this.checkGranted(granted, permission, principal.userId, projectId);
  }

  private checkScope(principal: Principal, permission: ProjectPermission) {
    if ('scopes' in principal) {
      const needed = permission === 'browse' ? ['issues:read', 'issues:write'] : ['issues:write'];
      if (!principal.scopes.some((scope) => needed.includes(scope))) {
        throw new ForbiddenException(`This token lacks the ${needed.at(-1)} scope`);
      }
    }
  }

  private async checkGranted(
    granted: Set<ProjectPermission>,
    permission: ProjectPermission,
    userId: string,
    projectId: string,
  ) {
    if (!granted.has('browse')) throw new NotFoundException('Project not found');
    if (!granted.has(permission)) {
      // Say why a paused agent may not, so it stops instead of trying again.
      const pause = await this.access.agentPause(userId, projectId);
      if (pause) throw pausedError(pause);
      throw new ForbiddenException(`Requires the project permission "${permission}"`);
    }
    return granted;
  }
}
