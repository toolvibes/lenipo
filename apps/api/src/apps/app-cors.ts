import type { NextFunction, Request, Response } from 'express';
import type { AppsService } from './apps.service.js';

/**
 * CORS for installed apps (TL-50, E-140): their pages on their own origin call the API with the
 * token Lenipo gave them. Only Bearer requests, never cookies; other origins get no headers.
 */
export function appCors(apps: AppsService) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const origin = request.get('origin');
    if (!origin || !request.path.startsWith('/api/v1/')) {
      next();
      return;
    }
    apps
      .enabledOrigins()
      .then((origins) => {
        if (origins.has(origin)) {
          response.vary('Origin');
          response.setHeader('Access-Control-Allow-Origin', origin);
          response.setHeader(
            'Access-Control-Expose-Headers',
            'RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After',
          );
          if (request.method === 'OPTIONS') {
            response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
            response.setHeader(
              'Access-Control-Allow-Headers',
              'Authorization, Content-Type, Idempotency-Key, If-Match',
            );
            response.setHeader('Access-Control-Max-Age', '600');
            response.status(204).end();
            return;
          }
        }
        next();
      })
      .catch(next);
  };
}
