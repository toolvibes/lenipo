import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { SecuritySettings } from '@tasklore/shared';
import { eq, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AppConfig } from '../core/config.js';
import type { Principal } from '../core/http/principal.js';
import { CONFIG, DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { groups, systemSettings } from '../db/schema/index.js';

const KEY = 'security';
const CACHE_MS = 10_000;

/**
 * Sign-in rules of the instance (TL-18, E-100): session lifetimes and the groups that must use
 * two-factor sign-in. Defaults come from the environment (SESSION_IDLE_HOURS, SESSION_MAX_DAYS).
 */
@Injectable()
export class SecuritySettingsService {
  private cached: { at: number; value: SecuritySettings } | undefined;

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async get(): Promise<SecuritySettings> {
    if (this.cached && Date.now() - this.cached.at < CACHE_MS) return this.cached.value;
    const [row] = await this.database.db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, KEY));
    const value: SecuritySettings = {
      sessionIdleHours: this.config.SESSION_IDLE_HOURS,
      sessionMaxDays: this.config.SESSION_MAX_DAYS,
      twoFactorGroupIds: [],
      ...((row?.value as Partial<SecuritySettings>) ?? {}),
    };
    this.cached = { at: Date.now(), value };
    return value;
  }

  async set(principal: Principal, value: SecuritySettings): Promise<SecuritySettings> {
    const ids = [...new Set(value.twoFactorGroupIds)];
    if (ids.length > 0) {
      const found = await this.database.db.select({ id: groups.id }).from(groups);
      if (ids.some((id) => !found.some((group) => group.id === id))) {
        throw new BadRequestException('Unknown group');
      }
    }
    const next = { ...value, twoFactorGroupIds: ids };
    await this.database.db
      .insert(systemSettings)
      .values({ key: KEY, value: next })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: next, updatedAt: sql`now()` },
      });
    this.cached = undefined;
    await this.audit.record({
      action: 'system.security_settings_changed',
      actorId: principal.userId,
      via: principal.via,
      details: next,
    });
    return next;
  }
}
