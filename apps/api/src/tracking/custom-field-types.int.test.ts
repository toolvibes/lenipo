import type { CustomField, GroupSummary, Issue, SearchResult, Version } from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
const field: Record<string, CustomField> = {};
let lena = '';
let mira = '';

async function search(query: string): Promise<string[] | number> {
  const result = await admin.request<SearchResult>('POST', '/search', { query });
  return result.status === 200 ? result.body.issues.map((issue) => issue.key) : result.status;
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
  mira = (
    await admin.request<{ id: string }>('POST', '/admin/users', {
      email: 'mira@example.org',
      displayName: 'Mira Kaya',
      password: 'ein-langes-passwort',
    })
  ).body.id;
  const people = (await admin.request<Array<{ id: string; email: string }>>('GET', '/admin/users'))
    .body;
  lena = people.find((person) => person.email === 'lena@example.org')?.id ?? '';
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  await admin.request('POST', '/projects/WEB/members', { role: 'developers', userId: mira });
  for (const [name, type] of [
    ['Prüfer', 'users'],
    ['Team', 'group'],
    ['Zielversion', 'version'],
    ['Themen', 'labels'],
  ]) {
    field[type as string] = (
      await admin.request<CustomField>('POST', '/admin/custom-fields', { name, type })
    ).body;
  }
  await admin.request('PUT', '/projects/WEB/custom-fields', {
    fieldIds: Object.values(field).map((entry) => entry.id),
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('more custom field types (TL-79)', () => {
  it('store several people, a group, a version and labels', async () => {
    const group = (
      await admin.request<GroupSummary>('POST', '/admin/groups', {
        name: 'plattform',
        description: '',
        globalPermissions: [],
      })
    ).body;
    const version = (
      await admin.request<Version>('POST', '/projects/WEB/versions', { name: '2.0' })
    ).body;
    const created = await admin.request<Issue>('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Alles drin',
      customFields: {
        [field.users?.id ?? '']: [mira, lena, mira],
        [field.group?.id ?? '']: group.id,
        [field.version?.id ?? '']: version.id,
        [field.labels?.id ?? '']: ['web', 'api', 'web'],
      },
    });
    expect(created.status).toBe(201);
    const values = created.body.customFields;
    expect(values[field.users?.id ?? '']).toHaveLength(2);
    expect(values[field.group?.id ?? '']).toEqual({ id: group.id, displayName: 'plattform' });
    expect(values[field.version?.id ?? '']).toEqual({ id: version.id, value: '2.0' });
    expect(values[field.labels?.id ?? '']).toEqual(['api', 'web']);

    const bad = await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Falsch',
      customFields: { [field.labels?.id ?? '']: ['zwei worte'] },
    });
    expect(bad.status).toBe(400);
    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Leer',
    });
  });

  it('find issues by the new fields', async () => {
    expect(await search('Prüfer = "mira@example.org"')).toEqual(['WEB-1']);
    expect(await search('Prüfer = currentUser()')).toEqual(['WEB-1']);
    expect(await search('Team = plattform')).toEqual(['WEB-1']);
    expect(await search('Zielversion = "2.0"')).toEqual(['WEB-1']);
    expect(await search('Themen = api')).toEqual(['WEB-1']);
    expect(await search('Themen is EMPTY')).toEqual(['WEB-2']);
  });

  it('offer cascading options in two levels (TL-82)', async () => {
    const herkunft = (
      await admin.request<CustomField>('POST', '/admin/custom-fields', {
        name: 'Herkunft',
        type: 'cascade',
        options: ['Deutschland > Berlin', 'Deutschland > Hamburg', 'Österreich'],
      })
    ).body;
    expect(herkunft.options.map((option) => option.value)).toEqual([
      'Deutschland',
      'Deutschland › Berlin',
      'Deutschland › Hamburg',
      'Österreich',
    ]);
    expect(
      (
        await admin.request('POST', '/admin/custom-fields', {
          name: 'Zu tief',
          type: 'cascade',
          options: ['a > b > c'],
        })
      ).status,
    ).toBe(400);
    const ids = [...Object.values(field).map((entry) => entry.id), herkunft.id];
    await admin.request('PUT', '/projects/WEB/custom-fields', { fieldIds: ids });
    const berlin = herkunft.options.find((option) => option.value.endsWith('Berlin'))?.id;
    const created = await admin.request<Issue>('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Aus Berlin',
      customFields: { [herkunft.id]: berlin },
    });
    expect(created.body.customFields[herkunft.id]).toEqual({
      id: berlin,
      value: 'Deutschland › Berlin',
    });
    expect(await search('Herkunft = Deutschland')).toEqual([created.body.key]);
    expect(await search('Herkunft = Österreich')).toEqual([]);
  });
});
