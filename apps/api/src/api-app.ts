import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger as NestPinoLogger } from 'nestjs-pino';
import { type AppDependencies, AppModule } from './app.module.js';
import { httpMetrics } from './core/metrics.js';
import { securityHeaders, serveWebApp } from './core/web-app.js';
import { serveApiDocs } from './openapi/docs.js';
import { RealtimeService } from './realtime/realtime.service.js';

/** Builds the HTTP application exactly as production runs it (also used by integration tests). */
export async function createApiApp(deps: AppDependencies): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(deps), {
    bufferLogs: true,
    // Git hosting signs the exact bytes of its webhooks (E-116).
    rawBody: true,
  });
  app.useLogger(app.get(NestPinoLogger));
  app.use(httpMetrics);
  app.use(securityHeaders);
  // MCP clients expect the server at /mcp (D-MCP-01) and its OAuth metadata at /.well-known (E-115);
  // Jira clients append rest/api/2 to the server address (TL-48, E-138).
  app.setGlobalPrefix('api/v1', {
    exclude: [
      'mcp',
      'rest/api/2/{*path}',
      '.well-known/oauth-protected-resource',
      '.well-known/oauth-protected-resource/mcp',
      '.well-known/oauth-authorization-server',
    ],
  });
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
