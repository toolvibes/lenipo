import type {
  Board,
  Burndown,
  ProjectDetails,
  Sprint,
  SprintReport,
  Velocity,
} from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let board: Board;
let sprint: Sprint;
let web: ProjectDetails;

const pause = () => new Promise((resolve) => setTimeout(resolve, 15));

async function finish(key: string) {
  const done = web.statuses.find((status) => status.category === 'done');
  const transitions = await admin.request<Array<{ id: string; to: { id: string } }>>(
    'GET',
    `/issues/${key}/transitions`,
  );
  const transition = transitions.body.find((entry) => entry.to.id === done?.id);
  await admin.request('POST', `/issues/${key}/transitions`, { transitionId: transition?.id });
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
  web = (
    await admin.request<ProjectDetails>('POST', '/projects', {
      key: 'WEB',
      name: 'Web-Relaunch',
      template: 'scrum',
    })
  ).body;
  for (const [summary, storyPoints] of [
    ['A', 3],
    ['B', 5],
    ['C', 2],
  ] as const) {
    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'story',
      summary,
      storyPoints,
    });
  }
  board = (
    await admin.request<Board>('POST', '/boards', {
      name: 'Team',
      projectKey: 'WEB',
      type: 'scrum',
    })
  ).body;
  sprint = (await admin.request<Sprint>('POST', `/boards/${board.id}/sprints`, {})).body;
  await admin.request('POST', '/sprints/move-issues', {
    issueKeys: ['WEB-1', 'WEB-2'],
    sprintId: sprint.id,
  });
  await admin.request('POST', `/sprints/${sprint.id}/start`, {
    startDate: '2026-11-02',
    endDate: '2026-11-13',
  });
  // During the sprint: C added, B re-estimated, A done, B taken out.
  await pause();
  await admin.request('POST', '/sprints/move-issues', {
    issueKeys: ['WEB-3'],
    sprintId: sprint.id,
  });
  await pause();
  await admin.request('PATCH', '/issues/WEB-2', { storyPoints: 8 });
  await pause();
  await finish('WEB-1');
  await pause();
  await admin.request('POST', '/sprints/move-issues', { issueKeys: ['WEB-2'], sprintId: null });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('reports', () => {
  it('draw the burndown as one step per event', async () => {
    const burndown = (await admin.request<Burndown>('GET', `/sprints/${sprint.id}/burndown`)).body;
    expect(burndown.committed).toBe(8);
    expect(burndown.estimation).toBe('storyPoints');
    expect(
      burndown.points.map((point) => [point.type, point.issueKey, point.delta, point.remaining]),
    ).toEqual([
      ['start', null, 0, 8],
      ['added', 'WEB-3', 2, 10],
      ['estimate', 'WEB-2', 3, 13],
      ['done', 'WEB-1', -3, 10],
      ['removed', 'WEB-2', -8, 2],
      ['now', null, 0, 2],
    ]);
    expect(burndown.plannedEnd).toContain('2026-11-13');
  });

  it('report completed, not completed and removed issues', async () => {
    await admin.request('POST', `/sprints/${sprint.id}/complete`, { moveTo: 'backlog' });
    const report = (await admin.request<SprintReport>('GET', `/sprints/${sprint.id}/report`)).body;
    const keys = (entries: SprintReport['completed']) => entries.map((entry) => entry.issue.key);
    expect(keys(report.completed)).toEqual(['WEB-1']);
    expect(keys(report.notCompleted)).toEqual(['WEB-3']);
    expect(report.notCompleted[0]).toMatchObject({ addedAfterStart: true, estimate: 2 });
    expect(keys(report.removed)).toEqual(['WEB-2']);
    // A closed sprint's burndown ends at its completion.
    const burndown = (await admin.request<Burndown>('GET', `/sprints/${sprint.id}/burndown`)).body;
    expect(burndown.points.at(-1)?.type).toBe('removed');
  });

  it('compare commitment and result over sprints', async () => {
    const velocity = (await admin.request<Velocity>('GET', `/boards/${board.id}/velocity`)).body;
    expect(
      velocity.sprints.map((entry) => [entry.sprint.name, entry.committed, entry.completed]),
    ).toEqual([['Team Sprint 1', 8, 3]]);
  });

  it('need a started sprint', async () => {
    const planned = (await admin.request<Sprint>('POST', `/boards/${board.id}/sprints`, {})).body;
    expect((await admin.request('GET', `/sprints/${planned.id}/burndown`)).status).toBe(400);
  });
});
