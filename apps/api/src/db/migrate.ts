import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { DatabaseHandle } from './client.js';

const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));
/** Arbitrary constant so that only one instance migrates at a time. */
const MIGRATION_LOCK_KEY = 7_211_042;

/** Applies pending migrations. Safe to call from several instances at once. */
export async function runMigrations({ db, sql }: DatabaseHandle): Promise<void> {
  const lockConnection = await sql.reserve();
  try {
    await lockConnection`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`;
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await lockConnection`select pg_advisory_unlock(${MIGRATION_LOCK_KEY})`;
    lockConnection.release();
  }
}
