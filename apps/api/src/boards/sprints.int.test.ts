import type {
  BacklogData,
  Board,
  BoardData,
  ChangeGroup,
  Issue,
  ProjectDetails,
  SearchResult,
  Sprint,
} from '@toolvibes/shared';
import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { projectRoleMembers, sprintIssues } from '../db/schema/index.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let jonas: TestClient;
let board: Board;
let first: Sprint;
let web: ProjectDetails;

async function signIn(email: string): Promise<TestClient> {
  const client = new TestClient(test.baseUrl);
  await client.request('POST', '/auth/login', { email, password: 'ein-langes-passwort' });
  return client;
}

async function search(query: string): Promise<string[]> {
  const result = await admin.request<SearchResult>('POST', '/search', { query });
  return result.body.issues.map((issue) => issue.key);
}

const backlog = async () =>
  (await mira.request<BacklogData>('GET', `/boards/${board.id}/backlog`)).body;

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  const create = async (email: string, displayName: string) =>
    (
      await admin.request<{ id: string }>('POST', '/admin/users', {
        email,
        displayName,
        password: 'ein-langes-passwort',
      })
    ).body.id;
  const miraId = await create('mira@example.org', 'Mira Kaya');
  await create('jonas@example.org', 'Jonas Schulz');
  mira = await signIn('mira@example.org');
  jonas = await signIn('jonas@example.org');
  web = (
    await admin.request<ProjectDetails>('POST', '/projects', {
      key: 'WEB',
      name: 'Web-Relaunch',
      template: 'scrum',
    })
  ).body;
  await test.database.db
    .insert(projectRoleMembers)
    .values({ id: uuidv7(), projectId: web.id, role: 'developers', userId: miraId });
  for (const [summary, storyPoints] of [
    ['Login', 3],
    ['Logout', 2],
    ['Profil', 5],
    ['Suche', 8],
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
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('sprints', () => {
  it('are planned on Scrum boards by people who edit issues', async () => {
    const kanban = (
      await admin.request<Board>('POST', '/boards', { name: 'Fluss', projectKey: 'WEB' })
    ).body;
    expect((await admin.request('POST', `/boards/${kanban.id}/sprints`, {})).status).toBe(400);
    expect((await jonas.request('POST', `/boards/${board.id}/sprints`, {})).status).toBe(403);
    const created = await mira.request<Sprint>('POST', `/boards/${board.id}/sprints`, {
      goal: 'Anmelden',
    });
    expect(created.status).toBe(201);
    first = created.body;
    expect(first).toMatchObject({ name: 'Team Sprint 1', state: 'future', goal: 'Anmelden' });
    expect((await backlog()).backlog.map((issue) => issue.key)).toEqual([
      'WEB-1',
      'WEB-2',
      'WEB-3',
      'WEB-4',
    ]);
  });

  it('take issues from the backlog and back', async () => {
    const move = (issueKeys: string[], sprintId: string | null) =>
      mira.request('POST', '/sprints/move-issues', { issueKeys, sprintId });
    expect((await move(['WEB-1', 'WEB-2', 'WEB-3'], first.id)).status).toBe(204);
    expect((await move(['WEB-3'], null)).status).toBe(204);
    const data = await backlog();
    expect(data.sprints[0]?.issues.map((issue) => issue.key)).toEqual(['WEB-1', 'WEB-2']);
    expect(data.backlog.map((issue) => issue.key)).toEqual(['WEB-3', 'WEB-4']);
    expect(data.sprints[0]?.issues[0]?.sprint).toMatchObject({
      name: 'Team Sprint 1',
      state: 'future',
    });
    const history = await admin.request<ChangeGroup[]>('GET', '/issues/WEB-3/history');
    expect(history.body.flatMap((group) => group.items)).toContainEqual(
      expect.objectContaining({ field: 'sprint', from: 'Team Sprint 1', to: null }),
    );
    expect(
      (
        await jonas.request('POST', '/sprints/move-issues', {
          issueKeys: ['WEB-4'],
          sprintId: first.id,
        })
      ).status,
    ).toBe(403);
  });

  it('start once per board and fill the Scrum board', async () => {
    const started = await mira.request<Sprint>('POST', `/sprints/${first.id}/start`, {
      startDate: '2026-11-02',
      endDate: '2026-11-13',
    });
    expect(started.body).toMatchObject({ state: 'active', startDate: '2026-11-02' });
    const second = (await mira.request<Sprint>('POST', `/boards/${board.id}/sprints`, {})).body;
    expect(
      (
        await mira.request('POST', `/sprints/${second.id}/start`, {
          startDate: '2026-11-16',
          endDate: '2026-11-27',
        })
      ).status,
    ).toBe(409);
    const scrum = (await mira.request<BoardData>('GET', `/boards/${board.id}/issues`)).body;
    expect(scrum.sprint?.id).toBe(first.id);
    expect(scrum.issues.map((issue) => issue.key)).toEqual(['WEB-1', 'WEB-2']);
    const rows = await test.database.db
      .select()
      .from(sprintIssues)
      .where(eq(sprintIssues.sprintId, first.id));
    expect(
      rows
        .filter((row) => !row.removedAt)
        .map((row) => row.estimateAtStart)
        .sort(),
    ).toEqual([2, 3]);
    // Added after the start: a scope change for the report.
    await mira.request('POST', '/sprints/move-issues', {
      issueKeys: ['WEB-4'],
      sprintId: first.id,
    });
    const added = await test.database.db
      .select()
      .from(sprintIssues)
      .where(eq(sprintIssues.sprintId, first.id));
    expect(added.find((row) => row.estimateAtStart === 8)?.addedAfterStart).toBe(true);
  });

  it('complete and hand unfinished issues on', async () => {
    const done = web.statuses.find((status) => status.category === 'done');
    const transitions = await admin.request<Array<{ id: string; to: { id: string } }>>(
      'GET',
      '/issues/WEB-1/transitions',
    );
    const finish = transitions.body.find((transition) => transition.to.id === done?.id);
    await admin.request('POST', '/issues/WEB-1/transitions', { transitionId: finish?.id });
    const completed = await mira.request<Sprint>('POST', `/sprints/${first.id}/complete`, {
      moveTo: 'new',
    });
    expect(completed.body.state).toBe('closed');
    const data = await backlog();
    const next = data.sprints.find((entry) => entry.sprint.name === 'Team Sprint 3');
    expect(next?.issues.map((issue) => issue.key)).toEqual(['WEB-2', 'WEB-4']);
    const rows = await test.database.db
      .select()
      .from(sprintIssues)
      .where(eq(sprintIssues.sprintId, first.id));
    expect(
      rows.filter((row) => !row.removedAt).map((row) => [row.completed, row.estimateAtCompletion]),
    ).toEqual(
      expect.arrayContaining([
        [true, 3],
        [false, 2],
        [false, 8],
      ]),
    );
    expect(
      (await mira.request<BoardData>('GET', `/boards/${board.id}/issues`)).body.sprint,
    ).toBeNull();
  });

  it('can be searched with TQL', async () => {
    expect(await search('sprint = "Team Sprint 1" ORDER BY key')).toEqual([
      'WEB-1',
      'WEB-2',
      'WEB-4',
    ]);
    expect(await search('sprint in closedSprints() ORDER BY key')).toEqual([
      'WEB-1',
      'WEB-2',
      'WEB-4',
    ]);
    expect(await search('sprint in openSprints() ORDER BY key')).toEqual(['WEB-2', 'WEB-4']);
    expect(await search('sprint in futureSprints() ORDER BY key')).toEqual(['WEB-2', 'WEB-4']);
    expect(await search('sprint is EMPTY ORDER BY key')).toEqual(['WEB-3']);
    const issue = await admin.request<Issue>('GET', '/issues/WEB-2');
    expect(issue.body.sprint).toMatchObject({ name: 'Team Sprint 3', state: 'future' });
  });

  it('delete planned sprints into the backlog', async () => {
    const data = await backlog();
    const planned = data.sprints.find((entry) => entry.sprint.name === 'Team Sprint 3');
    expect((await mira.request('DELETE', `/sprints/${planned?.sprint.id}`)).status).toBe(204);
    expect((await backlog()).backlog.map((issue) => issue.key)).toEqual([
      'WEB-2',
      'WEB-3',
      'WEB-4',
    ]);
    expect((await mira.request('DELETE', `/sprints/${first.id}`)).status).toBe(409);
  });

  it('leave epics out of the backlog rows, but name them at their stories', async () => {
    const epic = (
      await admin.request<Issue>('POST', '/issues', {
        projectKey: 'WEB',
        issueType: 'epic',
        summary: 'Konto',
      })
    ).body;
    await admin.request('PATCH', '/issues/WEB-3', { parentKey: epic.key });
    const rows = (await backlog()).backlog;
    expect(rows.map((issue) => issue.key)).toEqual(['WEB-2', 'WEB-3', 'WEB-4']);
    expect(rows.find((issue) => issue.key === 'WEB-3')?.parent?.summary).toBe('Konto');
  });
});
