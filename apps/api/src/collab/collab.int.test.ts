import { createServer } from 'node:net';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import { and, eq, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { createLogger } from '../core/logger.js';
import {
  collabDocuments,
  pages,
  pageVersions,
  spaceRoleMembers,
  spaces,
} from '../db/schema/index.js';
import { PasswordService } from '../identity/password.service.js';
import { SESSION_COOKIE } from '../identity/secrets.js';
import { SessionService } from '../identity/session.service.js';
import { UserService } from '../identity/user.service.js';
import { startTestApp, type TestApp } from '../test/harness.js';
import { createCollabServer, DRAFT_FIELD } from './collab.server.js';
import { DRAFT_RESET_CHANNEL } from './document-name.js';

let test: TestApp;
let collab: ReturnType<typeof createCollabServer>;
let collabUrl: string;
let cookie: string;
let otherCookie: string;
let viewerCookie: string;
let pageId: string;
let trashedPageId: string;
let publishedPageId: string;
let spaceId: string;
let jonasId: string;
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
  collab = createCollabServer(
    { config, database: test.database, logger: createLogger(config) },
    { recheckMs: 100 },
  );
  await collab.listen();
  collabUrl = `ws://127.0.0.1:${config.COLLAB_PORT}`;

  const user = async (email: string, displayName: string) => {
    const id = await test.app.get(UserService).create({
      email,
      displayName,
      passwordHash: await test.app.get(PasswordService).hash('ein-langes-passwort'),
      groupNames: [],
    });
    const session = await test.app.get(SessionService).create(id, 'password', {});
    return { id, cookie: `${SESSION_COOKIE}=${session.secret}` };
  };
  const jonas = await user('jonas.schulz@example.org', 'Jonas Schulz');
  const mira = await user('mira.kaya@example.org', 'Mira Kaya');
  const olaf = await user('olaf.alt@example.org', 'Olaf Alt');
  jonasId = jonas.id;
  cookie = jonas.cookie;
  otherCookie = mira.cookie;
  viewerCookie = olaf.cookie;

  // A space where Jonas and Mira edit and Olaf only reads.
  spaceId = uuidv7();
  pageId = uuidv7();
  trashedPageId = uuidv7();
  publishedPageId = uuidv7();
  const db = test.database.db;
  await db.insert(spaces).values({ id: spaceId, key: 'DOCS', name: 'Doku' });
  await db.insert(spaceRoleMembers).values([
    { id: uuidv7(), spaceId, role: 'editors', userId: jonas.id },
    { id: uuidv7(), spaceId, role: 'editors', userId: mira.id },
    { id: uuidv7(), spaceId, role: 'viewers', userId: olaf.id },
  ]);
  await db.insert(pages).values([
    { id: pageId, spaceId, rank: 'i', title: 'Start' },
    { id: trashedPageId, spaceId, rank: 'r', title: 'Alt', deletedAt: new Date() },
    { id: publishedPageId, spaceId, rank: 'u', title: 'Fertig', version: 1 },
  ]);
  await db.insert(pageVersions).values({
    id: uuidv7(),
    pageId: publishedPageId,
    number: 1,
    title: 'Fertig',
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Veröffentlicht' }] }],
    },
  });
}, 60_000);

afterAll(async () => {
  for (const provider of providers) provider.destroy();
  await collab?.destroy();
  await test?.close();
});

describe('collaboration server', () => {
  it('rejects connections without a session', async () => {
    const client = connect(`page:${pageId}`, { host: '127.0.0.1' });
    await expect(client.synced).rejects.toThrow();
  });

  it('rejects connections from another origin even with a valid session', async () => {
    const client = connect(`page:${pageId}`, {
      cookie,
      host: '127.0.0.1',
      origin: 'https://evil.example',
    });
    await expect(client.synced).rejects.toThrow();
  });

  it('rejects invalid document names and pages that do not exist', async () => {
    for (const name of ['../etc/passwd', 'page:spike', 'issue:WEB-1', `page:${uuidv7()}`]) {
      const client = connect(name, { cookie, host: '127.0.0.1' });
      await expect(client.synced).rejects.toThrow();
    }
  });

  it('rejects readers of the space and pages in the trash (E-59)', async () => {
    const reader = connect(`page:${pageId}`, { cookie: viewerCookie, host: '127.0.0.1' });
    await expect(reader.synced).rejects.toThrow();
    const trashed = connect(`page:${trashedPageId}`, { cookie, host: '127.0.0.1' });
    await expect(trashed.synced).rejects.toThrow();
  });

  it('syncs edits between two signed-in clients and persists them', async () => {
    const headers = { cookie, host: '127.0.0.1', origin: 'http://127.0.0.1' };
    const a = connect(`page:${pageId}`, headers);
    const b = connect(`page:${pageId}`, { ...headers, cookie: otherCookie });
    await Promise.all([a.synced, b.synced]);

    a.doc.getText('content').insert(0, 'Hallo aus Node');
    await until(() => b.doc.getText('content').toString() === 'Hallo aus Node');

    await until(async () => {
      const [row] = await test.database.db
        .select({ state: collabDocuments.state })
        .from(collabDocuments)
        .where(eq(collabDocuments.name, `page:${pageId}`));
      if (!row) return false;
      const stored = new Y.Doc();
      Y.applyUpdate(stored, row.state);
      return stored.getText('content').toString() === 'Hallo aus Node';
    }, 15_000);
  }, 20_000);

  it('starts a missing draft from the published version', async () => {
    const client = connect(`page:${publishedPageId}`, { cookie, host: '127.0.0.1' });
    await client.synced;
    expect(client.doc.getXmlFragment(DRAFT_FIELD).toString()).toBe(
      '<paragraph>Veröffentlicht</paragraph>',
    );
  });

  it('replaces an open draft live when a version is restored (E-62)', async () => {
    const client = connect(`page:${publishedPageId}`, { cookie: otherCookie, host: '127.0.0.1' });
    await client.synced;
    const draft = client.doc.getXmlFragment(DRAFT_FIELD);
    await until(() => draft.toString() === '<paragraph>Veröffentlicht</paragraph>');
    // What the API does when restoring: a new version, then the notification after commit.
    const db = test.database.db;
    await db.insert(pageVersions).values({
      id: uuidv7(),
      pageId: publishedPageId,
      number: 2,
      title: 'Fertig',
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Zurück' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Alter Stand' }] },
        ],
      },
    });
    await db.update(pages).set({ version: 2 }).where(eq(pages.id, publishedPageId));
    await db.execute(sql`select pg_notify(${DRAFT_RESET_CHANNEL}, ${`page:${publishedPageId}`})`);
    await until(
      () =>
        draft.toString() ===
        '<heading level="2">Zurück</heading><paragraph>Alter Stand</paragraph>',
    );

    // The page reports unpublished changes once the draft moves away from the version.
    const draftChanged = async () => {
      const response = await fetch(`${test.baseUrl}/pages/${publishedPageId}`, {
        headers: { cookie: otherCookie },
      });
      return ((await response.json()) as { draftChanged: boolean }).draftChanged;
    };
    expect(await draftChanged()).toBe(false);
    ((draft.get(1) as Y.XmlElement).get(0) as Y.XmlText).insert(0, 'Neu: ');
    await until(draftChanged, 15_000);
  }, 25_000);

  it('stops taking edits from someone who lost the edit permission', async () => {
    const headers = { host: '127.0.0.1', origin: 'http://127.0.0.1' };
    const jonas = connect(`page:${pageId}`, { ...headers, cookie });
    const mira = connect(`page:${pageId}`, { ...headers, cookie: otherCookie });
    await Promise.all([jonas.synced, mira.synced]);
    await test.database.db
      .delete(spaceRoleMembers)
      .where(and(eq(spaceRoleMembers.spaceId, spaceId), eq(spaceRoleMembers.userId, jonasId)));
    await new Promise((resolve) => setTimeout(resolve, 200));

    jonas.doc.getText('late').insert(0, 'zu spät');
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    expect(mira.doc.getText('late').toString()).toBe('');
  }, 10_000);
});
