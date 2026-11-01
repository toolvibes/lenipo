import type {
  Issue,
  IssueList,
  ProjectDetails,
  SearchResult,
  SecurityScheme,
} from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let olaf: TestClient;
let scheme: SecurityScheme;

async function signIn(email: string): Promise<TestClient> {
  const client = new TestClient(test.baseUrl);
  await client.request('POST', '/auth/login', { email, password: 'ein-langes-passwort' });
  return client;
}

async function found(client: TestClient, query: string): Promise<string[]> {
  return (await client.request<SearchResult>('POST', '/search', { query })).body.issues
    .map((issue) => issue.key)
    .sort();
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
  mira = await signIn('mira@example.org');
  olaf = await signIn('olaf@example.org');
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  await admin.request('POST', '/projects/WEB/members', {
    role: 'developers',
    userId: ids['mira@example.org'],
  });
  await admin.request('POST', '/projects/WEB/members', {
    role: 'users',
    userId: ids['olaf@example.org'],
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('issue security (TL-13)', () => {
  it('sets up a scheme with a level for developers and the reporter', async () => {
    const created = await admin.request<SecurityScheme>('POST', '/admin/security-schemes', {
      name: 'Vertraulich',
    });
    expect(created.status).toBe(201);
    expect((await mira.request('GET', '/admin/security-schemes')).status).toBe(403);
    const updated = await admin.request<SecurityScheme>(
      'PATCH',
      `/admin/security-schemes/${created.body.id}`,
      {
        levels: [
          { name: 'Intern', grants: [{ role: 'developers' }, { grantee: 'reporter' }] },
          { name: 'Nur Lena', grants: [{ role: 'administrators' }] },
        ],
        defaultLevel: null,
      },
    );
    expect(updated.status).toBe(200);
    scheme = updated.body;
    expect(scheme.levels.map((level) => level.name)).toEqual(['Intern', 'Nur Lena']);
    expect(
      (await admin.request('PUT', '/projects/WEB/security-scheme', { schemeId: scheme.id })).status,
    ).toBe(204);
    const project = (await admin.request<ProjectDetails>('GET', '/projects/WEB')).body;
    expect(project.securityLevels.map((level) => level.name)).toEqual(['Intern', 'Nur Lena']);
    expect(project.permissions).toContain('set-issue-security');
  });

  it('hides secured issues from people the level does not grant', async () => {
    const intern = scheme.levels[0]?.id;
    const secret = await admin.request<Issue>('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Gehaltsliste',
      securityLevelId: intern,
    });
    expect(secret.status).toBe(201);
    expect(secret.body.securityLevel?.name).toBe('Intern');
    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Offen',
    });

    expect((await mira.request('GET', '/issues/WEB-1')).status).toBe(200);
    expect((await olaf.request('GET', '/issues/WEB-1')).status).toBe(404);
    expect(await found(mira, 'project = WEB')).toEqual(['WEB-1', 'WEB-2']);
    expect(await found(olaf, 'project = WEB')).toEqual(['WEB-2']);
    const list = (await olaf.request<IssueList>('GET', '/projects/WEB/issues')).body;
    expect(list.issues.map((issue) => issue.key)).toEqual(['WEB-2']);

    // Subtasks follow their parent.
    const child = await admin.request<Issue>('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'subtask',
      summary: 'Teil',
      parentKey: 'WEB-1',
    });
    expect(child.body.securityLevel?.name).toBe('Intern');
    expect((await olaf.request('GET', `/issues/${child.body.key}`)).status).toBe(404);
  });

  it('lets only holders of set-issue-security change the level', async () => {
    const lenaOnly = scheme.levels[1]?.id;
    expect(
      (await mira.request('PATCH', '/issues/WEB-1', { securityLevelId: lenaOnly })).status,
    ).toBe(403);
    expect(
      (await admin.request('PATCH', '/issues/WEB-1', { securityLevelId: lenaOnly })).status,
    ).toBe(200);
    expect((await mira.request('GET', '/issues/WEB-1')).status).toBe(404);
    // The subtask moved along.
    expect((await mira.request('GET', '/issues/WEB-3')).status).toBe(404);
  });

  it('protects levels and schemes that issues still use', async () => {
    const removed = await admin.request('PATCH', `/admin/security-schemes/${scheme.id}`, {
      levels: [{ id: scheme.levels[0]?.id, name: 'Intern', grants: [{ role: 'developers' }] }],
    });
    expect(removed.status).toBe(409);
    expect(
      (await admin.request('PUT', '/projects/WEB/security-scheme', { schemeId: null })).status,
    ).toBe(409);
  });
});
