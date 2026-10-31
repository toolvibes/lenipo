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
  ChangePasswordRequest,
  CreatedToken,
  CreateTokenRequest,
  Me,
  PasswordChanged,
  RecoveryCodes,
  SessionInfo,
  TokenInfo,
  TwoFactorCodeRequest,
  TwoFactorSetup,
  UpdateMeRequest,
} from '@tasklore/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { AllowPartialSession } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { clientOf } from './request-guards.js';
import { SessionService } from './session.service.js';
import { TokenService } from './token.service.js';
import { TwoFactorService } from './two-factor.service.js';
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
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(TwoFactorService) private readonly twoFactor: TwoFactorService,
  ) {}

  @Endpoint({ tag: 'Me', summary: 'Get the signed-in user', response: Me })
  @AllowPartialSession('second-factor', 'setup-2fa')
  @Get()
  me(@CurrentPrincipal() principal: Principal): Promise<Me> {
    return this.users.me(
      principal.userId,
      principal.via === 'automation' ? 'token' : principal.via,
      principal.via === 'session' ? principal.stage : undefined,
    );
  }

  @Endpoint({
    tag: 'Me',
    summary: 'Start setting up two-factor sign-in: a secret for the authenticator app',
    response: TwoFactorSetup,
  })
  @AllowPartialSession('setup-2fa')
  @Post('2fa/setup')
  @HttpCode(200)
  setupTwoFactor(@CurrentPrincipal() principal: Principal): Promise<TwoFactorSetup> {
    requireSession(principal);
    return this.twoFactor.setup(principal.userId);
  }

  @Endpoint({
    tag: 'Me',
    summary: 'Turn two-factor sign-in on with a first code; returns recovery codes once',
    response: RecoveryCodes,
  })
  @AllowPartialSession('setup-2fa')
  @Post('2fa/enable')
  @HttpCode(200)
  async enableTwoFactor(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(TwoFactorCodeRequest) body: TwoFactorCodeRequest,
  ): Promise<RecoveryCodes> {
    requireSession(principal);
    const codes = await this.twoFactor.enable(principal.userId, body.code);
    if (principal.via === 'session' && principal.stage === 'setup-2fa') {
      await this.sessions.setStage(principal.sessionId, 'full');
    }
    return { codes };
  }

  @Endpoint({ tag: 'Me', summary: 'Turn two-factor sign-in off with a valid code' })
  @Post('2fa/disable')
  @HttpCode(204)
  async disableTwoFactor(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(TwoFactorCodeRequest) body: TwoFactorCodeRequest,
  ): Promise<void> {
    requireSession(principal);
    await this.twoFactor.disable(principal.userId, body.code);
  }

  @Endpoint({
    tag: 'Me',
    summary: 'Replace the recovery codes; needs a valid code',
    response: RecoveryCodes,
  })
  @Post('2fa/recovery-codes')
  @HttpCode(200)
  async recoveryCodes(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(TwoFactorCodeRequest) body: TwoFactorCodeRequest,
  ): Promise<RecoveryCodes> {
    requireSession(principal);
    return { codes: await this.twoFactor.regenerate(principal.userId, body.code) };
  }

  @Endpoint({ tag: 'Me', summary: 'End all other sessions of the signed-in user' })
  @Delete('sessions')
  @HttpCode(204)
  async revokeOtherSessions(@CurrentPrincipal() principal: Principal): Promise<void> {
    requireSession(principal);
    if (principal.via === 'session') {
      await this.sessions.revokeOthers(principal.userId, principal.sessionId);
    }
  }

  @Endpoint({
    tag: 'Me',
    summary: 'Change name, language, time zone or shortcut setting of the signed-in user',
    response: Me,
  })
  @Patch()
  async update(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(UpdateMeRequest) body: UpdateMeRequest,
  ): Promise<Me> {
    await this.users.updateProfile(principal.userId, body);
    return this.users.me(
      principal.userId,
      principal.via === 'automation' ? 'token' : principal.via,
    );
  }

  @Endpoint({
    tag: 'Me',
    summary: 'Change the own password; other sessions end',
    description:
      'Needs the current password and a browser session. Failures count against the same limit as the login (429 when exceeded); accounts without a local password get 409. Personal access tokens stay valid.',
    response: PasswordChanged,
  })
  @Post('password')
  @HttpCode(200)
  changePassword(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(ChangePasswordRequest) body: ChangePasswordRequest,
    @Req() request: Request,
  ): Promise<PasswordChanged> {
    if (principal.via !== 'session') {
      throw new ForbiddenException('Changing the password requires a browser session');
    }
    return this.auth.changePassword(principal.userId, principal.sessionId, body, clientOf(request));
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
