import { loadConfig } from '../core/config.js';
import { createDatabase } from './client.js';
import { runMigrations } from './migrate.js';

const database = createDatabase(loadConfig().DATABASE_URL);
try {
  await runMigrations(database);
  console.log('Migrations applied.');
} finally {
  await database.sql.end();
}
