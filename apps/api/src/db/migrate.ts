import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { API_VERSION } from '../openapi/version.js';
import type { DatabaseHandle } from './client.js';
import { compareVersions, readReleaseInfo } from './release.js';

const VERSION_KEY = 'schema-version';

/**
 * Refuses a database that an update cannot start from (TL-110, E-155): one last migrated by a
 * version older than this release's minimum, which would end up half migrated.
 */
export async function checkUpgradePath(
  sql: DatabaseHandle['sql'],
  current = API_VERSION,
  minimum = readReleaseInfo().minimumUpgradeFrom,
): Promise<void> {
  if (!minimum) return;
  const [table] = await sql<{ exists: boolean }[]>`
    select to_regclass('system_settings') is not null as exists`;
  if (!table?.exists) return;
  const [row] = await sql<{ value: { version?: string } }[]>`
    select value from system_settings where key = ${VERSION_KEY}`;
  const migratedBy = row?.value.version;
  if (migratedBy && compareVersions(migratedBy, minimum) < 0) {
    throw new Error(
      `This database was last updated by Lenipo ${migratedBy}. Lenipo ${current} can only update from ${minimum} or later: update to ${minimum} first, then to ${current}.`,
    );
  }
}

/** Notes the newest version that migrated the database; a rollback does not lower it. */
async function noteVersion(sql: DatabaseHandle['sql']): Promise<void> {
  const [row] = await sql<{ value: { version?: string } }[]>`
    select value from system_settings where key = ${VERSION_KEY}`;
  const known = row?.value.version;
  if (known && compareVersions(known, API_VERSION) >= 0) return;
  const value = JSON.stringify({ version: API_VERSION });
  await sql`
    insert into system_settings (key, value) values (${VERSION_KEY}, ${value}::jsonb)
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
}

const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));
/** Arbitrary constant so that only one instance migrates at a time. */
const MIGRATION_LOCK_KEY = 7_211_042;

/** Applies pending migrations. Safe to call from several instances at once. */
export async function runMigrations({ db, sql }: DatabaseHandle): Promise<void> {
  const lockConnection = await sql.reserve();
  try {
    await lockConnection`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`;
    await checkUpgradePath(sql);
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    await noteVersion(sql);
  } finally {
    await lockConnection`select pg_advisory_unlock(${MIGRATION_LOCK_KEY})`;
    lockConnection.release();
  }
}
