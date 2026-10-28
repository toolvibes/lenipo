import { createServer } from 'node:net';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { createLogger } from '../core/logger.js';
import { collabDocuments } from '../db/schema/index.js';
import { PasswordService } from '../identity/password.service.js';
import { SESSION_COOKIE } from '../identity/secrets.js';
import { SessionService } from '../identity/session.service.js';
import { UserService } from '../identity/user.service.js';
import { startTestApp, type TestApp } from '../test/harness.js';
import { createCollabServer } from './collab.server.js';

let test: TestApp;
let collab: ReturnType<typeof createCollabServer>;
let collabUrl: string;
let cookie: string;
const providers: HocuspocusProvider[] = [];

/** Node WebSocket that sends the headers a browser would send for a same-origin page. */
function socketWith(headers: Record<string, string>) {
  return class extends WebSocket {
    constructor(url: string, protocols?: string | string[]) {
      super(url, protocols, { headers });
    }
  };
}

function connect(documentName: string, headers: Record<string, string>) {
  const doc = new Y.Doc();
  let failure: string | undefined;
  const synced = new Promise<void>((resolve, reject) => {
    const provider = new HocuspocusProvider({
      websocketProvider: new HocuspocusProviderWebsocket({
        url: collabUrl,
        WebSocketPolyfill: socketWith(headers),
      }),
      name: documentName,
      document: doc,
      token: 'session',
      onSynced: () => resolve(),
      onAuthenticationFailed: ({ reason }) => {
        failure = reason;
        reject(new Error(reason));
      },
    });
    provider.attach();
    providers.push(provider);
  });
  return { doc, synced, failure: () => failure };
}

/** Asks the OS for a free port (Hocuspocus treats 0 as "use the configured port"). */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer().listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() =>
        typeof address === 'object' && address
          ? resolve(address.port)
          : reject(new Error('No port')),
      );
    });
  });
}

function until(check: () => boolean | Promise<boolean>, timeoutMs = 5_000): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      if (await check()) return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error('Timed out'));
      setTimeout(tick, 50);
    };
    void tick();
  });
}

beforeAll(async () => {
  test = await startTestApp();
  const config = { ...test.config, COLLAB_PORT: await freePort() };
  collab = createCollabServer({ config, database: test.database, logger: createLogger(config) });
  await collab.listen();
  collabUrl = `ws://127.0.0.1:${config.COLLAB_PORT}`;

  const userId = await test.app.get(UserService).create({
    email: 'jonas.schulz@example.org',
    displayName: 'Jonas Schulz',
    passwordHash: await test.app.get(PasswordService).hash('ein-langes-passwort'),
    groupNames: [],
  });
  const session = await test.app.get(SessionService).create(userId, 'password', {});
  cookie = `${SESSION_COOKIE}=${session.secret}`;
}, 60_000);

afterAll(async () => {
  for (const provider of providers) provider.destroy();
  await collab?.destroy();
  await test?.close();
});

describe('collaboration server', () => {
  it('rejects connections without a session', async () => {
    const client = connect('page:auth-test', { host: '127.0.0.1' });
    await expect(client.synced).rejects.toThrow();
  });

  it('rejects connections from another origin even with a valid session', async () => {
    const client = connect('page:auth-test', {
      cookie,
      host: '127.0.0.1',
      origin: 'https://evil.example',
    });
    await expect(client.synced).rejects.toThrow();
  });

  it('rejects invalid document names', async () => {
    const client = connect('../etc/passwd', { cookie, host: '127.0.0.1' });
    await expect(client.synced).rejects.toThrow();
  });

  it('syncs edits between two signed-in clients and persists them', async () => {
    const headers = { cookie, host: '127.0.0.1', origin: 'http://127.0.0.1' };
    const a = connect('page:sync-test', headers);
    const b = connect('page:sync-test', headers);
    await Promise.all([a.synced, b.synced]);

    a.doc.getText('content').insert(0, 'Hallo aus Node');
    await until(() => b.doc.getText('content').toString() === 'Hallo aus Node');

    await until(async () => {
      const [row] = await test.database.db
        .select({ state: collabDocuments.state })
        .from(collabDocuments)
        .where(eq(collabDocuments.name, 'page:sync-test'));
      if (!row) return false;
      const stored = new Y.Doc();
      Y.applyUpdate(stored, row.state);
      return stored.getText('content').toString() === 'Hallo aus Node';
    }, 15_000);
  }, 20_000);
});
