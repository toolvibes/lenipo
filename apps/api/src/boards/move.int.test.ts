import type { BulkResult, ChangeGroup, Issue } from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let olaf: TestClient;

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  const olafId = (
    await admin.request<{ id: string }>('POST', '/admin/users', {
      email: 'olaf@example.org',
      displayName: 'Olaf Alt',
      password: 'ein-langes-passwort',
    })
  ).body.id;
  olaf = new TestClient(test.baseUrl);
  await olaf.request('POST', '/auth/login', {
    email: 'olaf@example.org',
    password: 'ein-langes-passwort',
  });
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  await admin.request('POST', '/projects', { key: 'OPS', name: 'Betrieb', template: 'kanban' });
  await admin.request('POST', '/projects/OPS/members', { role: 'developers', userId: olafId });
  await admin.request('POST', '/projects/WEB/components', { name: 'Frontend' });
  await admin.request('POST', '/projects/OPS/components', { name: 'Frontend' });
  await admin.request('POST', '/issues', {
    projectKey: 'WEB',
    issueType: 'task',
    summary: 'Umziehen',
    components: ['Frontend'],
  });
  await admin.request('POST', '/issues/WEB-1/transitions', { transitionId: 'to-review' });
  await admin.request('POST', '/issues', {
    projectKey: 'WEB',
    issueType: 'subtask',
    summary: 'Teil',
    parentKey: 'WEB-1',
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('moving issues between projects (TL-86)', () => {
  it('needs edit in the source and create in the target', async () => {
    // Olaf sees WEB through everyone's group but may not edit there.
    expect((await olaf.request('POST', '/issues/WEB-1/move', { projectKey: 'OPS' })).status).toBe(
      403,
    );
    expect((await admin.request('POST', '/issues/WEB-2/move', { projectKey: 'OPS' })).status).toBe(
      400,
    );
  });

  it('moves an issue with its subtasks, maps the status and keeps the old key', async () => {
    const moved = await admin.request<Issue>('POST', '/issues/WEB-1/move', { projectKey: 'OPS' });
    expect(moved.status).toBe(200);
    // Kanban has no Review: the first status in progress takes over.
    expect(moved.body).toMatchObject({ key: 'OPS-1', project: { key: 'OPS' } });
    expect(moved.body.status.name).toBe('In Arbeit');
    expect(moved.body.components.map((component) => component.name)).toEqual(['Frontend']);
    expect(moved.body.children.map((child) => child.key)).toEqual(['OPS-2']);
    // The old keys still open the issues.
    expect((await admin.request<Issue>('GET', '/issues/WEB-1')).body.key).toBe('OPS-1');
    expect((await admin.request<Issue>('GET', '/issues/WEB-2')).body.key).toBe('OPS-2');
    const history = (await admin.request<ChangeGroup[]>('GET', '/issues/OPS-1/history')).body;
    expect(history[0]?.items.map((item) => item.field).sort()).toEqual([
      'key',
      'project',
      'status',
    ]);
  });

  it('moves many issues at once', async () => {
    await admin.request('POST', '/issues', { projectKey: 'WEB', issueType: 'task', summary: 'A' });
    const result = (
      await admin.request<BulkResult>('POST', '/issues/bulk', {
        issueKeys: ['WEB-3'],
        action: { type: 'move', projectKey: 'OPS' },
      })
    ).body;
    expect(result.results).toEqual([{ key: 'WEB-3', ok: true, error: null }]);
    expect((await admin.request<Issue>('GET', '/issues/WEB-3')).body.key).toBe('OPS-3');
  });
});
