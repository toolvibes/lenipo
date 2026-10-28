import type { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Rejects state-changing browser requests from other sites (CSRF, login CSRF).
 * Browsers send Sec-Fetch-Site; older ones at least Origin. Non-browser clients send neither
 * and cannot carry a victim's cookies, so they pass.
 */
export function isCrossSiteWrite(request: Request): boolean {
  if (SAFE_METHODS.has(request.method)) return false;
  const fetchSite = request.get('sec-fetch-site');
  if (fetchSite) return fetchSite !== 'same-origin' && fetchSite !== 'none';
  const origin = request.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.get('host');
  } catch {
    return true;
  }
}

/** Origin check for WebSocket upgrades (cross-site WebSocket hijacking). */
export function isForeignOrigin(headers: Headers): boolean {
  const origin = headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== headers.get('host');
  } catch {
    return true;
  }
}

export function clientOf(request: Request): { ip: string | null; userAgent: string | null } {
  return { ip: request.ip ?? null, userAgent: request.get('user-agent') ?? null };
}
