import { Inject, Injectable } from '@nestjs/common';
import type { WorkingTime } from '@toolvibes/shared';
import { DEFAULT_WORKING_TIME } from '@toolvibes/tql';
import { eq, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { systemSettings } from '../db/schema/index.js';

const KEY = 'time-tracking';
const CACHE_MS = 30_000;

/** Hours per day and days per week for durations (E-47), an instance setting. */
@Injectable()
export class WorkingTimeService {
  private cached: { at: number; value: WorkingTime } | undefined;

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async get(): Promise<WorkingTime> {
    if (this.cached && Date.now() - this.cached.at < CACHE_MS) return this.cached.value;
    const [row] = await this.database.db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, KEY));
    const value = { ...DEFAULT_WORKING_TIME, ...((row?.value as Partial<WorkingTime>) ?? {}) };
    this.cached = { at: Date.now(), value };
    return value;
  }

  async set(principal: Principal, value: WorkingTime): Promise<WorkingTime> {
    await this.database.db
      .insert(systemSettings)
      .values({ key: KEY, value })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedAt: sql`now()` } });
    this.cached = undefined;
    await this.audit.record({
      action: 'settings.time_tracking_changed',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'setting',
      targetId: KEY,
      details: { ...value },
    });
    return this.get();
  }
}
