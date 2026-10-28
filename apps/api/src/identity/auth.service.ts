import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { LoginRequest } from '@tasklore/shared';
import { AuditService } from '../audit/audit.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';
import { UserService } from './user.service.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(UserService) private readonly users: UserService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** Checks credentials and opens a session. One message for every failure, so emails stay private. */
  async login(request: LoginRequest, client: { ip: string | null; userAgent: string | null }) {
    const user = await this.users.findForLogin(request.email);
    const passwordOk = await this.passwords.verify(user?.passwordHash, request.password);
    if (!user || !passwordOk || user.status !== 'active') {
      await this.audit.record({
        action: 'auth.login_failed',
        actorId: user?.id ?? null,
        ip: client.ip,
        details: { email: request.email },
      });
      throw new UnauthorizedException({
        message: 'Invalid email or password',
        type: 'urn:tasklore:problem:invalid-credentials',
      });
    }
    const session = await this.sessions.create(user.id, 'password', client);
    await this.users.recordLogin(user.id);
    await this.audit.record({
      action: 'auth.login',
      actorId: user.id,
      via: 'session',
      ip: client.ip,
    });
    return { userId: user.id, session };
  }
}
