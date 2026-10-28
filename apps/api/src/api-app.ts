import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger as NestPinoLogger } from 'nestjs-pino';
import { type AppDependencies, AppModule } from './app.module.js';
import { serveWebApp } from './core/web-app.js';

/** Builds the HTTP application exactly as production runs it (also used by integration tests). */
export async function createApiApp(deps: AppDependencies): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(deps), {
    bufferLogs: true,
  });
  app.useLogger(app.get(NestPinoLogger));
  app.setGlobalPrefix('api/v1');
  // Behind Caddy or another proxy on the local network: take the client IP from X-Forwarded-For.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  if (deps.config.WEB_DIST_DIR) {
    serveWebApp(app, deps.config.WEB_DIST_DIR);
  }
  return app;
}
