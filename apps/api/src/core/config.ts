import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /** Which process roles to run. `all` runs every role in one process (small installations). */
  MODE: z.enum(['api', 'collab', 'worker', 'all']).default('all'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  COLLAB_PORT: z.coerce.number().int().positive().default(4001),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }).optional(),
  /** Request limits per person, token and IP (TL-40); off behind a gateway that limits already. */
  RATE_LIMITS: z.stringbool().default(true),
  /** Where the optional update check reads the newest release (TL-110, E-155). */
  UPDATE_CHECK_URL: z
    .url()
    .default('https://api.github.com/repos/toolvibes/lenipo/releases/latest'),
  /** Prometheus metrics on this port at /metrics (TL-42); off when unset, never public. */
  METRICS_PORT: z.coerce.number().int().positive().optional(),
  /** Where "Help" leads; without it the user handbook built into the web app (TL-44). */
  HELP_URL: z.url({ protocol: /^https?$/ }).optional(),
  /** Defaults for the links to imprint and privacy policy; administrators can set their own (TL-105). */
  IMPRINT_URL: z.url({ protocol: /^https?$/ }).optional(),
  PRIVACY_URL: z.url({ protocol: /^https?$/ }).optional(),
  /** How long a stopping process waits for running requests and jobs (TL-42). */
  SHUTDOWN_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(300).default(25),
  /** Built web app (apps/web/dist) to serve from the API process; unset in development (Vite serves it). */
  WEB_DIST_DIR: z.string().min(1).optional(),
  /** Public address of this installation, used in log messages and links (e.g. https://lenipo.example.org). */
  PUBLIC_URL: z.url().optional(),
  /**
   * Lets a provider (e.g. a hosting service) set up the instance over the API (TL-102, E-153):
   * name it and invite the first administrator. Keep it secret like a password.
   */
  SETUP_TOKEN: z
    .string()
    .min(32)
    .refine((token) => !/^(lp|tl)_/i.test(token), 'must not look like a Lenipo token')
    .optional(),
  /** Send session cookies only over HTTPS. Defaults to true in production. */
  COOKIE_SECURE: z.stringbool().optional(),
  /** OpenID Connect sign-in (Keycloak, Authentik, Entra ID …). Enabled when issuer and client id are set. */
  OIDC_ISSUER_URL: z.url().optional(),
  OIDC_CLIENT_ID: z.string().min(1).optional(),
  /** Omit for public clients (PKCE only). */
  OIDC_CLIENT_SECRET: z.string().min(1).optional(),
  /** Label of the sign-in button, e.g. "Firmen-Login". */
  OIDC_DISPLAY_NAME: z.string().min(1).default('Single Sign-On'),
  OIDC_SCOPES: z.string().default('openid profile email'),
  /** Claim with group names; matching Lenipo groups are granted on sign-in. */
  OIDC_GROUPS_CLAIM: z.string().min(1).optional(),
  /** Create accounts for unknown people on first sign-in. */
  OIDC_AUTO_CREATE_USERS: z.stringbool().default(true),
  /** A session ends after this many hours without activity. */
  SESSION_IDLE_HOURS: z.coerce
    .number()
    .int()
    .positive()
    .default(14 * 24),
  /** A session ends this many days after login, active or not. */
  SESSION_MAX_DAYS: z.coerce.number().int().positive().default(30),
  /** Where attachments live: a local directory or an S3-compatible bucket (RustFS, AWS, …). */
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  /** Directory for STORAGE_DRIVER=local; relative paths start at the working directory. */
  STORAGE_LOCAL_DIR: z.string().min(1).default('./data/files'),
  /** S3 endpoint, e.g. http://localhost:9010 for the RustFS from docker-compose.yml. */
  S3_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(3).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  /** Largest attachment accepted, in megabytes. */
  ATTACHMENT_MAX_MB: z.coerce.number().positive().max(1024).default(25),
  /** Outgoing mail server, e.g. smtp://user:password@mail.example.org:587; without it no email is sent. */
  SMTP_URL: z.url({ protocol: /^smtps?$/ }).optional(),
  MAIL_FROM: z.string().min(3).default('Lenipo <lenipo@localhost>'),
  /** Notification emails wait this long after the last change to an issue, bundling a burst into one. */
  NOTIFICATION_EMAIL_DELAY_SECONDS: z.coerce.number().int().min(0).default(120),
  /** Let webhooks reach loopback and private addresses (internal tools); off by default (E-45). */
  WEBHOOK_ALLOW_PRIVATE_NETWORKS: z.stringbool().default(false),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = configSchema
    .refine((config) => !(config.OIDC_ISSUER_URL && config.OIDC_CLIENT_ID) || config.PUBLIC_URL, {
      message: 'PUBLIC_URL is required for OIDC sign-in (it forms the redirect URI)',
      path: ['PUBLIC_URL'],
    })
    .refine(
      (config) =>
        config.STORAGE_DRIVER !== 's3' ||
        (config.S3_ENDPOINT &&
          config.S3_BUCKET &&
          config.S3_ACCESS_KEY_ID &&
          config.S3_SECRET_ACCESS_KEY),
      {
        message:
          'STORAGE_DRIVER=s3 needs S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY',
        path: ['STORAGE_DRIVER'],
      },
    )
    .safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function oidcEnabled(config: AppConfig): boolean {
  return Boolean(config.OIDC_ISSUER_URL && config.OIDC_CLIENT_ID);
}

export function cookieSecure(config: AppConfig): boolean {
  return config.COOKIE_SECURE ?? config.NODE_ENV === 'production';
}

export function runsRole(config: AppConfig, role: 'api' | 'collab' | 'worker'): boolean {
  return config.MODE === 'all' || config.MODE === role;
}
