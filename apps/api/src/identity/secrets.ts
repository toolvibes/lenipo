import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'lp_session';
export const TOKEN_PREFIX = 'lp_pat_';

/**
 * Whether a secret carries a prefix, in its Lenipo form (`lp_…`) or as issued under the old
 * name Tasklore (`tl_…`); those keep working (E-129).
 */
export function hasPrefix(secret: string, prefix: string): boolean {
  return secret.startsWith(prefix) || secret.startsWith(`tl_${prefix.slice(3)}`);
}

/** The session secret from a Cookie header; sessions begun under the old name stay valid. */
export function readSessionCookie(header: string | undefined): string | undefined {
  return readCookie(header, SESSION_COOKIE) ?? readCookie(header, 'tl_session');
}

/** URL-safe random secret with 256 bits of entropy. */
export function randomSecret(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Minimal Cookie header parser; we only ever read our own session cookie. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return undefined;
}

/** Human-friendly one-time code, e.g. `K7QM-2XPA-9DTR-WB4E`. Ambiguous characters are left out. */
export function setupCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(16);
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  return chars.match(/.{4}/g)?.join('-') ?? chars;
}
