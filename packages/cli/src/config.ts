import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export type Auth =
  | { type: 'token'; token: string }
  | {
      type: 'oauth';
      clientId: string;
      tokenEndpoint: string;
      revocationEndpoint: string | null;
      accessToken: string;
      refreshToken: string;
      /** Milliseconds since the epoch. */
      expiresAt: number;
    };

export interface Profile {
  url: string;
  auth: Auth;
  /** Who signed in, for `lenipo profile list`. */
  user?: string;
}

export interface Config {
  current: string | null;
  profiles: Record<string, Profile>;
}

/**
 * Where profiles live: $XDG_CONFIG_HOME/lenipo or ~/.config/lenipo (E-117). Profiles saved
 * under the old name Tasklore are used as long as there are no new ones (E-129).
 */
export function configPath(env: Record<string, string | undefined>, home: string): string {
  const base = env.XDG_CONFIG_HOME || join(home, '.config');
  const path = join(base, 'lenipo', 'config.json');
  const old = join(base, 'tasklore', 'config.json');
  return !existsSync(path) && existsSync(old) ? old : path;
}

export async function loadConfig(path: string): Promise<Config> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as Partial<Config>;
    return { current: parsed.current ?? null, profiles: parsed.profiles ?? {} };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { current: null, profiles: {} };
    throw error;
  }
}

/** Written readable only by the owner: it holds tokens. */
export async function saveConfig(path: string, config: Config): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
}
