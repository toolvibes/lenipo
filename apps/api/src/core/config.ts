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
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function runsRole(config: AppConfig, role: 'api' | 'collab' | 'worker'): boolean {
  return config.MODE === 'all' || config.MODE === role;
}
