import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AgentRole,
  ProjectAgentSettings,
  SetAgentRolesRequest,
  UpdateProjectAgentSettings,
} from '@toolvibes/shared';
import { and, eq } from 'drizzle-orm';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { agentProfiles, projectAgentRoles, projects, users } from '../db/schema/index.js';
import { ProjectService } from './project.service.js';
import { ProjectAccessService } from './project-access.service.js';

/**
 * Roles of agents per project (TL-96, E-148): planners plan and start sprints, coordinators
 * complete them, implementers and testers claim work. People are never limited by them.
 */
@Injectable()
export class AgentRoleService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
  ) {}

  /** The agent's roles in the project; null for people. Without a row: implementer. */
  async rolesOf(projectId: string, userId: string): Promise<AgentRole[] | null> {
    const [row] = await this.database.db
      .select({ kind: users.kind, roles: projectAgentRoles.roles })
      .from(users)
      .leftJoin(
        projectAgentRoles,
        and(eq(projectAgentRoles.userId, users.id), eq(projectAgentRoles.projectId, projectId)),
      )
      .where(eq(users.id, userId));
    if (row?.kind !== 'agent') return null;
    const roles = (row.roles ?? []) as AgentRole[];
    return roles.length > 0 ? roles : ['implementer'];
  }

  /** Refuses an agent that has none of the roles; people pass. */
  async require(principal: Principal, projectId: string, allowed: AgentRole[]): Promise<void> {
    const roles = await this.rolesOf(projectId, principal.userId);
    if (roles && !roles.some((role) => allowed.includes(role))) {
      throw new ForbiddenException(
        `This agent needs the role ${allowed.join(' or ')} in this project`,
      );
    }
  }

  async isAgent(userId: string): Promise<boolean> {
    const [row] = await this.database.db
      .select({ kind: users.kind })
      .from(users)
      .where(eq(users.id, userId));
    return row?.kind === 'agent';
  }

  async settings(principal: Principal, projectKey: string): Promise<ProjectAgentSettings> {
    const project = await this.projects.findBrowsable(principal, projectKey);
    await this.projectAccess.require(principal, project.id, 'browse');
    const [row] = await this.database.db
      .select({ sprintApproval: projects.agentSprintApproval })
      .from(projects)
      .where(eq(projects.id, project.id));
    const agents = await this.database.db
      .select({
        id: users.id,
        displayName: users.displayName,
        vendor: agentProfiles.vendor,
        roles: projectAgentRoles.roles,
      })
      .from(projectAgentRoles)
      .innerJoin(users, eq(users.id, projectAgentRoles.userId))
      .innerJoin(agentProfiles, eq(agentProfiles.userId, users.id))
      .where(eq(projectAgentRoles.projectId, project.id))
      .orderBy(users.displayName);
    return {
      sprintApproval: row?.sprintApproval ?? false,
      agents: agents.map((agent) => ({
        agent: { id: agent.id, displayName: agent.displayName },
        vendor: agent.vendor,
        roles: agent.roles as AgentRole[],
      })),
    };
  }

  async update(
    principal: Principal,
    projectKey: string,
    request: UpdateProjectAgentSettings,
  ): Promise<ProjectAgentSettings> {
    const project = await this.projects.findBrowsable(principal, projectKey);
    await this.projectAccess.require(principal, project.id, 'administer');
    await this.database.db
      .update(projects)
      .set({ agentSprintApproval: request.sprintApproval })
      .where(eq(projects.id, project.id));
    return this.settings(principal, projectKey);
  }

  async setRoles(
    principal: Principal,
    projectKey: string,
    userId: string,
    request: SetAgentRolesRequest,
  ): Promise<ProjectAgentSettings> {
    const project = await this.projects.findBrowsable(principal, projectKey);
    await this.projectAccess.require(principal, project.id, 'administer');
    if (!(await this.isAgent(userId))) throw new NotFoundException('Agent not found');
    const roles = [...new Set(request.roles)];
    if (roles.length === 0) {
      await this.database.db
        .delete(projectAgentRoles)
        .where(
          and(eq(projectAgentRoles.projectId, project.id), eq(projectAgentRoles.userId, userId)),
        );
    } else {
      await this.database.db
        .insert(projectAgentRoles)
        .values({ projectId: project.id, userId, roles })
        .onConflictDoUpdate({
          target: [projectAgentRoles.projectId, projectAgentRoles.userId],
          set: { roles },
        });
    }
    return this.settings(principal, projectKey);
  }
}
