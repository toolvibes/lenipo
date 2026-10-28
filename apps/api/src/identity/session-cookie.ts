import type { CookieOptions, Response } from 'express';
import { type AppConfig, cookieSecure } from '../core/config.js';
import { SESSION_COOKIE } from './secrets.js';

function options(config: AppConfig): CookieOptions {
  return { httpOnly: true, secure: cookieSecure(config), sameSite: 'lax', path: '/' };
}

export function setSessionCookie(
  response: Response,
  config: AppConfig,
  secret: string,
  expiresAt: Date,
) {
  response.cookie(SESSION_COOKIE, secret, { ...options(config), expires: expiresAt });
}

export function clearSessionCookie(response: Response, config: AppConfig) {
  response.clearCookie(SESSION_COOKIE, options(config));
}
