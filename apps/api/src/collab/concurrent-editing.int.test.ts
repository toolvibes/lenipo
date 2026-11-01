import { createServer } from 'node:net';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import { yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap';
import { isValidDoc } from '@toolvibes/editor';
import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { createLogger } from '../core/logger.js';
import { collabDocuments, pages, spaceRoleMembers, spaces } from '../db/schema/index.js';
import { PasswordService } from '../identity/password.service.js';
import { SESSION_COOKIE } from '../identity/secrets.js';
import { SessionService } from '../identity/session.service.js';
import { UserService } from '../identity/user.service.js';
import { startTestApp, type TestApp } from '../test/harness.js';
import { createCollabServer, DRAFT_FIELD } from './collab.server.js';

/**
 * The MVP promise "five people edit one page at the same time without losing text" (TL-2):
 * five signed-in editors type at once into one draft, partly into the same paragraph, one of
 * them offline for a while; afterwards every editor and the stored draft hold every word.
 */

const PEOPLE = ['Lena', 'Mira', 'Jonas', 'Ayşe', 'Olaf'];
const ROUNDS = 40;

let test: TestApp;
let collab: ReturnType<typeof createCollabServer>;
let collabUrl: string;
let pageId: string;
const cookies: string[] = [];
const providers: HocuspocusProvider[] = [];

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

function until(check: () => boolean | Promise<boolean>, timeoutMs = 10_000): Promise<void> {
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

/** A repeatable pseudo-random sequence, so a failure can be replayed. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

async function open(cookie: string) {
  const doc = new Y.Doc();
  const headers = { cookie, host: '127.0.0.1', origin: 'http://127.0.0.1' };
  const Socket = class extends WebSocket {
    constructor(url: string, protocols?: string | string[]) {
      super(url, protocols, { headers });
    }
  };
  // Going offline happens on the socket; HocuspocusProvider.disconnect() leaves a shared one open.
  const socket = new HocuspocusProviderWebsocket({ url: collabUrl, WebSocketPolyfill: Socket });
  let provider: HocuspocusProvider | undefined;
  await new Promise<void>((resolve, reject) => {
    provider = new HocuspocusProvider({
      websocketProvider: socket,
      name: `page:${pageId}`,
      document: doc,
      token: 'session',
      onSynced: () => resolve(),
      onAuthenticationFailed: ({ reason }) => reject(new Error(reason)),
    });
    provider.attach();
  });
  if (!provider) throw new Error('No provider');
  providers.push(provider);
  return { doc, provider, socket, fragment: doc.getXmlFragment(DRAFT_FIELD) };
}

const paragraph = (text: string) => {
  const element = new Y.XmlElement('paragraph');
  element.insert(0, [new Y.XmlText(text)]);
  return element;
};

/** The text of every paragraph, in order. */
function texts(fragment: Y.XmlFragment): string[] {
  return fragment.toArray().map((node) =>
    node instanceof Y.XmlElement
      ? node
          .toArray()
          .map((child) => (child instanceof Y.XmlText ? child.toString() : ''))
          .join('')
      : '',
  );
}

beforeAll(async () => {
  test = await startTestApp();
  const config = { ...test.config, COLLAB_PORT: await freePort() };
  collab = createCollabServer({ config, database: test.database, logger: createLogger(config) });
  await collab.listen();
  collabUrl = `ws://127.0.0.1:${config.COLLAB_PORT}`;

  const spaceId = uuidv7();
  pageId = uuidv7();
  const db = test.database.db;
  await db.insert(spaces).values({ id: spaceId, key: 'TEAM', name: 'Team' });
  await db.insert(pages).values({ id: pageId, spaceId, rank: 'i', title: 'Planung' });
  const hash = await test.app.get(PasswordService).hash('ein-langes-passwort');
  for (const name of PEOPLE) {
    const id = await test.app.get(UserService).create({
      email: `${name.toLowerCase().replace('ş', 's')}@example.org`,
      displayName: name,
      passwordHash: hash,
      groupNames: [],
    });
    await db
      .insert(spaceRoleMembers)
      .values({ id: uuidv7(), spaceId, role: 'editors', userId: id });
    const session = await test.app.get(SessionService).create(id, 'password', {});
    cookies.push(`${SESSION_COOKIE}=${session.secret}`);
  }
}, 60_000);

afterAll(async () => {
  for (const provider of providers) provider.destroy();
  await collab?.destroy();
  await test?.close();
});

describe('five people editing one page at once (TL-2)', () => {
  it('keep every word, also of someone who was offline for a while', async () => {
    const editors = await Promise.all(cookies.map((cookie) => open(cookie)));
    const first = editors[0] as (typeof editors)[number];
    // A shared paragraph everybody types into.
    first.fragment.insert(0, [paragraph('Gemeinsam:')]);
    await until(() => editors.every((editor) => editor.fragment.length === 1));

    const written: string[] = [];
    const typed: string[] = [];
    const offlineLines: string[] = [];
    const offline = editors[4] as (typeof editors)[number];
    await Promise.all(
      editors.map(async (editor, person) => {
        const next = random(person + 1);
        for (let round = 0; round < ROUNDS; round++) {
          // The last person drops off for a stretch and keeps writing locally.
          if (editor === offline && round === 10) editor.socket.disconnect();
          if (editor === offline && round === 30) {
            // While offline, nobody else saw these lines.
            const seen = texts(first.fragment);
            expect(offlineLines.length).toBeGreaterThan(0);
            expect(offlineLines.filter((line) => seen.includes(line))).toEqual([]);
            await editor.socket.connect();
          }
          await new Promise((resolve) => setTimeout(resolve, next() * 15));
          const name = PEOPLE[person] as string;
          if (next() < 0.5) {
            const token = `[${name}-${round}]`;
            const shared = editor.fragment.get(0) as Y.XmlElement;
            const text = shared.get(0) as Y.XmlText;
            // At a word boundary, often the same one as someone else at the same moment.
            const content = text.toString();
            const boundaries = [
              'Gemeinsam:'.length,
              ...[...content.matchAll(/\]/g)].map((match) => (match.index ?? 0) + 1),
            ];
            text.insert(boundaries[Math.floor(next() * boundaries.length)] as number, token);
            typed.push(token);
          } else {
            const line = `${name} schreibt Zeile ${round}.`;
            const position = 1 + Math.floor(next() * editor.fragment.length);
            editor.fragment.insert(Math.min(position, editor.fragment.length), [paragraph(line)]);
            written.push(line);
            if (editor === offline && round >= 10 && round < 30) offlineLines.push(line);
          }
        }
      }),
    );

    // Everyone ends up with the same document.
    await until(() => {
      const reference = first.fragment.toString();
      return editors.every((editor) => editor.fragment.toString() === reference);
    }, 20_000);
    const lines = texts(first.fragment);
    expect(lines).toHaveLength(1 + written.length);
    expect(lines.slice(1).sort()).toEqual([...written].sort());
    // Words typed into the same paragraph stay whole and appear exactly once.
    const shared = lines[0] as string;
    expect(shared.startsWith('Gemeinsam:')).toBe(true);
    for (const token of typed) {
      expect(shared.split(token).length - 1).toBe(1);
    }
    expect(shared.length).toBe('Gemeinsam:'.length + typed.join('').length);

    // The draft is a valid page document and the server stored all of it.
    const json = yXmlFragmentToProsemirrorJSON(first.fragment);
    expect(isValidDoc(json)).toBe(true);
    for (const provider of providers.splice(0)) provider.destroy();
    await until(async () => {
      const [row] = await test.database.db
        .select({ state: collabDocuments.state })
        .from(collabDocuments)
        .where(eq(collabDocuments.name, `page:${pageId}`));
      if (!row) return false;
      const stored = new Y.Doc();
      Y.applyUpdate(stored, row.state);
      return stored.getXmlFragment(DRAFT_FIELD).toString() === first.fragment.toString();
    }, 20_000);

    // Someone opening the page later sees the same.
    const late = await open(cookies[1] as string);
    expect(late.fragment.toString()).toBe(first.fragment.toString());
  }, 60_000);
});
