import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import postgres from 'postgres';

const PORT = 4180;
export const STATE = resolve(import.meta.dirname, '.state');

/** Waits for the setup code the API logs on its first start. */
function setupCode(server: ChildProcess): Promise<string> {
  return new Promise((done, fail) => {
    let buffer = '';
    const timer = setTimeout(() => fail(new Error(`No setup code in time:\n${buffer}`)), 60_000);
    server.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const match = /"setupCode":"([^"]+)"/.exec(buffer);
      if (match?.[1]) {
        clearTimeout(timer);
        done(match[1]);
      }
    });
    server.on('exit', (code) => fail(new Error(`API ended with ${code}:\n${buffer}`)));
  });
}

export default async function globalSetup() {
  const serverUrl = process.env.DATABASE_URL;
  if (!serverUrl) throw new Error('DATABASE_URL is needed to create the test database');
  const name = `lenipo_e2e_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const admin = postgres(serverUrl, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${name}`);
  await admin.end();
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;

  // Without Valkey: counters and collab stay in this one process.
  const { REDIS_URL: _, ...inherited } = process.env;
  const server = spawn(process.execPath, ['../api/dist/main.js'], {
    env: {
      ...inherited,
      NODE_ENV: 'development',
      DATABASE_URL: url.toString(),
      MODE: 'all',
      API_PORT: String(PORT),
      COLLAB_PORT: String(PORT + 1),
      WEB_DIST_DIR: resolve('dist'),
      STORAGE_DRIVER: 'local',
      STORAGE_LOCAL_DIR: mkdtempSync(join(tmpdir(), 'lenipo-e2e-')),
      RATE_LIMITS: 'false',
      LOG_LEVEL: 'warn',
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  mkdirSync(STATE, { recursive: true });
  writeFileSync(join(STATE, 'run.json'), JSON.stringify({ pid: server.pid, database: name }));
  const code = await setupCode(server);

  const base = `http://127.0.0.1:${PORT}/api/v1`;
  const setup = await fetch(`${base}/setup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      token: code,
      instanceName: 'E2E',
      admin: {
        email: 'lena@example.org',
        displayName: 'Lena Vogt',
        password: 'ein-langes-passwort',
      },
    }),
  });
  if (!setup.ok) throw new Error(`Setup failed: ${setup.status} ${await setup.text()}`);
  const cookie = (setup.headers.getSetCookie()[0] ?? '').split(';')[0] ?? '';
  const call = async (path: string, body: unknown) => {
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
    return response;
  };
  // The welcome steps create project, board and wiki space in one go.
  const started = (await (
    await call('/me/onboarding', { start: { method: 'scrum', name: 'Web-Relaunch', key: 'WEB' } })
  ).json()) as { boardId: string | null };
  await call('/issues', { projectKey: 'WEB', issueType: 'story', summary: 'Anmeldung' });
  writeFileSync(join(STATE, 'data.json'), JSON.stringify({ boardId: started.boardId }));

  const [cookieName, cookieValue] = cookie.split('=');
  writeFileSync(
    join(STATE, 'auth.json'),
    JSON.stringify({
      cookies: [
        {
          name: cookieName,
          value: cookieValue,
          domain: '127.0.0.1',
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    }),
  );
}
