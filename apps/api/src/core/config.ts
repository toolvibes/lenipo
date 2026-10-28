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
  /** Built web app (apps/web/dist) to serve from the API process; unset in development (Vite serves it). */
  WEB_DIST_DIR: z.string().min(1).optional(),
  /** Public address of this installation, used in log messages and links (e.g. https://tasklore.example.org). */
  PUBLIC_URL: z.url().optional(),
  /** Send session cookies only over HTTPS. Defaults to true in production. */
  COOKIE_SECURE: z.stringbool().optional(),
  /** A session ends after this many hours without activity. */
  SESSION_IDLE_HOURS: z.coerce
    .number()
    .int()
    .positive()
    .default(14 * 24),
  /** A session ends this many days after login, active or not. */
  SESSION_MAX_DAYS: z.coerce.number().int().positive().default(30),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function cookieSecure(config: AppConfig): boolean {
  return config.COOKIE_SECURE ?? config.NODE_ENV === 'production';
}

export function runsRole(config: AppConfig, role: 'api' | 'collab' | 'worker'): boolean {
  return config.MODE === 'all' || config.MODE === role;
}
