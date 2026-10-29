import type {
  Page,
  PageTreeEntry,
  PageVersion,
  PageVersionSummary,
  Space,
  SpaceMember,
  SpaceSummary,
  TrashedPage,
} from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let olaf: TestClient;
let miraId: string;
let olafId: string;

async function signIn(email: string): Promise<TestClient> {
  const client = new TestClient(test.baseUrl);
  await client.request('POST', '/auth/login', { email, password: 'ein-langes-passwort' });
  return client;
}

const doc = (text: string) => ({
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Ziel' }] },
    { type: 'paragraph', content: [{ type: 'text', text }] },
  ],
});

async function tree(client: TestClient): Promise<string[]> {
  const response = await client.request<PageTreeEntry[]>('GET', '/spaces/DOCS/pages');
  return response.body.map((entry) => entry.title);
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
  const create = async (email: string, displayName: string) =>
    (
      await admin.request<{ id: string }>('POST', '/admin/users', {
        email,
        displayName,
        password: 'ein-langes-passwort',
      })
    ).body.id;
  miraId = await create('mira@example.org', 'Mira Kaya');
  olafId = await create('olaf@example.org', 'Olaf Alt');
  mira = await signIn('mira@example.org');
  olaf = await signIn('olaf@example.org');
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('spaces', () => {
  it('needs create-spaces to create one; the creator administers it', async () => {
    expect(
      (await mira.request('POST', '/spaces', { key: 'MIRA', name: 'Miras Bereich' })).status,
    ).toBe(403);
    const created = await admin.request<Space>('POST', '/spaces', {
      key: 'DOCS',
      name: 'Dokumentation',
      description: 'Wie wir arbeiten',
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ key: 'DOCS', homePageId: null });
    expect(created.body.permissions).toEqual(['administer', 'comment', 'edit', 'view']);
    expect((await admin.request('POST', '/spaces', { key: 'DOCS', name: 'Doppelt' })).status).toBe(
      409,
    );
  });

  it('lets all signed-in users edit by default', async () => {
    const space = await olaf.request<Space>('GET', '/spaces/docs');
    expect(space.body.permissions).toEqual(['comment', 'edit', 'view']);
    const list = await olaf.request<SpaceSummary[]>('GET', '/spaces');
    expect(list.body.map((entry) => entry.key)).toEqual(['DOCS']);
  });

  it('manages role assignments; the last administrator stays', async () => {
    const members = await admin.request<SpaceMember[]>('GET', '/spaces/DOCS/members');
    const everyone = members.body.find((member) => member.group?.name === 'users');
    const lena = members.body.find((member) => member.role === 'administrators');
    expect(everyone?.role).toBe('editors');
    // From now on: Mira edits, Olaf only reads.
    await admin.request('DELETE', `/spaces/DOCS/members/${everyone?.id}`);
    await admin.request('POST', '/spaces/DOCS/members', { role: 'editors', userId: miraId });
    const after = await admin.request<SpaceMember[]>('POST', '/spaces/DOCS/members', {
      role: 'viewers',
      userId: olafId,
    });
    expect(after.status).toBe(201);
    expect(after.body.map((member) => member.role).sort()).toEqual([
      'administrators',
      'editors',
      'viewers',
    ]);
    expect(
      (await admin.request('POST', '/spaces/DOCS/members', { role: 'viewers', userId: olafId }))
        .status,
    ).toBe(409);
    expect((await admin.request('DELETE', `/spaces/DOCS/members/${lena?.id}`)).status).toBe(409);
    expect((await mira.request('GET', '/spaces/DOCS/members')).status).toBe(403);
    expect((await olaf.request<Space>('GET', '/spaces/DOCS')).body.permissions).toEqual(['view']);
  });
});

describe('pages', () => {
  let home: Page;
  let child: Page;

  it('creates drafts that only editors see; the first page becomes home', async () => {
    const created = await mira.request<Page>('POST', '/spaces/DOCS/pages', { title: 'Start' });
    expect(created.status).toBe(201);
    home = created.body;
    expect(home).toMatchObject({ title: 'Start', version: 0, content: null, canEdit: true });
    expect((await mira.request<Space>('GET', '/spaces/DOCS')).body.homePageId).toBe(home.id);

    expect(await tree(mira)).toEqual(['Start']);
    expect(await tree(olaf)).toEqual([]);
    expect((await olaf.request('GET', `/pages/${home.id}`)).status).toBe(404);
    expect((await olaf.request('POST', '/spaces/DOCS/pages', { title: 'Nein' })).status).toBe(403);
  });

  it('publishes versions that readers see', async () => {
    expect(
      (
        await mira.request('POST', `/pages/${home.id}/publish`, {
          title: 'Start',
          content: { type: 'doc', content: [{ type: 'script' }] },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await olaf.request('POST', `/pages/${home.id}/publish`, {
          title: 'Start',
          content: doc('x'),
        })
      ).status,
    ).toBe(404);

    const first = await mira.request<Page>('POST', `/pages/${home.id}/publish`, {
      title: 'Willkommen',
      content: doc('Erste Fassung'),
      comment: 'Angelegt',
    });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ title: 'Willkommen', version: 1 });
    await mira.request('POST', `/pages/${home.id}/publish`, {
      title: 'Willkommen',
      content: doc('Zweite Fassung'),
    });

    const seen = await olaf.request<Page>('GET', `/pages/${home.id}`);
    expect(seen.body).toMatchObject({
      version: 2,
      canEdit: false,
      publishedBy: { displayName: 'Mira Kaya' },
    });
    expect(JSON.stringify(seen.body.content)).toContain('Zweite Fassung');
    const markdown = await olaf.request<Page>('GET', `/pages/${home.id}?format=markdown`);
    expect(markdown.body.content).toBe('## Ziel\n\nZweite Fassung');
    expect(
      (
        await olaf.request('POST', `/pages/${home.id}/publish`, {
          title: 'x',
          content: doc('x'),
        })
      ).status,
    ).toBe(403);

    const versions = await olaf.request<PageVersionSummary[]>('GET', `/pages/${home.id}/versions`);
    expect(versions.body.map((entry) => [entry.number, entry.comment])).toEqual([
      [2, ''],
      [1, 'Angelegt'],
    ]);
    const old = await olaf.request<PageVersion>('GET', `/pages/${home.id}/versions/1`);
    expect(JSON.stringify(old.body.content)).toContain('Erste Fassung');
    expect((await olaf.request('GET', `/pages/${home.id}/versions/9`)).status).toBe(404);
  });

  it('nests pages, shows breadcrumbs and hides drafts below published pages', async () => {
    child = (
      await mira.request<Page>('POST', '/spaces/DOCS/pages', {
        title: 'Einrichtung',
        parentId: home.id,
      })
    ).body;
    const grandchild = (
      await mira.request<Page>('POST', '/spaces/DOCS/pages', {
        title: 'Datenbank',
        parentId: child.id,
      })
    ).body;
    expect(grandchild.ancestors.map((entry) => entry.title)).toEqual(['Willkommen', 'Einrichtung']);
    await mira.request('POST', `/pages/${grandchild.id}/publish`, {
      title: 'Datenbank',
      content: doc('Postgres'),
    });
    expect(await tree(mira)).toEqual(['Willkommen', 'Einrichtung', 'Datenbank']);
    // The published grandchild stays hidden while its parent is a draft.
    expect(await tree(olaf)).toEqual(['Willkommen']);
    await mira.request('POST', `/pages/${child.id}/publish`, {
      title: 'Einrichtung',
      content: doc('Schritte'),
    });
    expect(await tree(olaf)).toEqual(['Willkommen', 'Einrichtung', 'Datenbank']);
  });

  it('moves and renames pages, never below themselves', async () => {
    expect(
      (await mira.request('POST', `/pages/${home.id}/move`, { parentId: child.id })).status,
    ).toBe(400);
    const moved = await mira.request<Page>('POST', `/pages/${child.id}/move`, {
      parentId: null,
      beforeId: home.id,
    });
    expect(moved.body.ancestors).toEqual([]);
    expect(await tree(mira)).toEqual(['Einrichtung', 'Datenbank', 'Willkommen']);
    await mira.request('POST', `/pages/${child.id}/move`, { parentId: null });
    expect(await tree(mira)).toEqual(['Willkommen', 'Einrichtung', 'Datenbank']);
    const renamed = await mira.request<Page>('PATCH', `/pages/${child.id}`, { title: 'Setup' });
    expect(renamed.body.title).toBe('Setup');
  });

  it('moves pages with their subtree to the trash and back', async () => {
    expect((await mira.request('DELETE', `/pages/${child.id}`)).status).toBe(204);
    expect(await tree(mira)).toEqual(['Willkommen']);
    expect((await olaf.request('GET', `/pages/${child.id}`)).status).toBe(404);
    expect((await olaf.request('GET', '/spaces/DOCS/trash')).status).toBe(403);
    const trash = await mira.request<TrashedPage[]>('GET', '/spaces/DOCS/trash');
    expect(trash.body.map((entry) => [entry.title, entry.deletedBy?.displayName])).toEqual([
      ['Setup', 'Mira Kaya'],
    ]);
    const restored = await mira.request<Page>('POST', `/pages/${child.id}/restore`);
    expect(restored.status).toBe(200);
    expect(await tree(mira)).toEqual(['Willkommen', 'Setup', 'Datenbank']);
    expect((await mira.request<TrashedPage[]>('GET', '/spaces/DOCS/trash')).body).toEqual([]);
  });

  it('forgets the home page when it goes to the trash', async () => {
    await mira.request('DELETE', `/pages/${home.id}`);
    expect((await mira.request<Space>('GET', '/spaces/DOCS')).body.homePageId).toBeNull();
    await mira.request('POST', `/pages/${home.id}/restore`);
    const set = await admin.request<Space>('PATCH', '/spaces/DOCS', { homePageId: home.id });
    expect(set.body.homePageId).toBe(home.id);
    expect((await mira.request('PATCH', '/spaces/DOCS', { name: 'Neu' })).status).toBe(403);
  });
});
