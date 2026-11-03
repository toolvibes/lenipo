import { Inject, Injectable } from '@nestjs/common';
import type { UpdateStatus } from '@toolvibes/shared';
import { eq } from 'drizzle-orm';
import type { AppConfig } from '../core/config.js';
import type { Logger } from '../core/logger.js';
import { CONFIG, DATABASE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { compareVersions } from '../db/release.js';
import { systemSettings } from '../db/schema/index.js';
import { API_VERSION } from '../openapi/version.js';

const KEY = 'update-check';
const DAY = 86_400_000;

interface Stored {
  enabled: boolean;
  latest: string | null;
  url: string | null;
  checkedAt: string | null;
  error: string | null;
}

const EMPTY: Stored = { enabled: false, latest: null, url: null, checkedAt: null, error: null };

/**
 * The optional update check (TL-110, E-155): once a day the newest release from the public
 * list on GitHub, shown to administrators. Off until an administrator turns it on; it sends
 * nothing but the request itself.
 */
@Injectable()
export class UpdateCheckService {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  private async stored(): Promise<Stored> {
    const [row] = await this.database.db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, KEY));
    return { ...EMPTY, ...(row?.value as Partial<Stored> | undefined) };
  }

  private async save(value: Stored): Promise<void> {
    await this.database.db
      .insert(systemSettings)
      .values({ key: KEY, value })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedAt: new Date() } });
  }

  async status(): Promise<UpdateStatus> {
    const stored = await this.stored();
    return {
      current: API_VERSION,
      ...stored,
      available:
        stored.enabled && !!stored.latest && compareVersions(stored.latest, API_VERSION) > 0,
    };
  }

  async setEnabled(enabled: boolean): Promise<UpdateStatus> {
    await this.save({ ...(await this.stored()), enabled });
    if (enabled) await this.check();
    return this.status();
  }

  /** For the worker: checks when on and the last check is a day old. */
  async checkIfDue(now = Date.now()): Promise<void> {
    const stored = await this.stored();
    if (!stored.enabled) return;
    if (stored.checkedAt && now - new Date(stored.checkedAt).getTime() < DAY) return;
    await this.check();
  }

  async check(): Promise<void> {
    const stored = await this.stored();
    try {
      const response = await fetch(this.config.UPDATE_CHECK_URL, {
        headers: { accept: 'application/vnd.github+json', 'user-agent': 'lenipo-update-check' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const release = (await response.json()) as { tag_name?: string; html_url?: string };
      if (!release.tag_name) throw new Error('The answer names no release');
      await this.save({
        ...stored,
        latest: release.tag_name.replace(/^v/, ''),
        url: release.html_url ?? null,
        checkedAt: new Date().toISOString(),
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn({ err: error }, 'Update check failed');
      await this.save({ ...stored, checkedAt: new Date().toISOString(), error: message });
    }
  }
}
