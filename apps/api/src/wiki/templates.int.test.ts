import { yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap';
import { richTextSchema } from '@toolvibes/editor';
import type { Page, PageTemplate, PageTemplateSummary } from '@toolvibes/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { DRAFT_FIELD, draftName } from '../collab/document-name.js';
import { collabDocuments } from '../db/schema/index.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let olaf: TestClient;

const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

async function signIn(email: string): Promise<TestClient> {
  const client = new TestClient(test.baseUrl);
  await client.request('POST', '/auth/login', { email, password: 'ein-langes-passwort' });
  return client;
}

/** The text of a page's live draft, as the collab service would load it. */
async function draftText(pageId: string): Promise<string> {
  const [row] = await test.database.db
    .select()
    .from(collabDocuments)
    .where(eq(collabDocuments.name, draftName(pageId)));
  if (!row) return '';
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, row.state);
  const json = yXmlFragmentToProsemirrorJSON(ydoc.getXmlFragment(DRAFT_FIELD));
  return richTextSchema.nodeFromJSON(json).textContent;
}

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  for (const [email, displayName] of [
    ['mira@example.org', 'Mira Kaya'],
    ['olaf@example.org', 'Olaf Außen'],
  ]) {
    await admin.request('POST', '/admin/users', {
      email,
      displayName,
      password: 'ein-langes-passwort',
    });
  }
  const users = (await admin.request<Array<{ id: string; email: string }>>('GET', '/admin/users'))
    .body;
  const olafId = users.find((user) => user.email === 'olaf@example.org')?.id;
  await admin.request('DELETE', `/admin/groups/users/members/${olafId}`);
  mira = await signIn('mira@example.org');
  olaf = await signIn('olaf@example.org');
  // Everyone in "users" edits new spaces; Lena administers them.
  await admin.request('POST', '/spaces', { key: 'DOCS', name: 'Doku' });
  await admin.request('POST', '/spaces', { key: 'TEAM', name: 'Team' });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('page templates', () => {
  let spaceTemplate: PageTemplate;

  it('offer the blueprints in every space', async () => {
    const list = (await mira.request<PageTemplateSummary[]>('GET', '/spaces/DOCS/templates')).body;
    expect(list.map((entry) => entry.ref)).toEqual([
      'blueprint:meeting',
      'blueprint:decision',
      'blueprint:requirements',
      'blueprint:retro',
      'blueprint:project-plan',
      'blueprint:how-to',
      'blueprint:post-mortem',
      'blueprint:release-notes',
    ]);
    expect(list[0]).toMatchObject({
      kind: 'blueprint',
      name: 'Besprechungsnotizen',
      title: '{date} Besprechung',
    });
    const meeting = (await mira.request<PageTemplate>('GET', '/page-templates/blueprint:meeting'))
      .body;
    expect(meeting).toMatchObject({ canEdit: false });
    expect(meeting.content.type).toBe('doc');
  });

  it('are managed by the space administration', async () => {
    const body = { name: 'Release-Notiz', title: 'Release ', content: doc('Was ist neu?') };
    expect((await mira.request('POST', '/spaces/DOCS/templates', body)).status).toBe(403);
    const created = await admin.request<PageTemplate>('POST', '/spaces/DOCS/templates', body);
    expect(created.status).toBe(201);
    spaceTemplate = created.body;
    expect(spaceTemplate).toMatchObject({ kind: 'space', spaceKey: 'DOCS', canEdit: true });
    expect(
      (await mira.request<PageTemplate>('GET', `/page-templates/${spaceTemplate.id}`)).body.canEdit,
    ).toBe(false);
    expect(
      (await mira.request('PUT', `/page-templates/${spaceTemplate.id}`, { ...body, name: 'Meins' }))
        .status,
    ).toBe(403);
    // Only the space it belongs to offers it.
    const team = (await mira.request<PageTemplateSummary[]>('GET', '/spaces/TEAM/templates')).body;
    expect(team.some((entry) => entry.id === spaceTemplate.id)).toBe(false);
    // Outsiders see neither the space nor its templates.
    expect((await olaf.request('GET', `/page-templates/${spaceTemplate.id}`)).status).toBe(404);
  });

  it('are global for the system administration', async () => {
    const body = { name: 'How-to', description: 'Schritt für Schritt', content: doc('Schritte') };
    expect((await mira.request('POST', '/page-templates', body)).status).toBe(403);
    const created = await admin.request<PageTemplate>('POST', '/page-templates', body);
    expect(created.body).toMatchObject({ kind: 'global', spaceKey: null });
    const team = (await mira.request<PageTemplateSummary[]>('GET', '/spaces/TEAM/templates')).body;
    expect(team.at(-1)?.name).toBe('How-to');
  });

  it('only take valid documents without images', async () => {
    const invalid = { name: 'Kaputt', content: { type: 'doc', content: [{ type: 'script' }] } };
    expect((await admin.request('POST', '/page-templates', invalid)).status).toBe(400);
    const image = {
      name: 'Bild',
      content: {
        type: 'doc',
        content: [
          {
            type: 'image',
            attrs: {
              attachmentId: '01a1877e-24b1-7275-a638-b4f533975092',
              alt: '',
              width: null,
              align: 'center',
              caption: '',
            },
          },
        ],
      },
    };
    expect((await admin.request('POST', '/page-templates', image)).status).toBe(400);
  });

  it('start a new page as its draft', async () => {
    const fromBlueprint = await mira.request<Page>('POST', '/spaces/DOCS/pages', {
      title: '2026-10-30 Besprechung',
      template: 'blueprint:meeting',
    });
    expect(fromBlueprint.status).toBe(201);
    expect(fromBlueprint.body.version).toBe(0);
    expect(await draftText(fromBlueprint.body.id)).toContain('Agenda');

    const fromSpace = await mira.request<Page>('POST', '/spaces/DOCS/pages', {
      title: 'Release 2.0',
      template: spaceTemplate.id,
    });
    expect(await draftText(fromSpace.body.id)).toBe('Was ist neu?');

    // A space template stays in its space.
    const elsewhere = await mira.request('POST', '/spaces/TEAM/pages', {
      title: 'Falsch',
      template: spaceTemplate.id,
    });
    expect(elsewhere.status).toBe(400);
    expect(
      (await mira.request('POST', '/spaces/DOCS/pages', { title: 'X', template: 'blueprint:nope' }))
        .status,
    ).toBe(404);
  });

  it('are deleted by their administration', async () => {
    expect((await mira.request('DELETE', `/page-templates/${spaceTemplate.id}`)).status).toBe(403);
    expect((await admin.request('DELETE', `/page-templates/${spaceTemplate.id}`)).status).toBe(204);
    expect((await admin.request('GET', `/page-templates/${spaceTemplate.id}`)).status).toBe(404);
  });
});
