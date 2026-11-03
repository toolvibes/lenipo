import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { Logger as NestPinoLogger } from 'nestjs-pino';
import { type AppDependencies, AppModule } from './app.module.js';
import { appCors } from './apps/app-cors.js';
import { AppsService } from './apps/apps.service.js';
import { httpMetrics } from './core/metrics.js';
import { securityHeaders, serveWebApp } from './core/web-app.js';
import { serveApiDocs } from './openapi/docs.js';
import { AgentActivityService } from './presence/agent-activity.service.js';
import { RealtimeService } from './realtime/realtime.service.js';

const READING = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Writing and rejected requests of agents go to their history (TL-98, E-150). MCP calls are
 * recorded per tool by the MCP server instead.
 */
function agentRequestLog(activity: AgentActivityService) {
  return (request: Request, response: Response, next: NextFunction) => {
    const started = performance.now();
    response.on('finish', () => {
      const principal = request.principal;
      if (principal?.via !== 'token' || request.path.startsWith('/mcp')) return;
      if (READING.has(request.method) && response.statusCode < 400) return;
      void activity.record({
        userId: principal.userId,
        via: 'rest',
        method: request.method,
        path: request.path,
        status: response.statusCode,
        durationMs: performance.now() - started,
        problem: typeof response.locals.problem === 'string' ? response.locals.problem : '',
      });
    });
    next();
  };
}

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
  app.use(appCors(app.get(AppsService)));
  app.use(agentRequestLog(app.get(AgentActivityService)));
  // SCIM clients send application/scim+json (RFC 7644).
  // This replaces Nest's JSON parser, so plain JSON stays in the list.
  app.useBodyParser('json', { type: ['application/json', 'application/scim+json'] });
  app.use('/scim/v2', (_request: Request, response: Response, next: NextFunction) => {
    response.type('application/scim+json');
    next();
  });
  // MCP clients expect the server at /mcp (D-MCP-01) and its OAuth metadata at /.well-known (E-115);
  // Jira clients append rest/api/2 to the server address (TL-48, E-138).
  app.setGlobalPrefix('api/v1', {
    exclude: [
      'mcp',
      'rest/api/2/{*path}',
      // Identity providers expect SCIM below the base address they are given (TL-52).
      'scim/v2/{*path}',
      '.well-known/oauth-protected-resource',
      '.well-known/oauth-protected-resource/mcp',
      '.well-known/oauth-authorization-server',
    ],
  });
  // Behind Caddy or another proxy on the local network: take the client IP from X-Forwarded-For.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  serveApiDocs(app);
  if (deps.config.WEB_DIST_DIR) {
    const apps = app.get(AppsService);
    serveWebApp(app, deps.config.WEB_DIST_DIR, () => apps.enabledOrigins());
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
