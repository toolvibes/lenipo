import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

/**
 * What the web app may load (TL-44, E-125): its own scripts only, inline styles (React style
 * attributes), images from anywhere over https (Markdown images), the collaboration and
 * realtime sockets, iframes for the embed macro (its own allowlist decides), never framed.
 */
const APP_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
  'frame-src https:',
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

/** Headers on every answer: no sniffing, no framing, no full referrer, HTTPS remembered. */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
}

/**
 * Serves the built web app from the API process (decision E-07): hashed assets as static
 * files, every other browser navigation falls back to index.html for client-side routing.
 */
export function serveWebApp(app: NestExpressApplication, dir: string): void {
  const index = join(dir, 'index.html');
  if (!existsSync(index)) {
    throw new Error(`WEB_DIST_DIR has no index.html: ${dir}`);
  }
  app.useStaticAssets(dir, {
    index: false,
    maxAge: '1y',
    immutable: true,
    // The service worker and the manifest are not hashed: browsers must see new versions.
    setHeaders: (res, path) => {
      if (/(?:sw\.js|manifest\.webmanifest|registerSW\.js)$/.test(path)) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/') || !req.accepts('html')) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Security-Policy', APP_CSP);
    res.sendFile(index);
  });
}
