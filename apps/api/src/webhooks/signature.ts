import { createHmac, randomBytes } from 'node:crypto';

const PREFIX = 'whsec_';

/** A new secret in the Standard Webhooks format: "whsec_" plus 32 random bytes in base64. */
export function generateSecret(): string {
  return `${PREFIX}${randomBytes(32).toString('base64')}`;
}

/**
 * The webhook-signature header value per Standard Webhooks (E-45):
 * "v1," + base64(HMAC-SHA256(secret bytes, "<id>.<timestamp>.<body>")).
 */
export function sign(secret: string, id: string, timestamp: number, body: string): string {
  const key = Buffer.from(
    secret.startsWith(PREFIX) ? secret.slice(PREFIX.length) : secret,
    'base64',
  );
  const digest = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  return `v1,${digest}`;
}
