import type { BulkResult, Issue, ProjectDetails } from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let olaf: TestClient;
let project: ProjectDetails;

async function create(summary: string, extra: object = {}): Promise<Issue> {
  return (
    await admin.request<Issue>('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary,
      ...extra,
    })
  ).body;
}

async function bulk(client: TestClient, issueKeys: string[], action: object) {
  return (await client.request<BulkResult>('POST', '/issues/bulk', { issueKeys, action })).body;
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
  await admin.request('POST', '/projects/WEB/members', { role: 'users', userId: olafId });
  project = (await admin.request<ProjectDetails>('GET', '/projects/WEB')).body;
  for (const summary of ['Eins', 'Zwei', 'Drei']) await create(summary, { labels: ['alt'] });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('bulk change and clone (TL-16)', () => {
  it('edits, transitions and watches many issues, one by one', async () => {
    const edited = await bulk(admin, ['WEB-1', 'WEB-2', 'WEB-9'], {
      type: 'edit',
      priority: 'high',
      addLabels: ['neu'],
      removeLabels: ['alt'],
    });
    expect(edited.results.map((result) => [result.key, result.ok])).toEqual([
      ['WEB-1', true],
      ['WEB-2', true],
      ['WEB-9', false],
    ]);
    const one = (await admin.request<Issue>('GET', '/issues/WEB-1')).body;
    expect(one).toMatchObject({ labels: ['neu'], priority: { key: 'high' } });

    const done = project.statuses.find((status) => status.category === 'done');
    const moved = await bulk(admin, ['WEB-1', 'WEB-2'], { type: 'transition', statusId: done?.id });
    expect(moved.results.every((result) => result.ok)).toBe(true);
    expect((await admin.request<Issue>('GET', '/issues/WEB-2')).body.status.category).toBe('done');

    // Olaf may browse but not edit: each issue reports why.
    const denied = await bulk(olaf, ['WEB-3'], { type: 'edit', priority: 'low' });
    expect(denied.results[0]).toMatchObject({ key: 'WEB-3', ok: false });
    expect((await bulk(olaf, ['WEB-3'], { type: 'watch' })).results[0]?.ok).toBe(true);
  });

  it('clones an issue with its subtasks and a link to the original', async () => {
    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'subtask',
      summary: 'Teil',
      parentKey: 'WEB-3',
    });
    const copy = await admin.request<Issue>('POST', '/issues/WEB-3/clone', {
      includeSubtasks: true,
    });
    expect(copy.status).toBe(201);
    expect(copy.body).toMatchObject({ summary: 'Kopie: Drei', labels: ['alt'] });
    expect(copy.body.status.category).toBe('todo');
    expect(copy.body.links.map((link) => link.issue.key)).toContain('WEB-3');
    expect(copy.body.children.map((child) => child.summary)).toEqual(['Kopie: Teil']);
  });

  it('deletes issues with their subtasks, given the permission', async () => {
    expect((await olaf.request('DELETE', '/issues/WEB-3')).status).toBe(403);
    const removed = await bulk(admin, ['WEB-3'], { type: 'delete' });
    expect(removed.results[0]?.ok).toBe(true);
    expect((await admin.request('GET', '/issues/WEB-3')).status).toBe(404);
    expect((await admin.request('GET', '/issues/WEB-4')).status).toBe(404);
  });
});
