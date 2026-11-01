import type { Board, BoardData, ProjectDetails, TrackingMeta } from '@toolvibes/shared';
import { and, eq, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { groups, issues, projectRoleMembers } from '../db/schema/index.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let olaf: TestClient;
let board: Board;
let web: ProjectDetails;

async function signIn(email: string): Promise<TestClient> {
  const client = new TestClient(test.baseUrl);
  await client.request('POST', '/auth/login', { email, password: 'ein-langes-passwort' });
  return client;
}

async function cards(client: TestClient, filters = ''): Promise<BoardData> {
  const query = filters ? `?filters=${filters}` : '';
  return (await client.request<BoardData>('GET', `/boards/${board.id}/issues${query}`)).body;
}

const keys = (data: BoardData) => data.issues.map((issue) => issue.key);

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
  await create('olaf@example.org', 'Olaf Alt');
  mira = await signIn('mira@example.org');
  olaf = await signIn('olaf@example.org');
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
  // Olaf sees nothing of WEB.
  const [usersGroup] = await test.database.db.select().from(groups).where(eq(groups.name, 'users'));
  await test.database.db
    .delete(projectRoleMembers)
    .where(
      and(
        eq(projectRoleMembers.projectId, web.id),
        eq(projectRoleMembers.groupId, usersGroup?.id ?? ''),
      ),
    );
  for (const summary of ['Login', 'Logout', 'Profil', 'Suche']) {
    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary,
      ...(summary === 'Profil' ? { assigneeId: miraId } : {}),
    });
  }
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('boards', () => {
  it('start with one column per workflow status, configured by project administrators', async () => {
    expect(
      (await mira.request('POST', '/boards', { name: 'Team', projectKey: 'WEB' })).status,
    ).toBe(403);
    const created = await admin.request<Board>('POST', '/boards', {
      name: 'Team',
      projectKey: 'WEB',
    });
    expect(created.status).toBe(201);
    board = created.body;
    expect(board).toMatchObject({ type: 'kanban', query: 'project = WEB', hideDoneAfterDays: 14 });
    expect(board.columns.map((column) => column.statusIds[0])).toEqual(
      web.statuses.map((status) => status.id),
    );
    expect((await mira.request<Board>('GET', `/boards/${board.id}`)).body.canConfigure).toBe(false);
    expect((await olaf.request('GET', `/boards/${board.id}`)).status).toBe(404);
    expect((await mira.request('PATCH', `/boards/${board.id}`, { name: 'X' })).status).toBe(403);
    const list = await mira.request<Array<{ id: string }>>('GET', '/boards?project=WEB');
    expect(list.body.map((entry) => entry.id)).toEqual([board.id]);
  });

  it('shows cards in rank order with the columns they can reach', async () => {
    const data = await cards(mira);
    expect(keys(data)).toEqual(['WEB-1', 'WEB-2', 'WEB-3', 'WEB-4']);
    expect(data.truncated).toBe(false);
    const first = data.issues[0];
    expect(data.reachable[first?.id ?? '']?.length).toBeGreaterThan(0);
  });

  it('moves cards through the workflow and ranks them', async () => {
    const target = board.columns[1];
    const moved = await mira.request<{ status: { id: string } }>(
      'POST',
      `/boards/${board.id}/move`,
      {
        issueKey: 'WEB-3',
        columnId: target?.id,
      },
    );
    expect(moved.status).toBe(200);
    expect(moved.body.status.id).toBe(target?.statusIds[0]);
    // Ranking alone: WEB-4 goes to the top.
    await mira.request('POST', `/boards/${board.id}/move`, {
      issueKey: 'WEB-4',
      columnId: board.columns[0]?.id,
      beforeKey: 'WEB-1',
    });
    expect(keys(await cards(mira))).toEqual(['WEB-4', 'WEB-1', 'WEB-2', 'WEB-3']);
    // The rank is global: the search sees it too.
    expect(
      (await mira.request('PUT', '/issues/WEB-2/rank', { afterKey: 'WEB-4', beforeKey: 'WEB-1' }))
        .status,
    ).toBe(204);
    expect(keys(await cards(mira))).toEqual(['WEB-4', 'WEB-2', 'WEB-1', 'WEB-3']);
    expect((await olaf.request('PUT', '/issues/WEB-2/rank', { afterKey: 'WEB-4' })).status).toBe(
      404,
    );
  });

  it('refuses columns the workflow cannot reach', async () => {
    const meta = await admin.request<TrackingMeta>('GET', '/tracking/meta');
    const foreign = meta.body.statuses.find(
      (status) => !web.statuses.some((own) => own.id === status.id),
    );
    expect(foreign).toBeDefined();
    const updated = await admin.request<Board>('PATCH', `/boards/${board.id}`, {
      columns: [
        ...board.columns.map(({ id, name, statusIds }) => ({ id, name, statusIds })),
        { name: 'Fremd', statusIds: [foreign?.id] },
      ],
    });
    expect(updated.status).toBe(200);
    const refused = await mira.request<{ detail: string }>('POST', `/boards/${board.id}/move`, {
      issueKey: 'WEB-1',
      columnId: updated.body.columns.at(-1)?.id,
    });
    expect(refused.status).toBe(409);
    board = updated.body;
  });

  it('checks the configuration', async () => {
    const status = board.columns[0]?.statusIds[0];
    const patch = (body: object) => admin.request('PATCH', `/boards/${board.id}`, body);
    expect(
      (
        await patch({
          columns: [
            { name: 'A', statusIds: [status] },
            { name: 'B', statusIds: [status] },
          ],
        })
      ).status,
    ).toBe(400);
    expect(
      (await patch({ columns: [{ name: 'A', statusIds: [status], wipMin: 5, wipMax: 2 }] })).status,
    ).toBe(400);
    expect((await patch({ query: 'project = ' })).status).toBe(400);
    expect(
      (await patch({ quickFilters: [{ name: 'Kaputt', query: 'status = Mond' }] })).status,
    ).toBe(400);
  });

  it('narrows with quick filters on the server', async () => {
    const updated = await admin.request<Board>('PATCH', `/boards/${board.id}`, {
      quickFilters: [{ name: 'Login', query: 'summary ~ Login' }],
      swimlanes: 'assignee',
    });
    const filter = updated.body.quickFilters[0];
    expect(keys(await cards(mira, 'mine'))).toEqual(['WEB-3']);
    expect(keys(await cards(mira, filter?.id))).toEqual(['WEB-1']);
    expect(keys(await cards(mira, `mine,${filter?.id}`))).toEqual([]);
    expect((await mira.request('GET', `/boards/${board.id}/issues?filters=nope`)).status).toBe(400);
  });

  it('hides done cards after the set days on Kanban boards', async () => {
    const done = web.statuses.find((status) => status.category === 'done');
    await test.database.db
      .update(issues)
      .set({ statusId: done?.id, resolvedAt: sql`now() - interval '30 days'` })
      .where(eq(issues.key, 'WEB-2'));
    expect(keys(await cards(mira))).not.toContain('WEB-2');
    await admin.request('PATCH', `/boards/${board.id}`, { hideDoneAfterDays: null });
    expect(keys(await cards(mira))).toContain('WEB-2');
  });

  it('can be deleted by administrators', async () => {
    expect((await mira.request('DELETE', `/boards/${board.id}`)).status).toBe(403);
    expect((await admin.request('DELETE', `/boards/${board.id}`)).status).toBe(204);
    expect((await admin.request('GET', `/boards/${board.id}`)).status).toBe(404);
  });
});
