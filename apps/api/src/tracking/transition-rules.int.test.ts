import type {
  ChangeGroup,
  Issue,
  ProjectWorkflow,
  PublishWorkflowRequest,
  Transition,
  TransitionRulesInput,
} from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let workflow: ProjectWorkflow;

const status = (name: string) => {
  const found = workflow.statuses.find((entry) => entry.name === name);
  if (!found) throw new Error(`No status ${name}`);
  return found;
};

async function offered(client: TestClient, key: string): Promise<string[]> {
  return (await client.request<Transition[]>('GET', `/issues/${key}/transitions`)).body.map(
    (transition) => transition.to.name,
  );
}

async function move(client: TestClient, key: string, statusName: string) {
  return client.request<Issue>('POST', `/issues/${key}/transitions`, {
    transitionId: `to-${status(statusName).key}`,
  });
}

/** The current workflow with rules for moving into some statuses. */
function withRules(rules: Record<string, TransitionRulesInput>): PublishWorkflowRequest {
  return {
    baseVersionId: workflow.versionId,
    statuses: workflow.statuses.map((entry) => ({
      id: entry.id,
      name: entry.name,
      category: entry.category,
      ...(rules[entry.name] ? { rules: rules[entry.name] } : {}),
    })),
    initial: workflow.statuses.findIndex((entry) => entry.id === workflow.initialStatusId),
    mode: 'free',
    transitions: [],
    migrate: {},
  } as PublishWorkflowRequest;
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
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  await admin.request('POST', '/projects/WEB/members', { role: 'developers', userId: miraId });
  workflow = (await admin.request<ProjectWorkflow>('GET', '/projects/WEB/workflow')).body;
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('transition rules (TL-11)', () => {
  it('are stored with the workflow, for existing fields only', async () => {
    const inProgress = workflow.statuses.find((entry) => entry.category === 'in_progress');
    const done = workflow.statuses.find((entry) => entry.category === 'done');
    expect(inProgress && done && workflow.statuses.some((entry) => entry.name === 'Review')).toBe(
      true,
    );
    const unknown = await admin.request(
      'POST',
      '/projects/WEB/workflow',
      withRules({
        [done?.name ?? '']: { requiredFields: ['0190c0de-0000-7000-8000-000000000000'] },
      }),
    );
    expect(unknown.status).toBe(400);
    const published = await admin.request<ProjectWorkflow>(
      'POST',
      '/projects/WEB/workflow',
      withRules({
        [inProgress?.name ?? '']: { assign: 'caller' },
        Review: { onlyAssignee: true },
        [done?.name ?? '']: {
          roles: ['administrators'],
          subtasksDone: true,
          requiredFields: ['storyPoints'],
        },
      }),
    );
    expect(published.status).toBe(200);
    workflow = published.body;
    expect(workflow.rules[inProgress?.id ?? '']).toMatchObject({ assign: 'caller' });
    expect(workflow.rules[done?.id ?? '']).toMatchObject({
      roles: ['administrators'],
      subtasksDone: true,
      requiredFields: ['storyPoints'],
      onlyAssignee: false,
    });
    // Statuses without rules have none.
    expect(Object.keys(workflow.rules)).toHaveLength(3);
  });

  it('assign on the way, and let only the assignee move on', async () => {
    const inProgress = workflow.statuses.find((entry) => entry.category === 'in_progress');
    await admin.request('POST', '/issues', { projectKey: 'WEB', issueType: 'story', summary: 'A' });
    const started = await move(mira, 'WEB-1', inProgress?.name ?? '');
    expect(started.status).toBe(200);
    expect(started.body.assignee?.displayName).toBe('Mira Kaya');
    const history = (await admin.request<ChangeGroup[]>('GET', '/issues/WEB-1/history')).body;
    expect(history[0]?.items.map((item) => item.field).sort()).toEqual(['assignee', 'status']);

    expect(await offered(admin, 'WEB-1')).not.toContain('Review');
    expect((await move(admin, 'WEB-1', 'Review')).status).toBe(403);
    expect(await offered(mira, 'WEB-1')).toContain('Review');
    expect((await move(mira, 'WEB-1', 'Review')).status).toBe(200);
  });

  it('close only for the role, with subtasks done and required fields set', async () => {
    const done = workflow.statuses.find((entry) => entry.category === 'done');
    const doneName = done?.name ?? '';
    expect(await offered(mira, 'WEB-1')).not.toContain(doneName);
    expect((await move(mira, 'WEB-1', doneName)).status).toBe(403);

    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'subtask',
      summary: 'Teil',
      parentKey: 'WEB-1',
    });
    expect(await offered(admin, 'WEB-1')).not.toContain(doneName);
    await admin.request('PATCH', '/issues/WEB-2', { storyPoints: 1 });
    expect((await move(admin, 'WEB-2', doneName)).status).toBe(200);

    expect(await offered(admin, 'WEB-1')).toContain(doneName);
    const missing = await move(admin, 'WEB-1', doneName);
    expect(missing.status).toBe(400);
    expect(JSON.stringify(missing.body)).toContain('Story points');
    await admin.request('PATCH', '/issues/WEB-1', { storyPoints: 3 });
    expect((await move(admin, 'WEB-1', doneName)).status).toBe(200);
  });
});

describe('transition screen (TL-85)', () => {
  it('asks for fields and a comment, and sets them with the move or not at all', async () => {
    workflow = (await admin.request<ProjectWorkflow>('GET', '/projects/WEB/workflow')).body;
    const done = workflow.statuses.find((entry) => entry.category === 'done');
    if (!done) throw new Error('No done status');
    const published = await admin.request(
      'POST',
      '/projects/WEB/workflow',
      withRules({
        [done.name]: { requiredFields: ['dueDate'], comment: 'required', screen: true },
      }),
    );
    expect(published.status).toBe(200);
    workflow = published.body as ProjectWorkflow;
    const issue = (
      await admin.request<Issue>('POST', '/issues', {
        projectKey: 'WEB',
        issueType: 'task',
        summary: 'Mit Maske',
      })
    ).body;
    const transitions = (
      await admin.request<Transition[]>('GET', `/issues/${issue.key}/transitions`)
    ).body;
    expect(transitions.find((entry) => entry.to.id === done.id)).toMatchObject({
      requiredFields: ['dueDate'],
      comment: 'required',
      screen: true,
    });
    const transitionId = `to-${done.key}`;
    // Without the comment nothing changes, not even the field sent along.
    const refused = await admin.request('POST', `/issues/${issue.key}/transitions`, {
      transitionId,
      fields: { dueDate: '2026-12-01' },
    });
    expect(refused.status).toBe(400);
    expect((await admin.request<Issue>('GET', `/issues/${issue.key}`)).body.dueDate).toBeNull();

    const moved = await admin.request<Issue>('POST', `/issues/${issue.key}/transitions`, {
      transitionId,
      fields: { dueDate: '2026-12-01' },
      comment: { markdown: 'Fertig, siehe Protokoll' },
    });
    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({ dueDate: '2026-12-01', status: { id: done.id } });
    const comments = await admin.request<Array<{ body: unknown }>>(
      'GET',
      `/issues/${issue.key}/comments`,
    );
    expect(JSON.stringify(comments.body)).toContain('Fertig, siehe Protokoll');

    // Dragging on the board sends the same along.
    const other = (
      await admin.request<Issue>('POST', '/issues', {
        projectKey: 'WEB',
        issueType: 'task',
        summary: 'Auf dem Board',
      })
    ).body;
    const board = (
      await admin.request<{ id: string; columns: Array<{ id: string; statusIds: string[] }> }>(
        'POST',
        '/boards',
        { projectKey: 'WEB', name: 'Board', type: 'kanban' },
      )
    ).body;
    const boardId = board.id;
    const doneColumn = board.columns.find((column) => column.statusIds.includes(done.id));
    expect(
      (
        await admin.request('POST', `/boards/${boardId}/move`, {
          issueKey: other.key,
          columnId: doneColumn?.id,
        })
      ).status,
    ).toBe(400);
    const dragged = await admin.request<Issue>('POST', `/boards/${boardId}/move`, {
      issueKey: other.key,
      columnId: doneColumn?.id,
      fields: { dueDate: '2026-12-02' },
      comment: { markdown: 'Vom Board' },
    });
    expect(dragged.status).toBe(200);
    expect(dragged.body).toMatchObject({ dueDate: '2026-12-02', status: { id: done.id } });
  });
});
