import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, gt, inArray, or, type SQL, sql } from 'drizzle-orm';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { auditLog } from '../db/schema/index.js';

/** Failed password checks that count against the limits, wherever the password was typed. */
export const FAILED_PASSWORD_ACTIONS = ['auth.login_failed', 'auth.password_change_failed'];

const WINDOW_MINUTES = 15;
const PER_ACCOUNT = 10;
const PER_IP = 50;

/**
 * Stops guessing passwords at the login and at the password change (TL-59, E-80): at most 10
 * failures per account and 50 per IP address within 15 minutes. The failures are the audit
 * log's own entries, so every API instance sees the same count without extra storage.
 */
@Injectable()
export class AttemptLimiter {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  async check(attempt: { userId?: string | null; email?: string; ip: string | null }) {
    const recent = and(
      inArray(auditLog.action, FAILED_PASSWORD_ACTIONS),
      gt(auditLog.at, sql`now() - make_interval(mins => ${WINDOW_MINUTES})`),
    );
    const account: SQL[] = [];
    if (attempt.userId) account.push(sql`${auditLog.actorId} = ${attempt.userId}`);
    if (attempt.email) account.push(sql`${auditLog.details}->>'email' = ${attempt.email}`);
    const [counts] = await this.database.db
      .select({
        account:
          account.length > 0
            ? sql<number>`count(*) filter (where ${or(...account)})::int`
            : sql<number>`0`,
        ip: attempt.ip
          ? sql<number>`count(*) filter (where ${auditLog.ip} = ${attempt.ip}::inet)::int`
          : sql<number>`0`,
      })
      .from(auditLog)
      .where(recent);
    if ((counts?.account ?? 0) >= PER_ACCOUNT || (counts?.ip ?? 0) >= PER_IP) {
      throw new HttpException(
        {
          message: `Too many failed attempts; try again in ${WINDOW_MINUTES} minutes`,
          type: 'urn:tasklore:problem:too-many-attempts',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
