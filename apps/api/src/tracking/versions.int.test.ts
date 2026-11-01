import type { ChangeGroup, Issue, ProjectDetails, SearchResult, Version } from '@toolvibes/shared';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { projectRoleMembers } from '../db/schema/index.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let web: ProjectDetails;
const versions: Record<string, Version> = {};

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
  const miraId = (
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
  web = (
    await admin.request<ProjectDetails>('POST', '/projects', {
      key: 'WEB',
      name: 'Web',
      template: 'scrum',
    })
  ).body;
  await test.database.db
    .insert(projectRoleMembers)
    .values({ id: uuidv7(), projectId: web.id, role: 'developers', userId: miraId });
  for (const summary of ['Login', 'Logout', 'Profil']) {
    await admin.request('POST', '/issues', { projectKey: 'WEB', issueType: 'task', summary });
  }
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('versions', () => {
  it('are created by project administrators', async () => {
    expect((await mira.request('POST', '/projects/WEB/versions', { name: '1.0' })).status).toBe(
      403,
    );
    for (const name of ['1.0', '2.0', '3.0']) {
      const created = await admin.request<Version>('POST', '/projects/WEB/versions', { name });
      expect(created.status).toBe(201);
      versions[name] = created.body;
    }
    expect((await admin.request('POST', '/projects/WEB/versions', { name: '1.0' })).status).toBe(
      409,
    );
    const list = await mira.request<Version[]>('GET', '/projects/WEB/versions');
    expect(list.body.map((version) => version.name)).toEqual(['1.0', '2.0', '3.0']);
  });

  it('are set on issues with history', async () => {
    const updated = await mira.request<Issue>('PATCH', '/issues/WEB-1', {
      fixVersions: ['1.0'],
      affectsVersions: ['2.0'],
    });
    expect(updated.body.fixVersions.map((version) => version.name)).toEqual(['1.0']);
    expect(updated.body.affectsVersions.map((version) => version.name)).toEqual(['2.0']);
    await mira.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Suche',
      fixVersions: ['1.0'],
    });
    const history = await admin.request<ChangeGroup[]>('GET', '/issues/WEB-1/history');
    expect(history.body.flatMap((group) => group.items)).toContainEqual(
      expect.objectContaining({ field: 'fixVersions', from: null, to: '1.0' }),
    );
    expect((await mira.request('PATCH', '/issues/WEB-2', { fixVersions: ['9.9'] })).status).toBe(
      400,
    );
  });

  it('can be searched with TQL', async () => {
    expect(await search('fixVersion = "1.0" ORDER BY key')).toEqual(['WEB-1', 'WEB-4']);
    expect(await search('affectedVersion = 2.0')).toEqual(['WEB-1']);
    expect(await search('fixVersion in unreleasedVersions(WEB) ORDER BY key')).toEqual([
      'WEB-1',
      'WEB-4',
    ]);
    expect(await search('fixVersion is EMPTY ORDER BY key')).toEqual(['WEB-2', 'WEB-3']);
    expect(await search('fixVersion = 7.7')).toBe(400);
  });

  it('release, moving unfinished issues on', async () => {
    const done = web.statuses.find((status) => status.category === 'done');
    const transitions = await admin.request<Array<{ id: string; to: { id: string } }>>(
      'GET',
      '/issues/WEB-4/transitions',
    );
    await admin.request('POST', '/issues/WEB-4/transitions', {
      transitionId: transitions.body.find((entry) => entry.to.id === done?.id)?.id,
    });
    expect(
      (
        await admin.request('POST', `/projects/WEB/versions/${versions['1.0']?.id}/release`, {
          moveOpenTo: versions['1.0']?.id,
        })
      ).status,
    ).toBe(400);
    const released = await admin.request<Version>(
      'POST',
      `/projects/WEB/versions/${versions['1.0']?.id}/release`,
      { releaseDate: '2026-11-01', moveOpenTo: versions['3.0']?.id },
    );
    expect(released.body).toMatchObject({
      released: true,
      releaseDate: '2026-11-01',
      issueCount: 1,
      openCount: 0,
    });
    expect(await search('fixVersion in releasedVersions() ORDER BY key')).toEqual(['WEB-4']);
    expect(await search('fixVersion = 3.0')).toEqual(['WEB-1']);
    const history = await admin.request<ChangeGroup[]>('GET', '/issues/WEB-1/history');
    expect(history.body[0]?.items[0]).toMatchObject({
      field: 'fixVersions',
      from: '1.0',
      to: '3.0',
    });
    const back = await admin.request<Version>(
      'PATCH',
      `/projects/WEB/versions/${versions['1.0']?.id}`,
      { released: false },
    );
    expect(back.body.released).toBe(false);
  });

  it('are archived instead of deleted while in use', async () => {
    expect(
      (await admin.request('DELETE', `/projects/WEB/versions/${versions['3.0']?.id}`)).status,
    ).toBe(409);
    await admin.request('PATCH', `/projects/WEB/versions/${versions['3.0']?.id}`, {
      archived: true,
    });
    // Kept where it is set, not chosen anew.
    expect(
      (await mira.request('PATCH', '/issues/WEB-1', { fixVersions: ['3.0', '2.0'] })).status,
    ).toBe(200);
    expect((await mira.request('PATCH', '/issues/WEB-2', { fixVersions: ['3.0'] })).status).toBe(
      400,
    );
    const unused = (await admin.request<Version>('POST', '/projects/WEB/versions', { name: '4.0' }))
      .body;
    expect((await admin.request('DELETE', `/projects/WEB/versions/${unused.id}`)).status).toBe(204);
  });
});
