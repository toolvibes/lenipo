import {
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
  Req,
} from '@nestjs/common';
import {
  CreatedToken,
  CreateTokenRequest,
  Me,
  SessionInfo,
  TokenInfo,
  UpdateMeRequest,
} from '@tasklore/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { clientOf } from './request-guards.js';
import { SessionService } from './session.service.js';
import { TokenService } from './token.service.js';
import { UserService } from './user.service.js';

/** Token-authenticated clients may read their own data but not mint or revoke credentials. */
function requireSession(principal: Principal): void {
  if (principal.via !== 'session') {
    throw new ForbiddenException('Managing sessions and tokens requires a browser session');
  }
}

@Controller('me')
export class MeController {
  constructor(
    @Inject(UserService) private readonly users: UserService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Endpoint({ tag: 'Me', summary: 'Get the signed-in user', response: Me })
  @Get()
  me(@CurrentPrincipal() principal: Principal): Promise<Me> {
    return this.users.me(principal.userId, principal.via);
  }

  @Endpoint({
    tag: 'Me',
    summary: 'Change name, language or time zone of the signed-in user',
    response: Me,
  })
  @Patch()
  async update(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(UpdateMeRequest) body: UpdateMeRequest,
  ): Promise<Me> {
    await this.users.updateProfile(principal.userId, body);
    return this.users.me(principal.userId, principal.via);
  }

  @Endpoint({
    tag: 'Me',
    summary: 'List the signed-in user’s active sessions',
    response: z.array(SessionInfo),
  })
  @Get('sessions')
  listSessions(@CurrentPrincipal() principal: Principal): Promise<SessionInfo[]> {
    requireSession(principal);
    const current = principal.via === 'session' ? principal.sessionId : undefined;
    return this.sessions.listForUser(principal.userId, current);
  }

  @Endpoint({ tag: 'Me', summary: 'End one of the signed-in user’s sessions' })
  @Delete('sessions/:id')
  @HttpCode(204)
  async revokeSession(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<void> {
    requireSession(principal);
    if (!(await this.sessions.revoke(principal.userId, id))) {
      throw new NotFoundException('Session not found');
    }
    await this.audit.record({
      action: 'session.revoked',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'session',
      targetId: id,
      ip: clientOf(request).ip,
    });
  }

  @Endpoint({
    tag: 'Me',
    summary: 'List the signed-in user’s personal access tokens',
    response: z.array(TokenInfo),
  })
  @Get('tokens')
  listTokens(@CurrentPrincipal() principal: Principal): Promise<TokenInfo[]> {
    return this.tokens.list(principal.userId);
  }

  @Endpoint({
    tag: 'Me',
    summary: 'Create a personal access token; the secret is returned only once',
    response: CreatedToken,
  })
  @Post('tokens')
  @HttpCode(201)
  async createToken(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(CreateTokenRequest) body: CreateTokenRequest,
    @Req() request: Request,
  ): Promise<CreatedToken> {
    requireSession(principal);
    const token = await this.tokens.create(principal.userId, body);
    await this.audit.record({
      action: 'token.created',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'token',
      targetId: token.id,
      ip: clientOf(request).ip,
      details: { name: token.name, scopes: token.scopes, expiresAt: token.expiresAt },
    });
    return token;
  }

  @Endpoint({ tag: 'Me', summary: 'Revoke a personal access token' })
  @Delete('tokens/:id')
  @HttpCode(204)
  async revokeToken(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ): Promise<void> {
    requireSession(principal);
    if (!(await this.tokens.revoke(principal.userId, id))) {
      throw new NotFoundException('Token not found');
    }
    await this.audit.record({
      action: 'token.revoked',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'token',
      targetId: id,
      ip: clientOf(request).ip,
    });
  }
}
