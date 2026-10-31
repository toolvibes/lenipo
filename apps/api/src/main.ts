// First: tracing patches HTTP and Express before anything loads them (TL-42).
import { telemetry } from './telemetry.js';
import 'reflect-metadata';
import type { Server } from 'node:http';
import { createApiApp, createWorkerContext } from './api-app.js';
import { createCollabServer } from './collab/collab.server.js';
import { loadConfig, runsRole } from './core/config.js';
import { createLogger } from './core/logger.js';
import { databaseMetrics, startMetricsServer } from './core/metrics.js';
import { createDatabase } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { SetupService } from './identity/setup.service.js';
import { markDraining } from './modules/health/health.controller.js';

const config = loadConfig();
const logger = createLogger(config);
const database = createDatabase(config.DATABASE_URL);
const closers: Array<() => Promise<void>> = [];

async function start(): Promise<void> {
  await runMigrations(database);
  const deps = { config, database, logger };

  if (config.METRICS_PORT) {
    databaseMetrics(database);
    const metrics: Server = await startMetricsServer(config.METRICS_PORT, logger);
    logger.info({ port: config.METRICS_PORT }, 'Metrics listening');
    closers.push(() => new Promise((resolve) => metrics.close(() => resolve())));
  }

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

/**
 * Rolling updates (TL-42, E-123): readiness fails at once, running requests and worker jobs
 * finish, connections close. A shutdown that hangs would block restarts (TL-54), so after
 * SHUTDOWN_TIMEOUT_SECONDS the process just ends.
 */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down');
  markDraining();
  setTimeout(() => {
    logger.error({ signal }, 'Shutdown took too long, exiting');
    process.exit(1);
  }, config.SHUTDOWN_TIMEOUT_SECONDS * 1000).unref();
  for (const close of closers.reverse()) {
    await close();
  }
  await telemetry?.shutdown().catch(() => undefined);
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
