import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { loadConfig } from '../core/config.js';
import { createLogger } from '../core/logger.js';
import { createDatabase } from '../db/client.js';
import { SetupService } from '../identity/setup.service.js';
import { BackupService } from './backup.service.js';

/**
 * Restores a backup without the web interface, e.g. by a hosting service into an emptied
 * database (TL-104, E-156): `node dist/maintenance/restore-cli.js --in /path/lenipo.zip`. Like the
 * restore on the setup screen it only runs while the instance has no administrator yet, and the
 * backup has to come from the same Lenipo version.
 */
const usage = 'restore --in <file.zip>';
const { values } = parseArgs({ options: { in: { type: 'string' } } });
if (!values.in) {
  console.error(usage);
  process.exit(2);
}

// Only the API modules: a running instance does its own worker jobs.
const config = { ...loadConfig(), MODE: 'api' as const, LOG_LEVEL: 'warn' as const };
const database = createDatabase(config.DATABASE_URL);
const context = await NestFactory.createApplicationContext(
  AppModule.forRoot({ config, database, logger: createLogger(config) }),
  { logger: false },
);
try {
  if (!(await context.get(SetupService).isRequired())) {
    throw new Error('This instance is already set up; restore only into a fresh instance');
  }
  const result = await context.get(BackupService).restore(values.in);
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await context.close();
  await database.sql.end({ timeout: 5 });
}
