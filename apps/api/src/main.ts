import 'reflect-metadata';
import { createApiApp, createWorkerContext } from './api-app.js';
import { createCollabServer } from './collab/collab.server.js';
import { loadConfig, runsRole } from './core/config.js';
import { createLogger } from './core/logger.js';
import { createDatabase } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { SetupService } from './identity/setup.service.js';

const config = loadConfig();
const logger = createLogger(config);
const database = createDatabase(config.DATABASE_URL);
const closers: Array<() => Promise<void>> = [];

async function start(): Promise<void> {
  await runMigrations(database);
  const deps = { config, database, logger };

  if (runsRole(config, 'api')) {
    const app = await createApiApp(deps);
    await app.listen(config.API_PORT);
    logger.info({ port: config.API_PORT }, 'API listening');
    await app.get(SetupService).issueCode();
    closers.push(() => app.close());
  }

  if (runsRole(config, 'collab')) {
    const collab = createCollabServer(deps);
    await collab.listen();
    logger.info({ port: config.COLLAB_PORT }, 'Collaboration server listening');
    closers.push(() => collab.destroy());
  }

  // With the API in the same process, its modules already run the worker jobs.
  if (runsRole(config, 'worker') && !runsRole(config, 'api')) {
    const context = await createWorkerContext(deps);
    closers.push(() => context.close());
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
