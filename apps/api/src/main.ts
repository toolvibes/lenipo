import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger as NestPinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { createCollabServer } from './collab/collab.server.js';
import { loadConfig, runsRole } from './core/config.js';
import { createLogger } from './core/logger.js';
import { serveWebApp } from './core/web-app.js';
import { createDatabase } from './db/client.js';
import { runMigrations } from './db/migrate.js';

const config = loadConfig();
const logger = createLogger(config);
const database = createDatabase(config.DATABASE_URL);
const closers: Array<() => Promise<void>> = [];

async function start(): Promise<void> {
  await runMigrations(database);
  const deps = { config, database, logger };

  if (runsRole(config, 'api')) {
    const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(deps), {
      bufferLogs: true,
    });
    app.useLogger(app.get(NestPinoLogger));
    app.setGlobalPrefix('api/v1');
    if (config.WEB_DIST_DIR) {
      serveWebApp(app, config.WEB_DIST_DIR);
    }
    await app.listen(config.API_PORT);
    logger.info({ port: config.API_PORT }, 'API listening');
    closers.push(() => app.close());
  }

  if (runsRole(config, 'collab')) {
    const collab = createCollabServer(deps);
    await collab.listen();
    logger.info({ port: config.COLLAB_PORT }, 'Collaboration server listening');
    closers.push(() => collab.destroy());
  }

  if (runsRole(config, 'worker')) {
    logger.info('Worker role has no jobs yet');
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down');
  for (const close of closers.reverse()) {
    await close();
  }
  await database.sql.end({ timeout: 5 });
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await start();
} catch (error) {
  logger.fatal({ err: error }, 'Startup failed');
  await database.sql.end({ timeout: 5 });
  process.exit(1);
}
