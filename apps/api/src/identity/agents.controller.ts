import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import {
  Agent,
  AgentBudget,
  CreateAgentRequest,
  CreatedToken,
  CreateTokenRequest,
  PauseRequest,
  TokenInfo,
  UpdateAgentRequest,
} from '@toolvibes/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { AccessService } from '../access/access.service.js';
import { RequireGlobal } from '../access/require-global.js';
import { AuditService } from '../audit/audit.service.js';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { AgentService } from './agent.service.js';
import { clientOf } from './request-guards.js';
import { TokenService } from './token.service.js';

/** Accounts of AI agents and their tokens (TL-92, E-144). */
@Controller('agents')
export class AgentsController {
  constructor(
    @Inject(AgentService) private readonly agents: AgentService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Endpoint({
    tag: 'Agents',
    summary: 'List the AI agents',
    description: 'With vendor, model and responsible person; the web app marks them by this list.',
    response: z.array(Agent),
  })
  @RequireGlobal('browse-users')
  @Get()
  list(): Promise<Agent[]> {
    return this.agents.list();
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'Create an AI agent',
    description:
      'A user of the kind "agent" without password or sign-in. It joins only the groups named, not "users"; give it projects through their roles.',
    response: Agent,
  })
  @RequireGlobal('admin')
  @Post()
  @HttpCode(201)
  async create(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(CreateAgentRequest) body: CreateAgentRequest,
    @Req() request: Request,
  ): Promise<Agent> {
    const id = await this.agents.create(body, principal.userId);
    const agent = await this.agents.get(id);
    await this.audit.record({
      action: 'agent.created',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'user',
      targetId: id,
      ip: clientOf(request).ip,
      details: { name: agent.displayName, vendor: agent.vendor, ownerId: agent.owner?.id },
    });
    return agent;
  }

  @Endpoint({ tag: 'Agents', summary: 'Change an AI agent', response: Agent })
  @RequireGlobal('admin')
  @Patch(':id')
  async update(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @ValidBody(UpdateAgentRequest) body: UpdateAgentRequest,
  ): Promise<Agent> {
    await this.agents.update(id, body);
    await this.audit.record({
      action: 'agent.updated',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'user',
      targetId: id,
      details: body,
    });
    return this.agents.get(id);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'List the tokens of an AI agent',
    description: 'For its responsible person and administrators.',
    response: z.array(TokenInfo),
  })
  @Get(':id/tokens')
  async listTokens(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TokenInfo[]> {
    await this.requireManager(principal, id);
    return this.tokens.list(id);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'Create a token for an AI agent; the secret is returned only once',
    description:
      'Needs a browser session of its responsible person or an administrator. Agent tokens never carry the `admin` scope.',
    response: CreatedToken,
  })
  @Post(':id/tokens')
  @HttpCode(201)
  async createToken(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @ValidBody(CreateTokenRequest) body: CreateTokenRequest,
    @Req() request: Request,
  ): Promise<CreatedToken> {
    await this.requireManager(principal, id, true);
    if (body.scopes.includes('admin')) {
      throw new BadRequestException('Agent tokens cannot carry the admin scope');
    }
    const agent = await this.agents.get(id);
    if (agent.status !== 'active') throw new BadRequestException('The agent is deactivated');
    const token = await this.tokens.create(id, body);
    await this.audit.record({
      action: 'token.created',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'token',
      targetId: token.id,
      ip: clientOf(request).ip,
      details: { agentId: id, name: token.name, scopes: token.scopes, expiresAt: token.expiresAt },
    });
    return token;
  }

  @Endpoint({ tag: 'Agents', summary: 'Revoke a token of an AI agent' })
  @Delete(':id/tokens/:tokenId')
  @HttpCode(204)
  async revokeToken(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tokenId', ParseUUIDPipe) tokenId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.requireManager(principal, id, true);
    if (!(await this.tokens.revoke(id, tokenId))) throw new NotFoundException('Token not found');
    await this.audit.record({
      action: 'token.revoked',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'token',
      targetId: tokenId,
      ip: clientOf(request).ip,
      details: { agentId: id },
    });
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'Pause an AI agent (Not-Aus)',
    description:
      'For its responsible person and administrators. The agent then only reads: writing answers 423 with the reason, its claims end, its webhook rests and it takes no new work. Its tokens stay valid.',
    response: Agent,
  })
  @Put(':id/pause')
  async pause(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @ValidBody(PauseRequest) body: PauseRequest,
    @Req() request: Request,
  ): Promise<Agent> {
    await this.requireManager(principal, id);
    await this.agents.pause(id, principal.userId, body.reason);
    await this.audit.record({
      action: 'agent.paused',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'user',
      targetId: id,
      ip: clientOf(request).ip,
      details: { reason: body.reason },
    });
    return this.agents.get(id);
  }

  @Endpoint({ tag: 'Agents', summary: 'Let a paused AI agent work again', response: Agent })
  @Delete(':id/pause')
  async resume(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<Agent> {
    await this.requireManager(principal, id);
    await this.agents.resume(id);
    await this.audit.record({
      action: 'agent.resumed',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'user',
      targetId: id,
      ip: clientOf(request).ip,
    });
    return this.agents.get(id);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'Set the budget of an AI agent',
    description:
      'Limits per day and month (UTC) for newly claimed issues, minutes holding claims and reported cost; null means none. The responsible person hears at 80 % and 100 %; while a limit is reached, new claims answer 409.',
    response: Agent,
  })
  @Put(':id/budget')
  async setBudget(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @ValidBody(AgentBudget) body: AgentBudget,
  ): Promise<Agent> {
    await this.requireManager(principal, id);
    await this.agents.update(id, { budget: body });
    await this.audit.record({
      action: 'agent.budget-set',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'user',
      targetId: id,
      details: body,
    });
    return this.agents.get(id);
  }

  /** The responsible person or an administrator; minting and revoking only in the browser. */
  private async requireManager(principal: Principal, agentId: string, mint = false) {
    if (mint && principal.via !== 'session') {
      throw new ForbiddenException('Managing tokens requires a browser session');
    }
    const owner = await this.agents.isOwner(agentId, principal.userId);
    if (!owner && !(await this.access.isAdmin(principal))) {
      throw new ForbiddenException('Only the responsible person or an administrator');
    }
  }
}
