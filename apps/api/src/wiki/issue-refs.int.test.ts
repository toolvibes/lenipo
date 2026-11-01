import type { IssueLookup, IssuePageRef, Page, Space } from '@toolvibes/shared';
import { and, eq, isNotNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spaceRoleMembers } from '../db/schema/index.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let olaf: TestClient;

const text = (value: string, marks?: Array<{ type: string }>) => ({
  type: 'text',
  text: value,
  marks,
});
const paragraph = (...content: unknown[]) => ({ type: 'paragraph', content });

async function signIn(email: string): Promise<TestClient> {
  const client = new TestClient(test.baseUrl);
  await client.request('POST', '/auth/login', { email, password: 'ein-langes-passwort' });
  return client;
}

async function publish(spaceKey: string, title: string, content: unknown): Promise<Page> {
  const page = (await admin.request<Page>('POST', `/spaces/${spaceKey}/pages`, { title })).body;
  await admin.request('POST', `/pages/${page.id}/publish`, { title, content });
  return page;
}

async function pagesOf(client: TestClient, key: string): Promise<IssuePageRef[]> {
  return (await client.request<IssuePageRef[]>('GET', `/issues/${key}/pages`)).body;
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

  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  for (const summary of ['Anmelden', 'Abmelden', 'Profil']) {
    await admin.request('POST', '/issues', { projectKey: 'WEB', issueType: 'task', summary });
  }
  await admin.request('POST', '/spaces', { key: 'DOCS', name: 'Doku' });
  const secret = (await admin.request<Space>('POST', '/spaces', { key: 'GEHEIM', name: 'Geheim' }))
    .body;
  // Only Lena keeps a role in the secret space.
  await test.database.db
    .delete(spaceRoleMembers)
    .where(and(eq(spaceRoleMembers.spaceId, secret.id), isNotNull(spaceRoleMembers.groupId)));
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('issue references in wiki pages', () => {
  let plan: Page;

  it('index mentions and macros, but not code', async () => {
    plan = await publish('DOCS', 'Plan', {
      type: 'doc',
      content: [
        paragraph(text('WEB-1 ist fertig, als Nächstes '), {
          type: 'issue',
          attrs: { key: 'WEB-2' },
        }),
        paragraph(text('WEB-3', [{ type: 'code' }]), text(' und WEB-99 gibt es nicht')),
      ],
    });
    expect(
      (await pagesOf(mira, 'WEB-1')).map((ref) => [ref.title, ref.kind, ref.space.key]),
    ).toEqual([['Plan', 'mention', 'DOCS']]);
    expect((await pagesOf(mira, 'WEB-2'))[0]?.kind).toBe('macro');
    expect(await pagesOf(mira, 'WEB-3')).toEqual([]);
  });

  it('follow the latest version and hide trashed pages', async () => {
    await admin.request('POST', `/pages/${plan.id}/publish`, {
      title: 'Plan',
      content: { type: 'doc', content: [paragraph(text('Jetzt nur noch WEB-2'))] },
    });
    expect(await pagesOf(mira, 'WEB-1')).toEqual([]);
    expect((await pagesOf(mira, 'WEB-2'))[0]?.kind).toBe('mention');
    await admin.request('DELETE', `/pages/${plan.id}`);
    expect(await pagesOf(mira, 'WEB-2')).toEqual([]);
  });

  it('list only pages the viewer may read', async () => {
    await publish('GEHEIM', 'Interna', { type: 'doc', content: [paragraph(text('Zu WEB-3'))] });
    expect((await pagesOf(admin, 'WEB-3')).map((ref) => ref.title)).toEqual(['Interna']);
    expect(await pagesOf(mira, 'WEB-3')).toEqual([]);
    expect((await olaf.request('GET', '/issues/WEB-3/pages')).status).toBe(404);
  });
});

describe('issue lookup', () => {
  it('answers visible issues only', async () => {
    const found = (
      await mira.request<IssueLookup[]>('POST', '/issues/lookup', {
        keys: ['WEB-1', 'web-2', 'WEB-99', 'UTF-8'],
      })
    ).body;
    expect(found.map((issue) => [issue.key, issue.summary, issue.status.name]).sort()).toEqual([
      ['WEB-1', 'Anmelden', 'Offen'],
      ['WEB-2', 'Abmelden', 'Offen'],
    ]);
    expect(
      (await olaf.request<IssueLookup[]>('POST', '/issues/lookup', { keys: ['WEB-1'] })).body,
    ).toEqual([]);
  });
});
