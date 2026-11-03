import { Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import {
  PauseRequest,
  ProjectAgentSettings,
  SetAgentRolesRequest,
  UpdateProjectAgentSettings,
} from '@toolvibes/shared';
import { AuditService } from '../audit/audit.service.js';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { AgentRoleService } from './agent-roles.service.js';

/** Agent roles and the sprint approval setting of a project (TL-96, E-148). */
@Controller('projects/:key/agent-settings')
export class AgentRolesController {
  constructor(
    @Inject(AgentRoleService) private readonly roles: AgentRoleService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Endpoint({
    tag: 'Agents',
    summary: 'Get the agent settings of a project',
    description:
      'Whether agents need approval to start and complete sprints, and the roles of agents in the project. An agent without roles counts as implementer.',
    response: ProjectAgentSettings,
  })
  @Get()
  getAgentSettings(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<ProjectAgentSettings> {
    return this.roles.settings(principal, key);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'Change the agent settings of a project',
    description:
      'Approval for sprints, the statuses agents do not set themselves (a person approves the transition) and where reviews move the issue. Requires the project permission `administer`.',
    response: ProjectAgentSettings,
  })
  @Put()
  updateAgentSettings(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(UpdateProjectAgentSettings) body: UpdateProjectAgentSettings,
  ): Promise<ProjectAgentSettings> {
    return this.roles.update(principal, key, body);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'Set the roles of an agent in the project',
    description:
      'planner: plan, fill and start sprints; coordinator: complete them; implementer and tester: claim work; reviewer: review. No roles: implementer. Requires `administer`.',
    response: ProjectAgentSettings,
  })
  @Put('roles/:userId')
  setAgentRoles(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @ValidBody(SetAgentRolesRequest) body: SetAgentRolesRequest,
  ): Promise<ProjectAgentSettings> {
    return this.roles.setRoles(principal, key, userId, body);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'Pause all agents in the project (Not-Aus)',
    description:
      'They then only read here: writing answers 423 with the reason and their claims in the project end. Requires `administer`.',
    response: ProjectAgentSettings,
  })
  @Put('pause')
  async pauseAgents(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(PauseRequest) body: PauseRequest,
  ): Promise<ProjectAgentSettings> {
    const settings = await this.roles.pause(principal, key, body.reason);
    await this.audit.record({
      action: 'project.agents-paused',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'project',
      targetId: key,
      details: { reason: body.reason },
    });
    return settings;
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'Let the agents of the project work again',
    response: ProjectAgentSettings,
  })
  @Delete('pause')
  async resumeAgents(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<ProjectAgentSettings> {
    const settings = await this.roles.pause(principal, key, null);
    await this.audit.record({
      action: 'project.agents-resumed',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'project',
      targetId: key,
    });
    return settings;
  }
}
