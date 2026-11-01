import type {
  NotificationList,
  NotificationScheme,
  NotificationSchemeSummary,
  ProjectDetails,
} from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EventProcessor } from '../events/event-processor.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let olaf: TestClient;
let ids: Record<string, string> = {};

async function signIn(email: string): Promise<TestClient> {
  const client = new TestClient(test.baseUrl);
  await client.request('POST', '/auth/login', { email, password: 'ein-langes-passwort' });
  return client;
}

async function inbox(client: TestClient): Promise<string[]> {
  await test.app.get(EventProcessor).drain();
  const list = (await client.request<NotificationList>('GET', '/me/notifications')).body;
  return list.notifications.map((item) => `${item.issue?.key ?? ''}:${item.category}`);
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
    ['olaf@example.org', 'Olaf Alt'],
  ]) {
    await admin.request('POST', '/admin/users', {
      email,
      displayName,
      password: 'ein-langes-passwort',
    });
  }
  const people = (await admin.request<Array<{ id: string; email: string }>>('GET', '/admin/users'))
    .body;
  ids = Object.fromEntries(people.map((person) => [person.email, person.id]));
  mira = await signIn('mira@example.org');
  olaf = await signIn('olaf@example.org');
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  await admin.request('POST', '/projects/WEB/members', {
    role: 'developers',
    userId: ids['mira@example.org'],
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('notification schemes (TL-71)', () => {
  it('start with the default scheme: every event to the watchers', async () => {
    const list = (
      await admin.request<NotificationSchemeSummary[]>('GET', '/admin/notification-schemes')
    ).body;
    expect(list.map((scheme) => [scheme.name, scheme.isDefault])).toEqual([['Standard', true]]);
    const standard = (
      await admin.request<NotificationScheme>('GET', `/admin/notification-schemes/${list[0]?.id}`)
    ).body;
    expect(standard.rules.every((rule) => rule.recipient === 'watchers')).toBe(true);
    expect(standard.rules).toHaveLength(5);
    expect((await mira.request('GET', '/admin/notification-schemes')).status).toBe(403);
    // Lena creates an issue: nobody else watches it yet, so nobody hears of it.
    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Erst',
    });
    expect(await inbox(mira)).toEqual([]);
  });

  it('send new issues to a role and a person, comments only to the reporter', async () => {
    const created = (
      await admin.request<NotificationScheme>('POST', '/admin/notification-schemes', {
        name: 'Laut',
      })
    ).body;
    const scheme = (
      await admin.request<NotificationScheme>(
        'PATCH',
        `/admin/notification-schemes/${created.id}`,
        {
          rules: [
            { event: 'created', role: 'developers' },
            { event: 'created', userId: ids['olaf@example.org'] },
            { event: 'commented', recipient: 'reporter' },
          ],
        },
      )
    ).body;
    expect(scheme.rules).toHaveLength(3);
    expect(
      (await mira.request('PUT', '/projects/WEB/notification-scheme', { schemeId: scheme.id }))
        .status,
    ).toBe(403);
    expect(
      (await admin.request('PUT', '/projects/WEB/notification-scheme', { schemeId: scheme.id }))
        .status,
    ).toBe(204);
    expect(
      (await admin.request<ProjectDetails>('GET', '/projects/WEB')).body.notificationScheme.name,
    ).toBe('Laut');

    const issue = (
      await admin.request<{ key: string }>('POST', '/issues', {
        projectKey: 'WEB',
        issueType: 'task',
        summary: 'Neu',
      })
    ).body;
    expect(await inbox(mira)).toEqual([`${issue.key}:other`]);
    expect(await inbox(olaf)).toEqual([`${issue.key}:other`]);

    // Mira comments: the reporter (Lena) hears of it, Olaf does not, although he was told before.
    await mira.request('POST', `/issues/${issue.key}/comments`, { body: { markdown: 'Erledigt' } });
    expect(await inbox(admin)).toEqual([`${issue.key}:comment`]);
    expect(await inbox(olaf)).toEqual([`${issue.key}:other`]);
    // Mentions always notify, whatever the scheme says.
    await admin.request('POST', `/issues/${issue.key}/comments`, {
      body: { markdown: `Danke @[Olaf Alt](user:${ids['olaf@example.org']})` },
    });
    expect((await inbox(olaf))[0]).toBe(`${issue.key}:mention`);
  });

  it('keep the default scheme and schemes in use', async () => {
    const list = (
      await admin.request<NotificationSchemeSummary[]>('GET', '/admin/notification-schemes')
    ).body;
    const loud = list.find((entry) => entry.name === 'Laut');
    const standard = list.find((entry) => entry.isDefault);
    expect(
      (await admin.request('DELETE', `/admin/notification-schemes/${standard?.id}`)).status,
    ).toBe(409);
    expect((await admin.request('DELETE', `/admin/notification-schemes/${loud?.id}`)).status).toBe(
      409,
    );
    await admin.request('PUT', '/projects/WEB/notification-scheme', { schemeId: null });
    expect((await admin.request('DELETE', `/admin/notification-schemes/${loud?.id}`)).status).toBe(
      204,
    );
  });
});
