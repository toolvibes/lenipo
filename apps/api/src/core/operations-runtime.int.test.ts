import type { Server } from 'node:http';
import { createServer } from 'node:net';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { createCollabServer, DRAFT_FIELD } from '../collab/collab.server.js';
import { pages, spaceRoleMembers, spaces } from '../db/schema/index.js';
import { PasswordService } from '../identity/password.service.js';
import { SESSION_COOKIE } from '../identity/secrets.js';
import { SessionService } from '../identity/session.service.js';
import { SetupService } from '../identity/setup.service.js';
import { UserService } from '../identity/user.service.js';
import { markDraining } from '../modules/health/health.controller.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { createLogger } from './logger.js';
import { databaseMetrics, startMetricsServer } from './metrics.js';

let test: TestApp;
let metrics: Server;
let metricsUrl = '';

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

function until(check: () => boolean, timeoutMs = 10_000): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (check()) return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error('Timed out'));
      setTimeout(tick, 50);
    };
    tick();
  });
}

beforeAll(async () => {
  test = await startTestApp();
  const admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('GET', '/projects');
  databaseMetrics(test.database);
  const port = await freePort();
  metrics = await startMetricsServer(port, createLogger(test.config));
  metricsUrl = `http://127.0.0.1:${port}/metrics`;
}, 60_000);

afterAll(async () => {
  await new Promise((resolve) => metrics?.close(resolve));
  await test?.close();
});

describe('metrics (TL-42)', () => {
  it('serves Prometheus metrics with route templates and queues', async () => {
    const text = await (await fetch(metricsUrl)).text();
    expect(text).toContain('process_cpu_user_seconds_total');
    expect(text).toMatch(
      /lenipo_http_request_duration_seconds_count\{method="GET",route="\/api\/v1\/projects",status="200"\} [1-9]/,
    );
    expect(text).toContain('lenipo_database_up 1');
    expect(text).toMatch(/lenipo_backlog\{queue="events"\} \d+/);
    expect(text).toContain('lenipo_connections{kind="realtime"}');
    expect((await fetch(metricsUrl.replace('/metrics', '/other'))).status).toBe(404);
  });
});

describe('several collaboration servers over Valkey (TL-42)', () => {
  it('hand edits from one server to the other', async () => {
    const url = process.env.TEST_REDIS_URL;
    if (!url) return;
    const db = test.database.db;
    const spaceId = uuidv7();
    const pageId = uuidv7();
    await db.insert(spaces).values({ id: spaceId, key: 'TEAM', name: 'Team' });
    await db.insert(pages).values({ id: pageId, spaceId, rank: 'i', title: 'Planung' });
    const userId = await test.app.get(UserService).create({
      email: 'mira@example.org',
      displayName: 'Mira',
      passwordHash: await test.app.get(PasswordService).hash('ein-langes-passwort'),
      groupNames: [],
    });
    await db.insert(spaceRoleMembers).values({ id: uuidv7(), spaceId, role: 'editors', userId });
    const session = await test.app.get(SessionService).create(userId, 'password', {});
    const cookie = `${SESSION_COOKIE}=${session.secret}`;

    const servers = [];
    for (let n = 0; n < 2; n += 1) {
      const config = { ...test.config, REDIS_URL: url, COLLAB_PORT: await freePort() };
      const server = createCollabServer({
        config,
        database: test.database,
        logger: createLogger(config),
      });
      await server.listen();
      servers.push({ server, url: `ws://127.0.0.1:${config.COLLAB_PORT}` });
    }
    const providers: HocuspocusProvider[] = [];
    const open = async (address: string) => {
      const doc = new Y.Doc();
      const headers = { cookie, host: '127.0.0.1', origin: 'http://127.0.0.1' };
      const Socket = class extends WebSocket {
        constructor(target: string, protocols?: string | string[]) {
          super(target, protocols, { headers });
        }
      };
      const socket = new HocuspocusProviderWebsocket({ url: address, WebSocketPolyfill: Socket });
      await new Promise<void>((resolve, reject) => {
        const provider = new HocuspocusProvider({
          websocketProvider: socket,
          name: `page:${pageId}`,
          document: doc,
          token: 'session',
          onSynced: () => resolve(),
          onAuthenticationFailed: ({ reason }) => reject(new Error(reason)),
        });
        provider.attach();
        providers.push(provider);
      });
      return doc.getXmlFragment(DRAFT_FIELD);
    };
    try {
      const [first, second] = [
        await open(servers[0]?.url ?? ''),
        await open(servers[1]?.url ?? ''),
      ];
      const element = new Y.XmlElement('paragraph');
      element.insert(0, [new Y.XmlText('Über Valkey')]);
      first.insert(0, [element]);
      await until(() => second.length === 1);
      expect(second.toString()).toContain('Über Valkey');
    } finally {
      for (const provider of providers) provider.destroy();
      for (const { server } of servers) await server.destroy();
    }
  }, 30_000);
});

describe('graceful shutdown (TL-42)', () => {
  it('fails readiness once the process drains', async () => {
    const client = new TestClient(test.baseUrl);
    expect((await client.request('GET', '/health/ready')).status).toBe(200);
    markDraining();
    expect((await client.request('GET', '/health/ready')).status).toBe(503);
    expect((await client.request('GET', '/health/live')).status).toBe(200);
  });
});
