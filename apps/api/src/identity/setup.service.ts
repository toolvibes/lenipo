import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { SetupRequest } from '@tasklore/shared';
import { count, eq, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AuditService } from '../audit/audit.service.js';
import type { AppConfig } from '../core/config.js';
import type { Logger } from '../core/logger.js';
import { CONFIG, DATABASE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle, Executor } from '../db/client.js';
import { globalPermissionGrants, groupMembers, systemSettings, users } from '../db/schema/index.js';
import { ADMINISTRATORS_GROUP, GroupService, USERS_GROUP } from './group.service.js';
import { PasswordService } from './password.service.js';
import { constantTimeEquals, setupCode, sha256 } from './secrets.js';

const SETUP_KEY = 'setup';
const INSTANCE_KEY = 'instance';
const SETUP_LOCK_KEY = 7_211_043;
const CODE_LIFETIME_MS = 24 * 60 * 60 * 1000;

interface StoredSetupCode {
  codeHash: string;
  expiresAt: string;
}

function normalizeCode(code: string): string {
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * First-run setup (decision E-24): while no system administrator exists, the server prints a
 * one-time code to its log. Whoever can read the log can create the first administrator.
 */
@Injectable()
export class SetupService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(GroupService) private readonly groupService: GroupService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async isRequired(db: Executor = this.database.db): Promise<boolean> {
    const [row] = await db
      .select({ admins: count() })
      .from(groupMembers)
      .innerJoin(globalPermissionGrants, eq(globalPermissionGrants.groupId, groupMembers.groupId))
      .where(eq(globalPermissionGrants.permission, 'system-admin'));
    return (row?.admins ?? 0) === 0;
  }

  /** Issues a fresh setup code if setup is still required. Called on every API start. */
  async issueCode(): Promise<string | null> {
    if (!(await this.isRequired())) return null;
    const code = setupCode();
    const value: StoredSetupCode = {
      codeHash: sha256(normalizeCode(code)),
      expiresAt: new Date(Date.now() + CODE_LIFETIME_MS).toISOString(),
    };
    await this.database.db
      .insert(systemSettings)
      .values({ key: SETUP_KEY, value })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedAt: sql`now()` } });
    const url = `${this.config.PUBLIC_URL ?? `http://localhost:${this.config.API_PORT}`}/setup`;
    this.logger.warn(
      { setupUrl: url, setupCode: code },
      `Setup required. Open ${url} and enter the setup code ${code} (valid for 24 hours).`,
    );
    return code;
  }

  /** Creates the first administrator. Returns the new user's id. */
  async complete(request: SetupRequest, ip: string | null): Promise<string> {
    const passwordHash = await this.passwords.hash(request.admin.password);
    const userId = await this.database.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${SETUP_LOCK_KEY})`);
      if (!(await this.isRequired(tx))) {
        throw new ConflictException('Setup has already been completed');
      }
      const [stored] = await tx
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, SETUP_KEY));
      const value = stored?.value as StoredSetupCode | undefined;
      const valid =
        value !== undefined &&
        new Date(value.expiresAt).getTime() > Date.now() &&
        constantTimeEquals(value.codeHash, sha256(normalizeCode(request.token)));
      if (!valid) {
        throw new ForbiddenException({
          message: 'Invalid or expired setup code',
          type: 'urn:tasklore:problem:setup-code',
        });
      }

      await this.groupService.ensureBuiltIns(tx);
      const id = uuidv7();
      await tx.insert(users).values({
        id,
        email: request.admin.email,
        displayName: request.admin.displayName,
        passwordHash,
      });
      const groupIds = await this.groupService.idsByName([ADMINISTRATORS_GROUP, USERS_GROUP], tx);
      await tx.insert(groupMembers).values(groupIds.map((groupId) => ({ groupId, userId: id })));
      const instance = { name: request.instanceName };
      await tx
        .insert(systemSettings)
        .values({ key: INSTANCE_KEY, value: instance })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: instance, updatedAt: sql`now()` },
        });
      await tx.delete(systemSettings).where(eq(systemSettings.key, SETUP_KEY));
      return id;
    });
    await this.audit.record({
      action: 'setup.completed',
      actorId: userId,
      targetType: 'user',
      targetId: userId,
      ip,
      details: { instanceName: request.instanceName },
    });
    return userId;
  }
}
