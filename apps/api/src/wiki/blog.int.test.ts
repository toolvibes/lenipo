import type { Blog, FeedToken, Page, PageTreeEntry, Space } from '@tasklore/shared';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { PageService } from './page.service.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let miraId = '';
let post: Page;

const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  miraId = (
    await admin.request<{ id: string }>('POST', '/admin/users', {
      email: 'mira@example.org',
      displayName: 'Mira Kaya',
      password: 'ein-langes-passwort',
    })
  ).body.id;
  mira = new TestClient(test.baseUrl);
  await mira.request('POST', '/auth/login', {
    email: 'mira@example.org',
    password: 'ein-langes-passwort',
  });
  await admin.request('POST', '/spaces', { key: 'DOC', name: 'Doku', type: 'documentation' });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('blog, page status and space types (TL-29)', () => {
  it('keeps the type of a space and gives everyone a private personal space', async () => {
    expect((await admin.request<Space>('GET', '/spaces/DOC')).body.type).toBe('documentation');
    const personal = (await admin.request<Space>('POST', '/me/space')).body;
    expect(personal).toMatchObject({ type: 'personal', name: 'Lena Vogt' });
    expect(personal.key).toMatch(/^P[A-Z0-9]+$/);
    // The same space on the next call; private to its owner.
    expect((await admin.request<Space>('POST', '/me/space')).body.key).toBe(personal.key);
    expect((await mira.request('GET', `/spaces/${personal.key}`)).status).toBe(404);
  });

  it('publishes blog posts outside the page tree', async () => {
    post = (
      await admin.request<Page>('POST', '/spaces/DOC/pages', {
        title: 'Neu im Oktober',
        kind: 'blog',
      })
    ).body;
    expect(post.kind).toBe('blog');
    await admin.request('POST', `/pages/${post.id}/publish`, {
      title: 'Neu im Oktober',
      content: doc('Wir haben Dashboards.'),
    });
    const blog = (await mira.request<Blog>('GET', '/spaces/DOC/blog')).body;
    expect(blog.posts.map((entry) => [entry.title, entry.excerpt])).toEqual([
      ['Neu im Oktober', 'Wir haben Dashboards.'],
    ]);
    expect(blog.months).toHaveLength(1);
    const tree = (await admin.request<PageTreeEntry[]>('GET', '/spaces/DOC/pages')).body;
    expect(tree.map((entry) => entry.id)).not.toContain(post.id);
  });

  it('serves an Atom feed with a personal token', async () => {
    const { token } = (await mira.request<FeedToken>('GET', '/me/feed-token')).body;
    const anonymous = new TestClient(test.baseUrl);
    expect(
      (await anonymous.request('GET', '/feeds/spaces/DOC/blog.atom?token=falsch')).status,
    ).toBe(404);
    const response = await fetch(`${test.baseUrl}/feeds/spaces/DOC/blog.atom?token=${token}`);
    const text = await response.text();
    expect(response.headers.get('content-type'), text).toContain('application/atom+xml');
    expect(text).toContain('<title>Neu im Oktober</title>');
  });

  it('has a status and an owner; verified pages become outdated', async () => {
    const page = (await admin.request<Page>('POST', '/spaces/DOC/pages', { title: 'Betrieb' }))
      .body;
    expect(page).toMatchObject({ status: 'none', owner: { displayName: 'Lena Vogt' } });
    const verified = await admin.request<Page>('PUT', `/pages/${page.id}/status`, {
      status: 'verified',
      ownerId: miraId,
    });
    expect(verified.body).toMatchObject({
      status: 'verified',
      owner: { displayName: 'Mira Kaya' },
    });
    const database = test.app.get<DatabaseHandle>(DATABASE);
    await database.db.execute(
      sql`update pages set created_at = now() - interval '40 days', status_changed_at = now() - interval '40 days' where id = ${page.id}`,
    );
    expect(await test.app.get(PageService).markOutdated(30)).toBe(1);
    expect((await admin.request<Page>('GET', `/pages/${page.id}`)).body.status).toBe('outdated');
    // A deactivated owner leaves the page to the space administrators.
    await database.db.execute(sql`update users set status = 'deactivated' where id = ${miraId}`);
    expect((await admin.request<Page>('GET', `/pages/${page.id}`)).body.owner).toBeNull();
  });
});
