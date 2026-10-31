import type { Board, Issue, Sprint, Timeline, Transition } from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let outsider: TestClient;

async function create(summary: string, extra: Record<string, unknown> = {}): Promise<Issue> {
  return (
    await admin.request<Issue>('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'story',
      summary,
      ...extra,
    })
  ).body;
}

async function finish(key: string) {
  const transitions = (await admin.request<Transition[]>('GET', `/issues/${key}/transitions`)).body;
  const done = transitions.find((transition) => transition.to.category === 'done');
  await admin.request('POST', `/issues/${key}/transitions`, { transitionId: done?.id });
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
  const olaf = await admin.request<{ id: string }>('POST', '/admin/users', {
    email: 'olaf@example.org',
    displayName: 'Olaf Außen',
    password: 'ein-langes-passwort',
  });
  // Not in "users", so no project role reaches him.
  await admin.request('DELETE', `/admin/groups/users/members/${olaf.body.id}`);
  outsider = new TestClient(test.baseUrl);
  await outsider.request('POST', '/auth/login', {
    email: 'olaf@example.org',
    password: 'ein-langes-passwort',
  });
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('start date', () => {
  it('is set, tracked in history and searchable', async () => {
    const issue = await create('Planen', { startDate: '2026-11-02', dueDate: '2026-11-20' });
    expect(issue.startDate).toBe('2026-11-02');
    const moved = await admin.request<Issue>('PATCH', `/issues/${issue.key}`, {
      startDate: '2026-11-05',
    });
    expect(moved.body.startDate).toBe('2026-11-05');
    const history = await admin.request<Array<{ items: Array<{ field: string }> }>>(
      'GET',
      `/issues/${issue.key}/history`,
    );
    expect(history.body.flatMap((group) => group.items.map((item) => item.field))).toContain(
      'startDate',
    );
    const found = await admin.request<{ issues: Issue[] }>('POST', '/search', {
      query: 'startDate >= "2026-11-04" ORDER BY startDate',
    });
    expect(found.body.issues.map((entry) => entry.key)).toEqual([issue.key]);
  });

  it('must not lie after the due date', async () => {
    expect(
      (
        await admin.request('POST', '/issues', {
          projectKey: 'WEB',
          issueType: 'story',
          summary: 'Falsch',
          startDate: '2026-12-02',
          dueDate: '2026-12-01',
        })
      ).status,
    ).toBe(400);
    const issue = await create('Nur fällig', { dueDate: '2026-12-01' });
    const moved = await admin.request('PATCH', `/issues/${issue.key}`, { startDate: '2026-12-05' });
    expect(moved.status).toBe(400);
  });
});

describe('timeline', () => {
  it('derives epic bars from children and sprints, with progress by points', async () => {
    const epic = await create('Offline-Sync', { issueType: 'epic' });
    const planned = await create('Warteschlange', {
      parentKey: epic.key,
      startDate: '2026-11-03',
      dueDate: '2026-11-10',
      storyPoints: 3,
    });
    const inSprint = await create('Abgleich', { parentKey: epic.key, storyPoints: 5 });
    await create('Ohne Termin', { parentKey: epic.key });
    const board = (
      await admin.request<Board>('POST', '/boards', {
        name: 'Team',
        projectKey: 'WEB',
        type: 'scrum',
      })
    ).body;
    const sprint = (await admin.request<Sprint>('POST', `/boards/${board.id}/sprints`, {})).body;
    await admin.request('POST', '/sprints/move-issues', {
      issueKeys: [inSprint.key],
      sprintId: sprint.id,
    });
    await admin.request('PATCH', `/sprints/${sprint.id}`, {
      startDate: '2026-11-09',
      endDate: '2026-11-20',
    });
    await finish(planned.key);
    const release = await admin.request<{ id: string }>('POST', '/projects/WEB/versions', {
      name: '2.0',
      releaseDate: '2027-02-02',
    });
    await admin.request('POST', '/projects/WEB/versions', { name: 'Ohne Datum' });

    const timeline = (await admin.request<Timeline>('GET', '/projects/WEB/timeline')).body;
    expect(timeline.epics).toHaveLength(1);
    const [row] = timeline.epics;
    expect(row?.issue.key).toBe(epic.key);
    expect(row?.span).toEqual({ start: '2026-11-03', end: '2026-11-20', derived: true });
    expect(row?.progress).toEqual({ done: 3, total: 8, unit: 'points' });
    expect(row?.children.map((child) => [child.issue.summary, child.span])).toEqual([
      ['Warteschlange', { start: '2026-11-03', end: '2026-11-10', derived: false }],
      ['Abgleich', { start: '2026-11-09', end: '2026-11-20', derived: true }],
      ['Ohne Termin', null],
    ]);
    expect(timeline.milestones).toEqual([
      { id: release.body.id, name: '2.0', date: '2027-02-02', released: false, issueKeys: [] },
    ]);

    // Own dates win over the derived span.
    await admin.request('PATCH', `/issues/${epic.key}`, {
      startDate: '2026-11-01',
      dueDate: '2026-12-15',
    });
    const own = (await admin.request<Timeline>('GET', '/projects/WEB/timeline')).body;
    expect(own.epics[0]?.span).toEqual({ start: '2026-11-01', end: '2026-12-15', derived: false });
  });

  it('counts issues when no child is estimated', async () => {
    const epic = await create('Anhänge', { issueType: 'epic', dueDate: '2026-12-01' });
    const child = await create('Hochladen', { parentKey: epic.key });
    await create('Vorschau', { parentKey: epic.key });
    await finish(child.key);
    const timeline = (await admin.request<Timeline>('GET', '/projects/WEB/timeline')).body;
    const row = timeline.epics.find((entry) => entry.issue.key === epic.key);
    expect(row?.progress).toEqual({ done: 1, total: 2, unit: 'issues' });
    expect(row?.span).toEqual({ start: '2026-12-01', end: '2026-12-01', derived: false });
  });

  it('draws "blocks" links as dependencies and marks conflicts (TL-23)', async () => {
    const epic = await create('Umzug', { issueType: 'epic' });
    const first = await create('Server', {
      parentKey: epic.key,
      startDate: '2027-01-04',
      dueDate: '2027-01-15',
    });
    const second = await create('Daten', {
      parentKey: epic.key,
      startDate: '2027-01-11',
      dueDate: '2027-01-29',
    });
    const release = await admin.request<{ id: string }>('POST', '/projects/WEB/versions', {
      name: '3.0',
      releaseDate: '2027-01-22',
    });
    await admin.request('PATCH', `/issues/${second.key}`, { fixVersions: ['3.0'] });
    await admin.request('POST', `/issues/${first.key}/links`, {
      type: 'blocks',
      issueKey: second.key,
    });
    await admin.request('POST', `/issues/${first.key}/links`, {
      type: 'relates',
      issueKey: second.key,
    });
    const timeline = (await admin.request<Timeline>('GET', '/projects/WEB/timeline')).body;
    expect(timeline.dependencies).toEqual([
      { linkId: expect.any(String), from: first.key, to: second.key, conflict: true },
    ]);
    expect(timeline.conflicts).toEqual(
      expect.arrayContaining([
        { kind: 'dependency', issueKey: second.key, blockerKey: first.key, days: 5 },
        { kind: 'milestone', issueKey: second.key, version: '3.0', days: 7 },
      ]),
    );
    expect(timeline.milestones.find((entry) => entry.id === release.body.id)?.issueKeys).toEqual([
      second.key,
    ]);
    expect(timeline.canEditVersions).toBe(true);
    // Moving the waiting issue after its blocker resolves the conflict.
    await admin.request('PATCH', `/issues/${second.key}`, {
      startDate: '2027-01-18',
      dueDate: '2027-01-20',
    });
    const fixed = (await admin.request<Timeline>('GET', '/projects/WEB/timeline')).body;
    expect(fixed.dependencies[0]?.conflict).toBe(false);
    expect(fixed.conflicts).toEqual([]);
  });

  it('is only for people who can browse the project', async () => {
    expect((await outsider.request('GET', '/projects/WEB/timeline')).status).toBe(404);
  });
});
