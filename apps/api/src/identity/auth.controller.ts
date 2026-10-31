import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuthProviders,
  LoginRequest,
  Me,
  safeRedirectPath,
  TwoFactorCodeRequest,
} from '@tasklore/shared';
import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service.js';
import type { AppConfig } from '../core/config.js';
import { CurrentPrincipal, Public, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import type { Logger } from '../core/logger.js';
import { CONFIG, LOGGER } from '../core/tokens.js';
import { AllowDuringMaintenance } from '../operations/operations.guard.js';
import { AttemptLimiter } from './attempt-limiter.js';
import { AllowPartialSession } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { OidcService } from './oidc.service.js';
import { clientOf } from './request-guards.js';
import { SamlService } from './saml.service.js';
import { SessionService } from './session.service.js';
import { clearSessionCookie, setSessionCookie } from './session-cookie.js';
import { TwoFactorService } from './two-factor.service.js';
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
    @Inject(TwoFactorService) private readonly twoFactor: TwoFactorService,
    @Inject(AttemptLimiter) private readonly limiter: AttemptLimiter,
    @Inject(SamlService) private readonly saml: SamlService,
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
    const { userId, session, stage } = await this.auth.login(body, clientOf(request));
    setSessionCookie(response, this.config, session.secret, session.expiresAt);
    return this.users.me(userId, 'session', stage);
  }

  @Endpoint({
    tag: 'Auth',
    summary: 'Complete a sign-in with the code from the authenticator app or a recovery code',
    description: 'After a password sign-in whose `twoFactor.pending` is `verify` (TL-18, E-100).',
    response: Me,
  })
  @AllowPartialSession('second-factor')
  @Post('2fa')
  @HttpCode(200)
  async secondFactor(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(TwoFactorCodeRequest) body: TwoFactorCodeRequest,
    @Req() request: Request,
  ): Promise<Me> {
    if (principal.via !== 'session' || principal.stage !== 'second-factor') {
      throw new BadRequestException('No sign-in is waiting for a code');
    }
    const client = clientOf(request);
    await this.limiter.check({ userId: principal.userId, ip: client.ip });
    if (!(await this.twoFactor.verify(principal.userId, body.code))) {
      await this.audit.record({
        action: 'auth.2fa_failed',
        actorId: principal.userId,
        via: 'session',
        ip: client.ip,
      });
      throw new UnauthorizedException({
        message: 'The code does not match',
        type: 'urn:tasklore:problem:invalid-credentials',
      });
    }
    await this.sessions.setStage(principal.sessionId, 'full');
    return this.users.me(principal.userId, 'session');
  }

  @Endpoint({ tag: 'Auth', summary: 'Sign out and end the current session' })
  @AllowPartialSession('second-factor', 'setup-2fa')
  @AllowDuringMaintenance()
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
  async providers(): Promise<AuthProviders> {
    return {
      password: true,
      oidc: {
        enabled: this.oidc.enabled,
        displayName: this.oidc.enabled ? this.config.OIDC_DISPLAY_NAME : null,
      },
      saml: await this.saml.enabled(),
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
