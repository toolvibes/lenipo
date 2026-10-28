import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

/**
 * Serves the built web app from the API process (decision E-07): hashed assets as static
 * files, every other browser navigation falls back to index.html for client-side routing.
 */
export function serveWebApp(app: NestExpressApplication, dir: string): void {
  const index = join(dir, 'index.html');
  if (!existsSync(index)) {
    throw new Error(`WEB_DIST_DIR has no index.html: ${dir}`);
  }
  app.useStaticAssets(dir, { index: false, maxAge: '1y', immutable: true });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/') || !req.accepts('html')) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(index);
  });
}
