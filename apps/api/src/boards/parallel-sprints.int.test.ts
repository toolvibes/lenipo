import type { Board, BoardData, Sprint } from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let board: Board;
let lenaId = '';
const sprintsOf: Sprint[] = [];
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  lenaId = (await admin.request<{ id: string }>('GET', '/me')).body.id;
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  for (const summary of ['Login', 'Suche', 'Export']) {
    await admin.request('POST', '/issues', { projectKey: 'WEB', issueType: 'story', summary });
  }
  board = (
    await admin.request<Board>('POST', '/boards', {
      name: 'Teams',
      projectKey: 'WEB',
      type: 'scrum',
    })
  ).body;
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('parallel sprints and capacity (T-SPR-04/05)', () => {
  it('runs one sprint at a time unless the board allows parallel sprints', async () => {
    for (const keys of [['WEB-1'], ['WEB-2']]) {
      const sprint = (await admin.request<Sprint>('POST', `/boards/${board.id}/sprints`, {})).body;
      await admin.request('POST', '/sprints/move-issues', { issueKeys: keys, sprintId: sprint.id });
      sprintsOf.push(sprint);
    }
    const dates = { startDate: today, endDate: today };
    expect((await admin.request('POST', `/sprints/${sprintsOf[0]?.id}/start`, dates)).status).toBe(
      200,
    );
    expect((await admin.request('POST', `/sprints/${sprintsOf[1]?.id}/start`, dates)).status).toBe(
      409,
    );

    const changed = await admin.request<Board>('PATCH', `/boards/${board.id}`, {
      parallelSprints: true,
    });
    expect(changed.body.parallelSprints).toBe(true);
    expect((await admin.request('POST', `/sprints/${sprintsOf[1]?.id}/start`, dates)).status).toBe(
      200,
    );
  });

  it('shows all running sprints on the board, or the chosen one', async () => {
    const all = (await admin.request<BoardData>('GET', `/boards/${board.id}/issues`)).body;
    expect(all.activeSprints.map((sprint) => sprint.id)).toEqual(
      sprintsOf.map((sprint) => sprint.id),
    );
    expect(all.issues.map((issue) => issue.key).sort()).toEqual(['WEB-1', 'WEB-2']);
    const one = (
      await admin.request<BoardData>('GET', `/boards/${board.id}/issues?sprint=${sprintsOf[1]?.id}`)
    ).body;
    expect(one.sprint?.id).toBe(sprintsOf[1]?.id);
    expect(one.issues.map((issue) => issue.key)).toEqual(['WEB-2']);
  });

  it('keeps the planned capacity of a sprint per person', async () => {
    const updated = await admin.request<Sprint>('PATCH', `/sprints/${sprintsOf[0]?.id}`, {
      capacity: { total: 20, people: [{ userId: lenaId, value: 8 }] },
    });
    expect(updated.body.capacity).toEqual({
      total: 20,
      people: [{ user: { id: lenaId, displayName: 'Lena Vogt' }, value: 8 }],
    });
    const unknown = await admin.request('PATCH', `/sprints/${sprintsOf[0]?.id}`, {
      capacity: {
        total: null,
        people: [{ userId: '01a00000-0000-7000-8000-000000000001', value: 1 }],
      },
    });
    expect(unknown.status).toBe(400);
  });
});
