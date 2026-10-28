import { Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { LoginRequest, type Me } from '@tasklore/shared';
import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service.js';
import type { AppConfig } from '../core/config.js';
import { CurrentPrincipal, Public, ValidBody } from '../core/http/decorators.js';
import type { Principal } from '../core/http/principal.js';
import { CONFIG } from '../core/tokens.js';
import { AuthService } from './auth.service.js';
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
  ) {}

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
}
