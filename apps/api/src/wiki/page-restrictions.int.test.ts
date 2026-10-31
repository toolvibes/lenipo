import type { Page, PageRestrictions, PageTreeEntry, RestrictedPage } from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let nina: TestClient;
let olaf: TestClient;
let miraId = '';
let start: Page;
let child: Page;

const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

async function signIn(email: string): Promise<TestClient> {
  const client = new TestClient(test.baseUrl);
  await client.request('POST', '/auth/login', { email, password: 'ein-langes-passwort' });
  return client;
}

async function tree(client: TestClient): Promise<string[]> {
  return (await client.request<PageTreeEntry[]>('GET', '/spaces/DOCS/pages')).body.map(
    (entry) => entry.title,
  );
}

async function page(client: TestClient, title: string, parentId?: string): Promise<Page> {
  const created = (await client.request<Page>('POST', '/spaces/DOCS/pages', { title, parentId }))
    .body;
  await client.request('POST', `/pages/${created.id}/publish`, { title, content: doc(title) });
  return created;
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
  const ids: Record<string, string> = {};
  for (const [email, displayName] of [
    ['mira@example.org', 'Mira Kaya'],
    ['nina@example.org', 'Nina Berg'],
    ['olaf@example.org', 'Olaf Alt'],
  ] as const) {
    ids[email] = (
      await admin.request<{ id: string }>('POST', '/admin/users', {
        email,
        displayName,
        password: 'ein-langes-passwort',
      })
    ).body.id;
  }
  miraId = ids['mira@example.org'] ?? '';
  mira = await signIn('mira@example.org');
  nina = await signIn('nina@example.org');
  olaf = await signIn('olaf@example.org');
  await admin.request('POST', '/spaces', { key: 'DOCS', name: 'Doku' });
  await admin.request('POST', '/spaces/DOCS/members', { role: 'editors', userId: miraId });
  await admin.request('POST', '/spaces/DOCS/members', {
    role: 'editors',
    userId: ids['nina@example.org'],
  });
  await admin.request('POST', '/spaces/DOCS/members', {
    role: 'viewers',
    userId: ids['olaf@example.org'],
  });
  start = await page(mira, 'Start');
  child = await page(mira, 'Gehälter', start.id);
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('page restrictions (TL-14)', () => {
  it('hide a page and everything below from people not on the view list', async () => {
    const set = await mira.request<PageRestrictions>('PUT', `/pages/${start.id}/restrictions`, {
      view: { userIds: [], groupIds: [] },
      edit: { userIds: [], groupIds: [] },
    });
    expect(set.status).toBe(200);
    expect(set.body.view.users).toEqual([]);
    // Nina restricts viewing to herself; she stays on the list without naming herself.
    const restricted = await nina.request<PageRestrictions>(
      'PUT',
      `/pages/${start.id}/restrictions`,
      { view: { userIds: [miraId], groupIds: [] }, edit: { userIds: [], groupIds: [] } },
    );
    expect(restricted.body.view.users.map((user) => user.displayName).sort()).toEqual([
      'Mira Kaya',
      'Nina Berg',
    ]);
    expect((await olaf.request('GET', `/pages/${start.id}`)).status).toBe(404);
    expect((await olaf.request('GET', `/pages/${child.id}`)).status).toBe(404);
    expect(await tree(olaf)).toEqual([]);
    // Global administrators do not get past a restriction either.
    expect((await admin.request('GET', `/pages/${child.id}`)).status).toBe(404);
    expect(await tree(mira)).toEqual(['Start', 'Gehälter']);
    const below = (await mira.request<Page>('GET', `/pages/${child.id}`)).body;
    expect(below.restrictions).toEqual({ view: false, edit: false, inherited: true });
  });

  it('let space administrators lift restrictions they cannot see past', async () => {
    const list = await admin.request<RestrictedPage[]>('GET', '/spaces/DOCS/restricted-pages');
    expect(list.body).toEqual([{ id: start.id, title: 'Start', view: true, edit: false }]);
    expect((await mira.request('GET', '/spaces/DOCS/restricted-pages')).status).toBe(403);
    expect(
      (await admin.request('DELETE', `/spaces/DOCS/restricted-pages/${start.id}`)).status,
    ).toBe(204);
    expect(await tree(olaf)).toEqual(['Start', 'Gehälter']);
  });

  it('limit editing of one page to its edit list', async () => {
    await mira.request('PUT', `/pages/${child.id}/restrictions`, {
      view: { userIds: [], groupIds: [] },
      edit: { userIds: [miraId], groupIds: [] },
    });
    const seen = (await nina.request<Page>('GET', `/pages/${child.id}`)).body;
    expect(seen.canEdit).toBe(false);
    expect(
      (
        await nina.request('POST', `/pages/${child.id}/publish`, {
          title: 'Gehälter',
          content: doc('anders'),
        })
      ).status,
    ).toBe(403);
    // The page above stays editable: edit lists are not inherited.
    expect((await nina.request<Page>('GET', `/pages/${start.id}`)).body.canEdit).toBe(true);
  });
});
