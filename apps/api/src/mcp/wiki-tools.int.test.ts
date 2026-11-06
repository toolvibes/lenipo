import { createServer } from 'node:net';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CreatedToken, Page } from '@toolvibes/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { createCollabServer, DRAFT_FIELD } from '../collab/collab.server.js';
import { createLogger } from '../core/logger.js';
import { auditLog } from '../db/schema/index.js';
import { SESSION_COOKIE } from '../identity/secrets.js';
import { SessionService } from '../identity/session.service.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let collab: ReturnType<typeof createCollabServer>;
let collabUrl: string;
let admin: TestClient;
let agent: Client;
let reader: Client;
let page: Page;
let cookie: string;
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

function until(check: () => boolean, timeoutMs = 5_000): Promise<void> {
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

/** A person with the page open in the browser editor. */
async function openEditor(documentName: string) {
  const doc = new Y.Doc();
  const headers = { cookie, host: '127.0.0.1' };
  const Socket = class extends WebSocket {
    constructor(url: string, protocols?: string | string[]) {
      super(url, protocols, { headers });
    }
  };
  let provider: HocuspocusProvider | undefined;
  await new Promise<void>((resolve, reject) => {
    provider = new HocuspocusProvider({
      websocketProvider: new HocuspocusProviderWebsocket({
        url: collabUrl,
        WebSocketPolyfill: Socket,
      }),
      name: documentName,
      document: doc,
      token: 'session',
      onSynced: () => resolve(),
      onAuthenticationFailed: ({ reason }) => reject(new Error(reason)),
    });
    provider.attach();
  });
  if (!provider) throw new Error('No provider');
  providers.push(provider);
  return { doc, provider };
}

async function connect(secret: string): Promise<Client> {
  const mcp = new Client({ name: 'test', version: '1.0.0' });
  const url = new URL(test.baseUrl.replace(/\/api\/v1$/, '/mcp'));
  await mcp.connect(
    new StreamableHTTPClientTransport(url, {
      requestInit: { headers: { authorization: `Bearer ${secret}` } },
    }),
  );
  return mcp;
}

async function call(mcp: Client, name: string, args: Record<string, unknown> = {}) {
  const result = (await mcp.callTool({ name, arguments: args })) as CallToolResult;
  const first = result.content[0];
  return { ...result, text: first?.type === 'text' ? first.text : '' };
}

beforeAll(async () => {
  test = await startTestApp();
  const config = { ...test.config, COLLAB_PORT: await freePort() };
  collab = createCollabServer({ config, database: test.database, logger: createLogger(config) });
  await collab.listen();
  collabUrl = `ws://127.0.0.1:${config.COLLAB_PORT}`;

  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  const me = (await admin.request<{ id: string }>('GET', '/me')).body;
  const session = await test.app.get(SessionService).create(me.id, 'password', {});
  cookie = `${SESSION_COOKIE}=${session.secret}`;

  await admin.request('POST', '/spaces', { key: 'DOCS', name: 'Doku' });
  page = (await admin.request<Page>('POST', '/spaces/DOCS/pages', { title: 'Offline-Sync' })).body;
  await admin.request('POST', `/pages/${page.id}/publish`, {
    title: 'Offline-Sync',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Ziele' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Alte Ziele' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Risiken' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Konflikte beim Abgleich' }] },
      ],
    },
  });
  const token = await admin.request<CreatedToken>('POST', '/me/tokens', {
    name: 'Claude',
    scopes: ['wiki:read', 'wiki:write'],
    expiresInDays: 30,
  });
  const readOnly = await admin.request<CreatedToken>('POST', '/me/tokens', {
    name: 'Leser',
    scopes: ['wiki:read'],
    expiresInDays: 30,
  });
  agent = await connect(token.body.secret);
  reader = await connect(readOnly.body.secret);
}, 60_000);

afterAll(async () => {
  for (const provider of providers) provider.destroy();
  await agent?.close();
  await reader?.close();
  await collab?.destroy();
  await test?.close();
});

describe('MCP wiki tools', () => {
  it('find and read pages', async () => {
    expect((await call(reader, 'list_spaces')).text).toContain('DOCS: Doku');
    expect((await call(reader, 'get_page_tree', { space: 'docs' })).text).toContain(
      `- Offline-Sync (${page.id})`,
    );
    const found = await call(reader, 'search_pages', { query: 'Abgleich' });
    expect(found.text).toContain('Offline-Sync');
    expect(found.text).toContain('**Abgleich**');
    const read = await call(reader, 'get_page', { page: page.id });
    expect(read.text).toContain('## Ziele');
    expect(read.text).toContain('version 1');
  });

  it('change one section of the live draft while a person edits elsewhere', async () => {
    const { doc, provider } = await openEditor(`page:${page.id}`);
    // The person adds a paragraph at the end, under "Risiken".
    const fragment = doc.getXmlFragment(DRAFT_FIELD);
    doc.transact(() => {
      const paragraph = new Y.XmlElement('paragraph');
      paragraph.insert(0, [new Y.XmlText('Von Hand ergänzt')]);
      fragment.insert(fragment.length, [paragraph]);
    });
    await new Promise((resolve) => setTimeout(resolve, 300));

    const updated = await call(agent, 'update_page', {
      page: page.id,
      section: 'Ziele',
      markdown: 'Arbeiten ohne Verbindung, ohne Datenverlust.',
    });
    expect(updated.isError).toBeFalsy();
    expect(updated.text).toContain('Headings now: Ziele | Risiken');

    // The open editor receives the agent's text and keeps its own.
    await until(() => fragment.toString().includes('ohne Datenverlust'));
    const text = fragment.toString();
    expect(text).not.toContain('Alte Ziele');
    expect(text).toContain('Von Hand ergänzt');
    expect(text).toContain('Konflikte beim Abgleich');
    // The agent showed up in the presence list.
    const names = [...(provider.awareness?.getStates().values() ?? [])].map(
      (state) => (state as { user?: { name?: string } }).user?.name,
    );
    expect(names).toContain('Lena Vogt · Agent');
  });

  it('explain unknown sections and missing scopes', async () => {
    const unknown = await call(agent, 'update_page', {
      page: page.id,
      section: 'Fehlt',
      markdown: 'x',
    });
    expect(unknown.isError).toBe(true);
    expect(unknown.text).toContain('Headings: Ziele | Risiken');
    const denied = await call(reader, 'update_page', { page: page.id, markdown: 'x' });
    expect(denied.isError).toBe(true);
    expect(denied.text).toContain('wiki:write');
  });

  it('show the draft and publish it', async () => {
    const draft = await call(agent, 'get_page', { page: page.id, draft: true });
    expect(draft.text).toContain('The draft has unpublished changes.');
    expect(draft.text).toContain('ohne Datenverlust');
    const published = await call(agent, 'publish_page', {
      page: page.id,
      comment: 'Ziele geschärft',
    });
    expect(published.text).toContain('version 2');
    const read = await call(reader, 'get_page', { page: page.id });
    expect(read.text).toContain('ohne Datenverlust');
    expect((await call(reader, 'get_page_history', { page: page.id })).text).toContain('v2');
    const audit = await test.database.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.targetId, page.id));
    expect(audit.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['mcp.update_page', 'mcp.publish_page']),
    );
  });

  it('create draft pages and comment', async () => {
    const created = await call(agent, 'create_page', {
      space: 'DOCS',
      title: 'Notizen',
      parent: page.id,
      markdown: '# Ablauf\n\nErster Schritt',
    });
    const id = (created.structuredContent as { id: string }).id;
    expect(created.text).toContain('Not published yet');
    const draft = await call(agent, 'get_page', { page: id, draft: true });
    expect(draft.text).toContain('Erster Schritt');
    // Claude Code shows the model only structuredContent, so it carries the page body too.
    expect(draft.structuredContent).toMatchObject({ id, markdown: draft.text });
    const comment = await call(agent, 'add_page_comment', {
      page: page.id,
      markdown: 'Bitte prüfen',
    });
    expect(comment.isError).toBeFalsy();
    const comments = await admin.request<Array<{ body: unknown }>>(
      'GET',
      `/pages/${page.id}/comments`,
    );
    expect(JSON.stringify(comments.body)).toContain('Bitte prüfen');
  });
});
