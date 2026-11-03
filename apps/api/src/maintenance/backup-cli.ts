import 'reflect-metadata';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { parseArgs } from 'node:util';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { loadConfig } from '../core/config.js';
import { createLogger } from '../core/logger.js';
import { createDatabase } from '../db/client.js';
import { BackupService } from './backup.service.js';

/**
 * A backup without the web interface, e.g. from cron or by a hosting service before it stops an
 * instance (TL-102): `node dist/maintenance/backup-cli.js --out /path/lenipo.zip`. The backup is
 * also listed under Administration → Maintenance like any other.
 */
const usage = 'backup --out <file.zip>';
const { values } = parseArgs({ options: { out: { type: 'string' } } });
if (!values.out) {
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
  const backups = context.get(BackupService);
  const backup = await backups.create('manual', null);
  if (backup.state !== 'done') throw new Error(backup.error ?? 'The backup failed');
  const { stream, size } = await backups.download(backup.id);
  await pipeline(stream, createWriteStream(values.out));
  console.log(`Backup ${backup.id}: ${size} bytes written to ${values.out}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await context.close();
  await database.sql.end({ timeout: 5 });
}
