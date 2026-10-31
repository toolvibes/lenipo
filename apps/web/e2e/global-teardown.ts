import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { STATE } from './global-setup';

export default async function globalTeardown() {
  const run = JSON.parse(readFileSync(join(STATE, 'run.json'), 'utf8')) as {
    pid: number;
    database: string;
  };
  try {
    process.kill(run.pid, 'SIGTERM');
  } catch {
    // Already gone.
  }
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  const admin = postgres(process.env.DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists ${run.database} with (force)`);
  await admin.end();
}
