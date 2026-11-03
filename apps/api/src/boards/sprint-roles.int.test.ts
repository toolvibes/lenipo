import type {
  Agent,
  Board,
  CreatedToken,
  NotificationList,
  ProjectAgentSettings,
  Sprint,
  SprintApproval,
} from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let board: Board;
let planner: TestClient;
let plannerAgent: Agent;
let developer: TestClient;
let coordinator: TestClient;
let sprint: Sprint;

async function newAgent(name: string): Promise<[Agent, TestClient]> {
  const agent = (
    await admin.request<Agent>('POST', '/agents', { displayName: name, vendor: 'Claude Code' })
  ).body;
  await admin.request('POST', '/projects/WEB/members', { role: 'developers', userId: agent.id });
  const token = await admin.request<CreatedToken>('POST', `/agents/${agent.id}/tokens`, {
    name: 'Lauf',
    scopes: ['issues:read', 'issues:write'],
    expiresInDays: 30,
  });
  return [agent, new TestClient(test.baseUrl, { authorization: `Bearer ${token.body.secret}` })];
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
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  for (const summary of ['Login', 'Suche']) {
    await admin.request('POST', '/issues', { projectKey: 'WEB', issueType: 'task', summary });
  }
  board = (
    await admin.request<Board>('POST', '/boards', {
      name: 'Team',
      projectKey: 'WEB',
      type: 'scrum',
    })
  ).body;
  [plannerAgent, planner] = await newAgent('Plan');
  [, developer] = await newAgent('Dev');
  const [coordinatorAgent, coordinatorClient] = await newAgent('Koordinator');
  coordinator = coordinatorClient;
  await admin.request('PUT', `/projects/WEB/agent-settings/roles/${plannerAgent.id}`, {
    roles: ['planner'],
  });
  await admin.request('PUT', `/projects/WEB/agent-settings/roles/${coordinatorAgent.id}`, {
    roles: ['coordinator'],
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('agent roles and sprint approval (TL-96)', () => {
  it('lets only planners plan and only implementers claim', async () => {
    const settings = (
      await developer.request<ProjectAgentSettings>('GET', '/projects/WEB/agent-settings')
    ).body;
    expect(settings).toMatchObject({ sprintApproval: false });
    expect(settings.agents.map((entry) => [entry.agent.displayName, entry.roles])).toEqual([
      ['Koordinator', ['coordinator']],
      ['Plan', ['planner']],
    ]);
    expect((await developer.request('POST', `/boards/${board.id}/sprints`, {})).status).toBe(403);
    const created = await planner.request<Sprint>('POST', `/boards/${board.id}/sprints`, {
      goal: 'Anmeldung',
    });
    expect(created.status).toBe(201);
    sprint = created.body;
    expect(
      (
        await developer.request('POST', '/sprints/move-issues', {
          issueKeys: ['WEB-1'],
          sprintId: sprint.id,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await planner.request('POST', '/sprints/move-issues', {
          issueKeys: ['WEB-1', 'WEB-2'],
          sprintId: sprint.id,
        })
      ).status,
    ).toBe(204);
    // Without roles an agent implements; a planner does not claim work.
    expect((await developer.request('POST', '/issues/WEB-1/claim', {})).status).toBe(200);
    expect((await planner.request('POST', '/issues/WEB-2/claim', {})).status).toBe(403);
    // Only administrators change the settings.
    expect(
      (await developer.request('PUT', '/projects/WEB/agent-settings', { sprintApproval: true }))
        .status,
    ).toBe(403);
  });

  it('starts a sprint only after a person approved it', async () => {
    await admin.request('PUT', '/projects/WEB/agent-settings', { sprintApproval: true });
    const body = { startDate: '2026-11-03', endDate: '2026-11-17' };
    const requested = await planner.request<SprintApproval>(
      'POST',
      `/sprints/${sprint.id}/start`,
      body,
    );
    expect(requested.status).toBe(202);
    expect(requested.body).toMatchObject({ action: 'start', status: 'pending' });
    const again = await planner.request<SprintApproval>(
      'POST',
      `/sprints/${sprint.id}/start`,
      body,
    );
    expect(again.body.id).toBe(requested.body.id);

    const bell = (await admin.request<NotificationList>('GET', '/me/notifications')).body;
    expect(bell.notifications[0]).toMatchObject({
      sprint: { id: sprint.id },
      details: { kind: 'approval', items: [{ field: 'start', to: 'requested' }] },
    });
    // Agents do not approve each other.
    expect(
      (
        await coordinator.request('POST', `/sprint-approvals/${requested.body.id}/decision`, {
          approve: true,
        })
      ).status,
    ).toBe(403);
    const approved = await admin.request<SprintApproval>(
      'POST',
      `/sprint-approvals/${requested.body.id}/decision`,
      { approve: true },
    );
    expect(approved.body).toMatchObject({
      status: 'approved',
      decidedBy: { displayName: 'Lena Vogt' },
    });
    const sprints = (await admin.request<Sprint[]>('GET', `/boards/${board.id}/sprints`)).body;
    expect(sprints.find((entry) => entry.id === sprint.id)?.state).toBe('active');
    const told = (await planner.request<NotificationList>('GET', '/me/notifications')).body;
    expect(told.notifications[0]?.details.items[0]).toMatchObject({ to: 'approved' });
  });

  it('tells the coordinator why the completion was rejected', async () => {
    expect((await developer.request('POST', `/sprints/${sprint.id}/complete`, {})).status).toBe(
      403,
    );
    const requested = await coordinator.request<SprintApproval>(
      'POST',
      `/sprints/${sprint.id}/complete`,
      {},
    );
    expect(requested.status).toBe(202);
    await admin.request('POST', `/sprint-approvals/${requested.body.id}/decision`, {
      approve: false,
      reason: 'Login ist noch nicht getestet.',
    });
    const sprints = (await admin.request<Sprint[]>('GET', `/boards/${board.id}/sprints`)).body;
    expect(sprints.find((entry) => entry.id === sprint.id)?.state).toBe('active');
    const told = (await coordinator.request<NotificationList>('GET', '/me/notifications')).body;
    expect(told.notifications[0]?.details).toMatchObject({
      excerpt: 'Login ist noch nicht getestet.',
      items: [{ field: 'complete', to: 'rejected' }],
    });
    const pending = (
      await admin.request<SprintApproval[]>('GET', '/projects/WEB/sprint-approvals?status=pending')
    ).body;
    expect(pending).toEqual([]);
  });
});
