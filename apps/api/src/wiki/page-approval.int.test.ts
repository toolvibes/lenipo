import type { Page, PageAnalytics, PendingApproval } from '@toolvibes/shared';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { RetentionService } from '../maintenance/retention.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let olaf: TestClient;
let olafId = '';
let page: Page;

const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});
const textOf = (value: Page['content']) => JSON.stringify(value);

async function signIn(email: string): Promise<TestClient> {
  const client = new TestClient(test.baseUrl);
  await client.request('POST', '/auth/login', { email, password: 'ein-langes-passwort' });
  return client;
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
  for (const [email, name] of [
    ['mira@example.org', 'Mira Kaya'],
    ['olaf@example.org', 'Olaf Alt'],
  ] as const) {
    const created = await admin.request<{ id: string }>('POST', '/admin/users', {
      email,
      displayName: name,
      password: 'ein-langes-passwort',
    });
    if (email.startsWith('olaf')) olafId = created.body.id;
  }
  mira = await signIn('mira@example.org');
  olaf = await signIn('olaf@example.org');
  await admin.request('POST', '/spaces', { key: 'DOCS', name: 'Doku' });
  page = (await admin.request<Page>('POST', '/spaces/DOCS/pages', { title: 'Richtlinie' })).body;
  await admin.request('POST', `/pages/${page.id}/publish`, {
    title: 'Richtlinie',
    content: doc('Eins'),
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('page approval (TL-51)', () => {
  it('holds new versions back until an approver approves them', async () => {
    expect((await admin.request('PATCH', '/spaces/DOCS', { approvalRequired: true })).status).toBe(
      200,
    );

    const submitted = await mira.request<Page>('POST', `/pages/${page.id}/publish`, {
      title: 'Richtlinie',
      content: doc('Zwei'),
      comment: 'Neue Regel',
    });
    expect(submitted.body.version).toBe(1);
    expect(submitted.body.approval).toMatchObject({
      required: true,
      canApprove: false,
      pending: { comment: 'Neue Regel', author: { displayName: 'Mira Kaya' } },
    });
    // Readers keep the approved version.
    expect(textOf((await olaf.request<Page>('GET', `/pages/${page.id}`)).body.content)).toContain(
      'Eins',
    );
    expect((await mira.request('POST', `/pages/${page.id}/approval/approve`)).status).toBe(403);
    const pending = await admin.request<PendingApproval[]>('GET', '/spaces/DOCS/approvals');
    expect(pending.body.map((entry) => entry.title)).toEqual(['Richtlinie']);

    const approved = await admin.request<Page>('POST', `/pages/${page.id}/approval/approve`);
    expect(approved.body).toMatchObject({
      version: 2,
      publishedBy: { displayName: 'Mira Kaya' },
      approval: { pending: null },
    });
    expect(textOf(approved.body.content)).toContain('Zwei');
  });

  it('returns rejected versions with a comment; approvers and pages can opt out', async () => {
    await mira.request('POST', `/pages/${page.id}/publish`, {
      title: 'Richtlinie',
      content: doc('Drei'),
    });
    const rejected = await admin.request<Page>('POST', `/pages/${page.id}/approval/reject`, {
      comment: 'Bitte Quelle angeben',
    });
    expect(rejected.body.approval).toMatchObject({
      pending: null,
      rejected: { comment: 'Bitte Quelle angeben', by: { displayName: 'Lena Vogt' } },
    });
    expect(rejected.body.version).toBe(2);

    // Approvers are a space role and publish without waiting.
    await admin.request('POST', '/spaces/DOCS/members', { role: 'approvers', userId: olafId });
    const direct = await olaf.request<Page>('POST', `/pages/${page.id}/publish`, {
      title: 'Richtlinie',
      content: doc('Vier'),
    });
    expect(direct.body).toMatchObject({ version: 3, approval: { canApprove: true } });

    await admin.request('PUT', `/pages/${page.id}/approval-mode`, { mode: 'off' });
    const free = await mira.request<Page>('POST', `/pages/${page.id}/publish`, {
      title: 'Richtlinie',
      content: doc('Fünf'),
    });
    expect(free.body).toMatchObject({ version: 4, approval: { required: false, mode: 'off' } });
  });
});

describe('page analytics (TL-51)', () => {
  it('counts views per day; names only for administrators; old days stay anonymous', async () => {
    for (const client of [mira, mira, olaf]) {
      await client.request('POST', '/me/recent', { kind: 'page', ref: page.id });
    }
    const forMira = await mira.request<PageAnalytics>('GET', `/pages/${page.id}/analytics`);
    expect(forMira.body).toMatchObject({ views: 3, readers: 2, readerList: null });
    expect(forMira.body.daily).toHaveLength(1);
    const forAdmin = await admin.request<PageAnalytics>('GET', `/pages/${page.id}/analytics`);
    expect(forAdmin.body.readerList?.map((entry) => [entry.user.displayName, entry.views])).toEqual(
      [
        ['Mira Kaya', 2],
        ['Olaf Alt', 1],
      ],
    );

    // A view from 100 days ago turns into an anonymous count.
    await test.database.db.execute(sql`
      insert into page_views (page_id, day, user_id, views)
      values (${page.id}, current_date - 100, ${olafId}, 4)`);
    const result = await test.app.get(RetentionService).run();
    expect(result.pageViews).toBe(1);
    const year = await admin.request<PageAnalytics>('GET', `/pages/${page.id}/analytics?days=365`);
    expect(year.body).toMatchObject({ views: 7, readers: 3 });
    expect(
      year.body.readerList?.find((entry) => entry.user.displayName === 'Olaf Alt')?.views,
    ).toBe(1);
  });
});
