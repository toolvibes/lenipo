import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { AuthProviders, LoginRequest, Me, safeRedirectPath } from '@tasklore/shared';
import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service.js';
import type { AppConfig } from '../core/config.js';
import { CurrentPrincipal, Public, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import type { Logger } from '../core/logger.js';
import { CONFIG, LOGGER } from '../core/tokens.js';
import { AuthService } from './auth.service.js';
import { OidcService } from './oidc.service.js';
import { clientOf } from './request-guards.js';
import { SessionService } from './session.service.js';
import { clearSessionCookie, setSessionCookie } from './session-cookie.js';
import { UserService } from './user.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(UserService) private readonly users: UserService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OidcService) private readonly oidc: OidcService,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  @Endpoint({ tag: 'Auth', summary: 'Sign in with email and password', response: Me })
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @ValidBody(LoginRequest) body: LoginRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Me> {
    const { userId, session } = await this.auth.login(body, clientOf(request));
    setSessionCookie(response, this.config, session.secret, session.expiresAt);
    return this.users.me(userId, 'session');
  }

  @Endpoint({ tag: 'Auth', summary: 'Sign out and end the current session' })
  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentPrincipal() principal: Principal,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    if (principal.via === 'session') {
      await this.sessions.revoke(principal.userId, principal.sessionId);
      await this.audit.record({
        action: 'auth.logout',
        actorId: principal.userId,
        via: 'session',
        ip: clientOf(request).ip,
      });
    }
    clearSessionCookie(response, this.config);
  }

  @Public()
  @Get('providers')
  @Endpoint({
    tag: 'Auth',
    summary: 'List the sign-in methods this installation offers',
    response: AuthProviders,
  })
  providers(): AuthProviders {
    return {
      password: true,
      oidc: {
        enabled: this.oidc.enabled,
        displayName: this.oidc.enabled ? this.config.OIDC_DISPLAY_NAME : null,
      },
    };
  }

  /** Browser navigation, not an API call: redirects to the identity provider. */
  @Public()
  @Get('oidc/start')
  async oidcStart(
    @Query('redirect') redirect: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const url = await this.oidc.start(safeRedirectPath(redirect) ?? '/');
    response.redirect(302, url.toString());
  }

  /** The identity provider sends the browser here; on success the session cookie is set. */
  @Public()
  @Get('oidc/callback')
  async oidcCallback(@Req() request: Request, @Res() response: Response): Promise<void> {
    const client = clientOf(request);
    try {
      const callbackUrl = new URL(request.originalUrl, this.config.PUBLIC_URL);
      const { userId, redirectTo } = await this.oidc.complete(callbackUrl, client.ip);
      const session = await this.sessions.create(userId, 'oidc', client);
      await this.users.recordLogin(userId);
      await this.audit.record({
        action: 'auth.login',
        actorId: userId,
        via: 'session',
        ip: client.ip,
        details: { method: 'oidc' },
      });
      setSessionCookie(response, this.config, session.secret, session.expiresAt);
      response.redirect(302, safeRedirectPath(redirectTo) ?? '/');
    } catch (error) {
      const denied = error instanceof ForbiddenException;
      this.logger.warn({ err: error }, 'OIDC sign-in failed');
      await this.audit.record({
        action: 'auth.login_failed',
        ip: client.ip,
        details: { method: 'oidc', reason: (error as Error).message },
      });
      response.redirect(302, `/login?error=${denied ? 'oidc_denied' : 'oidc'}`);
    }
  }
}
