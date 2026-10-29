import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger as NestPinoLogger } from 'nestjs-pino';
import { type AppDependencies, AppModule } from './app.module.js';
import { serveWebApp } from './core/web-app.js';
import { serveApiDocs } from './openapi/docs.js';
import { RealtimeService } from './realtime/realtime.service.js';

/** Builds the HTTP application exactly as production runs it (also used by integration tests). */
export async function createApiApp(deps: AppDependencies): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(deps), {
    bufferLogs: true,
  });
  app.useLogger(app.get(NestPinoLogger));
  // MCP clients expect the server at /mcp (D-MCP-01).
  app.setGlobalPrefix('api/v1', { exclude: ['mcp'] });
  // Behind Caddy or another proxy on the local network: take the client IP from X-Forwarded-For.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  serveApiDocs(app);
  if (deps.config.WEB_DIST_DIR) {
    serveWebApp(app, deps.config.WEB_DIST_DIR);
  }
  // Realtime signals on the same port as the API (E-58).
  await app.get(RealtimeService).attach(app.getHttpServer());
  return app;
}

/** The modules without HTTP, for a process that only runs the worker role (MODE=worker). */
export async function createWorkerContext(deps: AppDependencies): Promise<INestApplicationContext> {
  const context = await NestFactory.createApplicationContext(AppModule.forRoot(deps), {
    bufferLogs: true,
  });
  context.useLogger(context.get(NestPinoLogger));
  await context.init();
  return context;
}
