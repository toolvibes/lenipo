import type {
  Board,
  ChangeGroup,
  Issue,
  ProjectDetails,
  ProjectWorkflow,
  PublishWorkflowRequest,
  Transition,
} from '@tasklore/shared';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { projectRoleMembers } from '../db/schema/index.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let board: Board;

async function moveTo(key: string, statusName: string) {
  const transitions = (await admin.request<Transition[]>('GET', `/issues/${key}/transitions`)).body;
  const target = transitions.find((transition) => transition.to.name === statusName);
  expect(target).toBeDefined();
  await admin.request('POST', `/issues/${key}/transitions`, { transitionId: target?.id });
}

/** The editable form of a workflow, as the editor sends it back. */
function edit(workflow: ProjectWorkflow): PublishWorkflowRequest {
  return {
    baseVersionId: workflow.versionId,
    statuses: workflow.statuses.map((status) => ({
      id: status.id,
      name: status.name,
      category: status.category,
    })),
    initial: workflow.statuses.findIndex((status) => status.id === workflow.initialStatusId),
    mode: workflow.mode,
    transitions: [],
    migrate: {},
  };
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
  const web = (
    await admin.request<ProjectDetails>('POST', '/projects', {
      key: 'WEB',
      name: 'Web',
      template: 'scrum',
    })
  ).body;
  await test.database.db
    .insert(projectRoleMembers)
    .values({ id: uuidv7(), projectId: web.id, role: 'developers', userId: miraId });
  await admin.request('POST', '/projects', { key: 'APP', name: 'App', template: 'scrum' });
  for (const summary of ['Anmelden', 'Abmelden', 'Profil']) {
    await admin.request('POST', '/issues', { projectKey: 'WEB', issueType: 'task', summary });
  }
  await moveTo('WEB-2', 'Review');
  board = (
    await admin.request<Board>('POST', '/boards', {
      name: 'Team',
      projectKey: 'WEB',
      type: 'kanban',
    })
  ).body;
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('project workflow', () => {
  it('shows the shared workflow with usage', async () => {
    const workflow = (await mira.request<ProjectWorkflow>('GET', '/projects/WEB/workflow')).body;
    expect(workflow.ownedByProject).toBe(false);
    expect(workflow.mode).toBe('free');
    expect(workflow.statuses.map((status) => status.name)).toEqual([
      'Offen',
      'In Arbeit',
      'Review',
      'Erledigt',
    ]);
    const review = workflow.statuses.find((status) => status.name === 'Review');
    expect(workflow.usage[review?.id ?? '']).toBe(1);
  });

  it('is published by project administrators only', async () => {
    const workflow = (await admin.request<ProjectWorkflow>('GET', '/projects/WEB/workflow')).body;
    expect((await mira.request('POST', '/projects/WEB/workflow', edit(workflow))).status).toBe(403);
  });

  it('needs a new home for issues on removed statuses', async () => {
    const workflow = (await admin.request<ProjectWorkflow>('GET', '/projects/WEB/workflow')).body;
    const request = edit(workflow);
    request.statuses = request.statuses.filter((status) => status.name !== 'Review');
    request.initial = 0;
    const response = await admin.request<{ detail: string }>(
      'POST',
      '/projects/WEB/workflow',
      request,
    );
    expect(response.status).toBe(400);
    expect(response.body.detail).toContain('Review');
  });

  it('copies on first publish, moves issues and adjusts boards', async () => {
    const before = (await admin.request<ProjectWorkflow>('GET', '/projects/WEB/workflow')).body;
    const review = before.statuses.find((status) => status.name === 'Review');
    const request = edit(before);
    // Without "Review", with a new "Blockiert" in progress before "Erledigt".
    request.statuses = [
      ...request.statuses.filter(
        (status) => status.name !== 'Review' && status.name !== 'Erledigt',
      ),
      { id: null, name: 'Blockiert', category: 'in_progress' },
      ...request.statuses.filter((status) => status.name === 'Erledigt'),
    ];
    request.mode = 'defined';
    // Offen → In Arbeit → Blockiert ↔ In Arbeit → Erledigt
    request.transitions = [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 1 },
      { from: 1, to: 3 },
    ];
    request.migrate = { [review?.id ?? '']: 2 };
    const published = await admin.request<ProjectWorkflow>(
      'POST',
      '/projects/WEB/workflow',
      request,
    );
    expect(published.status).toBe(200);
    expect(published.body).toMatchObject({ ownedByProject: true, version: 1, mode: 'defined' });
    expect(published.body.statuses.map((status) => status.name)).toEqual([
      'Offen',
      'In Arbeit',
      'Blockiert',
      'Erledigt',
    ]);

    // The issue on "Review" moved to "Blockiert", recorded as a workflow change.
    const moved = (await admin.request<Issue>('GET', '/issues/WEB-2')).body;
    expect(moved.status.name).toBe('Blockiert');
    const history = (await admin.request<ChangeGroup[]>('GET', '/issues/WEB-2/history')).body;
    expect(history.some((group) => group.via === 'workflow')).toBe(true);

    // Only the defined moves are offered.
    const fromOpen = (await admin.request<Transition[]>('GET', '/issues/WEB-1/transitions')).body;
    expect(fromOpen.map((transition) => transition.to.name)).toEqual(['In Arbeit']);

    // The board shows the new status next to its category, "Review" is gone.
    const columns = (
      await admin.request<{ columns: Array<{ name: string; statusIds: string[] }> }>(
        'GET',
        `/boards/${board.id}`,
      )
    ).body.columns;
    const blocked = published.body.statuses.find((status) => status.name === 'Blockiert');
    const all = columns.flatMap((column) => column.statusIds);
    expect(all).toContain(blocked?.id);
    expect(all).not.toContain(review?.id);

    // Other projects keep the shared workflow.
    const other = (await admin.request<ProjectWorkflow>('GET', '/projects/APP/workflow')).body;
    expect(other.ownedByProject).toBe(false);
    expect(other.statuses.map((status) => status.name)).toContain('Review');
  });

  it('adds versions to its own copy and refuses stale edits', async () => {
    const current = (await admin.request<ProjectWorkflow>('GET', '/projects/WEB/workflow')).body;
    const stale = edit(current);
    const request = edit(current);
    request.mode = 'free';
    const next = await admin.request<ProjectWorkflow>('POST', '/projects/WEB/workflow', request);
    expect(next.body).toMatchObject({ version: 2, mode: 'free', ownedByProject: true });
    stale.mode = 'free';
    expect((await admin.request('POST', '/projects/WEB/workflow', stale)).status).toBe(409);
  });

  it('reuses an existing status by name', async () => {
    const current = (await admin.request<ProjectWorkflow>('GET', '/projects/WEB/workflow')).body;
    const request = edit(current);
    request.statuses.push({ id: null, name: 'review', category: 'in_progress' });
    const published = await admin.request<ProjectWorkflow>(
      'POST',
      '/projects/WEB/workflow',
      request,
    );
    const review = current.available.find((status) => status.name === 'Review');
    expect(published.body.statuses.at(-1)?.id).toBe(review?.id);
  });
});
