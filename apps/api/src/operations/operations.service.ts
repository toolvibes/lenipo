import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import {
  Announcement,
  FeatureFlags,
  type InstanceNotice,
  MaintenanceMode,
  type ModuleName,
  RateLimitSettings,
} from '@tasklore/shared';
import { and, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import type { AppConfig } from '../core/config.js';
import { CONFIG, DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { personalAccessTokens, systemSettings } from '../db/schema/index.js';
import { type Counter, MemoryCounter, ValkeyCounter } from './counter.js';

const KEYS = {
  modules: 'feature-flags',
  rateLimits: 'rate-limits',
  maintenance: 'maintenance-mode',
  announcement: 'announcement',
} as const;

interface Snapshot {
  modules: FeatureFlags;
  rateLimits: RateLimitSettings;
  maintenance: MaintenanceMode;
  announcement: Announcement & { version: string };
  tokenLimits: Map<string, { perMinute: number | null; perDay: number | null }>;
}

/** How long each API instance trusts what it read; changes reach all instances within it. */
const CACHE_MS = 5_000;

/**
 * Instance-wide switches (TL-40, E-121): modules, request limits, maintenance mode and the
 * announcement banner, read on every request from a short cache.
 */
@Injectable()
export class OperationsService implements OnApplicationShutdown {
  readonly counter: Counter;
  private cached: { at: number; value: Promise<Snapshot> } | undefined;

  constructor(
    @Inject(CONFIG) readonly config: AppConfig,
    @Inject(DATABASE) private readonly database: DatabaseHandle,
  ) {
    this.counter = config.REDIS_URL ? new ValkeyCounter(config.REDIS_URL) : new MemoryCounter();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.counter.close();
  }

  snapshot(): Promise<Snapshot> {
    if (!this.cached || Date.now() - this.cached.at > CACHE_MS) {
      const value = this.load();
      this.cached = { at: Date.now(), value };
      value.catch(() => {
        this.cached = undefined;
      });
    }
    return this.cached.value;
  }

  private async load(): Promise<Snapshot> {
    const db = this.database.db;
    const rows = await db.select().from(systemSettings);
    const value = (key: string) => rows.find((row) => row.key === key);
    const announcement = value(KEYS.announcement);
    const limited = await db
      .select({
        id: personalAccessTokens.id,
        perMinute: personalAccessTokens.rateLimitPerMinute,
        perDay: personalAccessTokens.dailyQuota,
      })
      .from(personalAccessTokens)
      .where(
        and(
          isNull(personalAccessTokens.revokedAt),
          or(
            isNotNull(personalAccessTokens.rateLimitPerMinute),
            isNotNull(personalAccessTokens.dailyQuota),
          ),
        ),
      );
    return {
      modules: FeatureFlags.parse(value(KEYS.modules)?.value ?? {}),
      rateLimits: RateLimitSettings.parse(value(KEYS.rateLimits)?.value ?? {}),
      maintenance: MaintenanceMode.parse(value(KEYS.maintenance)?.value ?? {}),
      announcement: {
        ...Announcement.parse(announcement?.value ?? {}),
        version: announcement?.updatedAt.toISOString() ?? '',
      },
      tokenLimits: new Map(limited.map(({ id, ...limits }) => [id, limits])),
    };
  }

  private async save(key: string, value: unknown): Promise<void> {
    await this.database.db
      .insert(systemSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedAt: new Date() } });
    this.cached = undefined;
  }

  async moduleEnabled(name: ModuleName): Promise<boolean> {
    return (await this.snapshot()).modules[name];
  }

  async setModules(flags: FeatureFlags): Promise<FeatureFlags> {
    await this.save(KEYS.modules, flags);
    return flags;
  }

  async setRateLimits(limits: RateLimitSettings): Promise<RateLimitSettings> {
    await this.save(KEYS.rateLimits, limits);
    return limits;
  }

  async setMaintenance(mode: MaintenanceMode): Promise<MaintenanceMode> {
    await this.save(KEYS.maintenance, mode);
    return mode;
  }

  async setAnnouncement(announcement: Announcement): Promise<Announcement> {
    await this.save(KEYS.announcement, announcement);
    return announcement;
  }

  async notice(now = new Date()): Promise<InstanceNotice> {
    const { modules, maintenance, announcement } = await this.snapshot();
    const due =
      announcement.text.trim() !== '' &&
      (!announcement.startsAt || new Date(announcement.startsAt) <= now) &&
      (!announcement.endsAt || new Date(announcement.endsAt) > now);
    return { modules, maintenance, announcement: due ? announcement : null };
  }

  /**
   * Counts one request against a token's daily quota; returns false once it is used up. Only
   * tokens with a quota are written to.
   */
  async withinDailyQuota(tokenId: string, perDay: number): Promise<boolean> {
    const [row] = await this.database.db
      .update(personalAccessTokens)
      .set({
        quotaUsed: sql`case when ${personalAccessTokens.quotaDay} = (now() at time zone 'utc')::date then ${personalAccessTokens.quotaUsed} + 1 else 1 end`,
        quotaDay: sql`(now() at time zone 'utc')::date`,
      })
      .where(eq(personalAccessTokens.id, tokenId))
      .returning({ used: personalAccessTokens.quotaUsed });
    return (row?.used ?? 0) <= perDay;
  }

  /** Forgets cached token limits after an administrator changed them. */
  invalidate(): void {
    this.cached = undefined;
  }
}
