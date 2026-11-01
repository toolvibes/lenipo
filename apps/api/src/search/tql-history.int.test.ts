import type { SearchResult } from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let miraId = '';

async function search(query: string, client: TestClient = admin): Promise<string[] | number> {
  const result = await client.request<SearchResult>('POST', '/search', { query });
  return result.status === 200
    ? result.body.issues.map((issue) => issue.key).sort()
    : result.status;
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
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  await admin.request('POST', '/projects/WEB/members', { role: 'developers', userId: miraId });
  for (const summary of ['Bewegt', 'Ruhig']) {
    await admin.request('POST', '/issues', { projectKey: 'WEB', issueType: 'task', summary });
  }
  // WEB-1: Mira starts it and gives it to herself; Lena finishes it and takes it back.
  await mira.request('POST', '/issues/WEB-1/transitions', { transitionId: 'to-in-progress' });
  await mira.request('PATCH', '/issues/WEB-1', { assigneeId: miraId });
  await admin.request('POST', '/issues/WEB-1/transitions', { transitionId: 'to-done' });
  await admin.request('PATCH', '/issues/WEB-1', { assigneeId: null });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('TQL history operators (TL-17)', () => {
  it('finds what an issue was, including where it started and where it is', async () => {
    expect(await search('status WAS "In Arbeit"')).toEqual(['WEB-1']);
    expect(await search('status WAS Offen')).toEqual(['WEB-1', 'WEB-2']);
    expect(await search('status WAS Erledigt')).toEqual(['WEB-1']);
    expect(await search('status WAS NOT Erledigt')).toEqual(['WEB-2']);
    expect(await search('status WAS IN ("In Arbeit", Review)')).toEqual(['WEB-1']);
    expect(await search('assignee WAS "mira@example.org"')).toEqual(['WEB-1']);
    expect(await search('assignee WAS currentUser()', mira)).toEqual(['WEB-1']);
  });

  it('narrows by who and when', async () => {
    expect(await search('status WAS "In Arbeit" BY "mira@example.org"')).toEqual(['WEB-1']);
    expect(await search('status WAS Erledigt BY "mira@example.org"')).toEqual([]);
    expect(await search('status WAS "In Arbeit" AFTER -1d')).toEqual(['WEB-1']);
    expect(await search('status WAS "In Arbeit" BEFORE 2020-01-01')).toEqual([]);
  });

  it('finds changes, with from, to, by and time', async () => {
    expect(await search('status CHANGED')).toEqual(['WEB-1']);
    expect(await search('status CHANGED FROM Offen TO "In Arbeit"')).toEqual(['WEB-1']);
    expect(await search('status CHANGED TO Offen')).toEqual([]);
    expect(await search('status CHANGED BY currentUser()', mira)).toEqual(['WEB-1']);
    expect(await search('assignee CHANGED DURING (-1d, now())')).toEqual(['WEB-1']);
    expect(await search('priority CHANGED')).toEqual([]);
  });

  it('lists the issues the caller looked at', async () => {
    await admin.request('POST', '/me/recent', { kind: 'issue', ref: 'WEB-2' });
    expect(await search('key IN issueHistory()')).toEqual(['WEB-2']);
    expect(await search('key IN issueHistory()', mira)).toEqual([]);
  });
});
