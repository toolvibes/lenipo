import { Controller, Get, Inject, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import {
  ProjectAgentSettings,
  SetAgentRolesRequest,
  UpdateProjectAgentSettings,
} from '@toolvibes/shared';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { AgentRoleService } from './agent-roles.service.js';

/** Agent roles and the sprint approval setting of a project (TL-96, E-148). */
@Controller('projects/:key/agent-settings')
export class AgentRolesController {
  constructor(@Inject(AgentRoleService) private readonly roles: AgentRoleService) {}

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
    summary: 'Change whether agents need approval for sprints',
    description: 'Requires the project permission `administer`.',
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
}
