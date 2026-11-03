import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  type FeatureFlags,
  MODULES,
  type ModuleName,
  ProviderLimits,
  type ProviderUsage,
} from '@toolvibes/shared';
import { and, count, eq, sql } from 'drizzle-orm';
import type { AppConfig } from '../core/config.js';
import { CONFIG, DATABASE } from '../core/tokens.js';
import type { DatabaseHandle, Executor } from '../db/client.js';
import { serviceDesks, systemSettings, users } from '../db/schema/index.js';
import { constantTimeEquals, sha256 } from '../identity/secrets.js';
import { OperationsService } from './operations.service.js';

const KEY = 'provider-limits';
const MB = 1024 * 1024;

/** 403 with its own problem type, so the web app can say which plan limit was hit. */
export function planLimit(message: string): ForbiddenException {
  return new ForbiddenException({ type: 'urn:lenipo:problem:plan-limit', message });
}

/**
 * The frame a provider sets for this instance (TL-103, E-154): seats, agents, storage, modules
 * and service desks. It takes effect at once, without a restart; without it nothing is limited.
 */
@Injectable()
export class ProviderService {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(OperationsService) private readonly operations: OperationsService,
  ) {}

  /** Whether the SETUP_TOKEN of the environment is set and matches. */
  acceptsToken(token: string): boolean {
    const expected = this.config.SETUP_TOKEN;
    return !!expected && constantTimeEquals(sha256(expected), sha256(token));
  }

  async limits(db: Executor = this.database.db): Promise<ProviderLimits | null> {
    const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, KEY));
    return row ? ProviderLimits.parse(row.value) : null;
  }

  async setLimits(limits: ProviderLimits | null): Promise<void> {
    if (limits === null) {
      await this.database.db.delete(systemSettings).where(eq(systemSettings.key, KEY));
    } else {
      await this.database.db
        .insert(systemSettings)
        .values({ key: KEY, value: limits })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: limits, updatedAt: new Date() },
        });
      // Modules the plan leaves out are switched off; their data stays.
      if (limits.modules) {
        const allowed = new Set<ModuleName>(limits.modules);
        const { modules } = await this.operations.snapshot();
        const next = Object.fromEntries(
          MODULES.map((name) => [name, modules[name] && allowed.has(name)]),
        ) as FeatureFlags;
        await this.operations.setModules(next);
      }
    }
  }

  async usage(): Promise<ProviderUsage> {
    const db = this.database.db;
    const [persons] = await db.select({ value: count() }).from(users).where(this.seatHolders());
    const [agents] = await db
      .select({ value: count() })
      .from(users)
      .where(and(eq(users.kind, 'agent'), eq(users.status, 'active')));
    const [desks] = await db.select({ value: count() }).from(serviceDesks);
    const { modules } = await this.operations.snapshot();
    return {
      persons: persons?.value ?? 0,
      agents: agents?.value ?? 0,
      storageMb: Math.round(((await this.storageBytes(db)) / MB) * 10) / 10,
      serviceDesks: desks?.value ?? 0,
      modules: MODULES.filter((name) => modules[name]),
      limits: await this.limits(db),
      measuredAt: new Date().toISOString(),
    };
  }

  /** Seats are taken by active people who are not external guests. */
  private seatHolders() {
    return and(eq(users.kind, 'person'), eq(users.status, 'active'), eq(users.external, false));
  }

  private async storageBytes(db: Executor): Promise<number> {
    const rows = await db.execute<{ bytes: string | number }>(sql`
      select coalesce((select sum(size) from issue_attachments), 0)
           + coalesce((select sum(size) from page_attachments), 0) as bytes`);
    return Number([...rows][0]?.bytes ?? 0);
  }

  /** Before someone takes a seat: a new person, a reactivation, a guest made regular. */
  async requireSeat(db: Executor = this.database.db): Promise<void> {
    const limit = (await this.limits(db))?.persons;
    if (limit === null || limit === undefined) return;
    const [taken] = await db.select({ value: count() }).from(users).where(this.seatHolders());
    if ((taken?.value ?? 0) >= limit) {
      throw planLimit(`All ${limit} seats of the plan are taken`);
    }
  }

  async requireAgent(db: Executor = this.database.db): Promise<void> {
    const limit = (await this.limits(db))?.agents;
    if (limit === null || limit === undefined) return;
    const [taken] = await db
      .select({ value: count() })
      .from(users)
      .where(and(eq(users.kind, 'agent'), eq(users.status, 'active')));
    if ((taken?.value ?? 0) >= limit) {
      throw planLimit(
        limit === 0 ? 'The plan includes no agents' : `The plan includes ${limit} agents`,
      );
    }
  }

  /** Before a file is kept. */
  async requireStorage(bytes: number): Promise<void> {
    const limit = (await this.limits())?.storageMb;
    if (limit === null || limit === undefined) return;
    if ((await this.storageBytes(this.database.db)) + bytes > limit * MB) {
      throw planLimit(`The ${limit} MB of storage in the plan are used up`);
    }
  }

  async requireModule(name: ModuleName): Promise<void> {
    const modules = (await this.limits())?.modules;
    if (modules && !modules.includes(name)) {
      throw planLimit(`The plan does not include the module ${name}`);
    }
  }

  async requireServiceDesk(): Promise<void> {
    if ((await this.limits())?.serviceDesk === false) {
      throw planLimit('The plan does not include the service desk');
    }
  }
}
