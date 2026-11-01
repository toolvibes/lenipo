import { Inject, Injectable } from '@nestjs/common';
import type { SessionInfo } from '@toolvibes/shared';
import { and, desc, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { sessions, users } from '../db/schema/index.js';
import { randomSecret, sha256 } from './secrets.js';
import { SecuritySettingsService } from './security-settings.service.js';

/** Activity updates are written at most this often per session. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/** 'full', or a sign-in that still needs a second factor or its setup (TL-18, E-100). */
export type SessionStage = 'full' | 'second-factor' | 'setup-2fa';

export interface AuthenticatedSession {
  sessionId: string;
  userId: string;
  displayName: string;
  stage: SessionStage;
}

@Injectable()
export class SessionService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(SecuritySettingsService) private readonly settings: SecuritySettingsService,
  ) {}

  /** Starts a session and returns the secret for the cookie. Only its hash is stored. */
  async create(
    userId: string,
    authMethod: 'password' | 'oidc' | 'setup',
    client: { ip?: string | null; userAgent?: string | null },
    stage: SessionStage = 'full',
  ): Promise<{ id: string; secret: string; expiresAt: Date }> {
    const secret = randomSecret();
    const id = uuidv7();
    const { sessionMaxDays } = await this.settings.get();
    const expiresAt = new Date(Date.now() + sessionMaxDays * 24 * 60 * 60 * 1000);
    await this.database.db.insert(sessions).values({
      id,
      tokenHash: sha256(secret),
      userId,
      authMethod,
      ip: client.ip ?? null,
      userAgent: client.userAgent?.slice(0, 512) ?? null,
      expiresAt,
      stage,
    });
    return { id, secret, expiresAt };
  }

  /** Resolves a cookie secret to a live session of an active user, or null. */
  async authenticate(secret: string): Promise<AuthenticatedSession | null> {
    const now = new Date();
    const { sessionIdleHours } = await this.settings.get();
    const idleCutoff = new Date(now.getTime() - sessionIdleHours * 60 * 60 * 1000);
    const [row] = await this.database.db
      .select({
        sessionId: sessions.id,
        userId: sessions.userId,
        lastSeenAt: sessions.lastSeenAt,
        displayName: users.displayName,
        stage: sessions.stage,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(
        and(
          eq(sessions.tokenHash, sha256(secret)),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
          gt(sessions.lastSeenAt, idleCutoff),
          eq(users.status, 'active'),
        ),
      );
    if (!row) return null;
    if (now.getTime() - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.database.db
        .update(sessions)
        .set({ lastSeenAt: now })
        .where(eq(sessions.id, row.sessionId));
    }
    return {
      sessionId: row.sessionId,
      userId: row.userId,
      displayName: row.displayName,
      stage: row.stage as SessionStage,
    };
  }

  /** Completes a sign-in once the second factor is done (TL-18). */
  async setStage(sessionId: string, stage: SessionStage): Promise<void> {
    await this.database.db.update(sessions).set({ stage }).where(eq(sessions.id, sessionId));
  }

  /** Ends every session of a user, e.g. by an administrator (TL-18, E-100). */
  async revokeAll(userId: string): Promise<number> {
    const result = await this.database.db
      .update(sessions)
      .set({ revokedAt: sql`now()` })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    return result.length;
  }

  async listForUser(userId: string, currentSessionId?: string): Promise<SessionInfo[]> {
    const rows = await this.database.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(sessions.lastSeenAt));
    return rows.map((row) => ({
      id: row.id,
      current: row.id === currentSessionId,
      createdAt: row.createdAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      ip: row.ip,
      userAgent: row.userAgent,
    }));
  }

  /** Ends one session of a user. Returns false if it does not exist or is not theirs. */
  async revoke(userId: string, sessionId: string): Promise<boolean> {
    const result = await this.database.db
      .update(sessions)
      .set({ revokedAt: sql`now()` })
      .where(
        and(eq(sessions.id, sessionId), eq(sessions.userId, userId), isNull(sessions.revokedAt)),
      )
      .returning({ id: sessions.id });
    return result.length > 0;
  }

  /** Ends every other active session of a user, e.g. after a password change (E-80). */
  async revokeOthers(userId: string, keepSessionId: string): Promise<number> {
    const result = await this.database.db
      .update(sessions)
      .set({ revokedAt: sql`now()` })
      .where(
        and(
          eq(sessions.userId, userId),
          ne(sessions.id, keepSessionId),
          isNull(sessions.revokedAt),
        ),
      )
      .returning({ id: sessions.id });
    return result.length;
  }
}
