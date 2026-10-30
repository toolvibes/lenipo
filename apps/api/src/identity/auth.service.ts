import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { ChangePasswordRequest, LoginRequest, PasswordChanged } from '@tasklore/shared';
import { eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { users } from '../db/schema/index.js';
import { AttemptLimiter } from './attempt-limiter.js';
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
    @Inject(AttemptLimiter) private readonly limiter: AttemptLimiter,
    @Inject(DATABASE) private readonly database: DatabaseHandle,
  ) {}

  /** Checks credentials and opens a session. One message for every failure, so emails stay private. */
  async login(request: LoginRequest, client: { ip: string | null; userAgent: string | null }) {
    const user = await this.users.findForLogin(request.email);
    await this.limiter.check({ userId: user?.id, email: request.email, ip: client.ip });
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

  /**
   * Changes the caller's own password (TL-59, E-80): only with the current one, limited like the
   * login, and every other session of the person ends; access tokens stay.
   */
  async changePassword(
    userId: string,
    sessionId: string,
    request: ChangePasswordRequest,
    client: { ip: string | null },
  ): Promise<PasswordChanged> {
    const [user] = await this.database.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId));
    if (!user?.passwordHash) {
      throw new ConflictException('This account signs in without a local password');
    }
    await this.limiter.check({ userId, ip: client.ip });
    if (!(await this.passwords.verify(user.passwordHash, request.currentPassword))) {
      await this.audit.record({
        action: 'auth.password_change_failed',
        actorId: userId,
        via: 'session',
        ip: client.ip,
      });
      throw new ForbiddenException({
        message: 'The current password is wrong',
        type: 'urn:tasklore:problem:invalid-credentials',
      });
    }
    if (await this.passwords.verify(user.passwordHash, request.newPassword)) {
      throw new ConflictException('The new password is the current one');
    }
    await this.database.db
      .update(users)
      .set({ passwordHash: await this.passwords.hash(request.newPassword), updatedAt: new Date() })
      .where(eq(users.id, userId));
    const endedSessions = await this.sessions.revokeOthers(userId, sessionId);
    await this.audit.record({
      action: 'auth.password_changed',
      actorId: userId,
      via: 'session',
      ip: client.ip,
      details: { endedSessions },
    });
    return { endedSessions };
  }
}
