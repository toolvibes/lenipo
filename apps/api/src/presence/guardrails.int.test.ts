import type {
  Agent,
  AgentActivityPage,
  AgentOverview,
  AgentRights,
  AgentUsage,
  CreatedToken,
  IssueApproval,
  NotificationList,
  PendingApprovals,
  ProjectDetails,
  Transition,
} from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let claude: TestClient;
let agent: Agent;

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
  for (const summary of ['Login', 'Suche', 'Export']) {
    await admin.request('POST', '/issues', { projectKey: 'WEB', issueType: 'task', summary });
  }
  agent = (
    await admin.request<Agent>('POST', '/agents', { displayName: 'Claude', vendor: 'Claude Code' })
  ).body;
  await admin.request('POST', '/projects/WEB/members', { role: 'developers', userId: agent.id });
  const token = await admin.request<CreatedToken>('POST', `/agents/${agent.id}/tokens`, {
    name: 'Lauf',
    scopes: ['issues:read', 'issues:write'],
    expiresInDays: 30,
  });
  claude = new TestClient(test.baseUrl, { authorization: `Bearer ${token.body.secret}` });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('guardrails (TL-98)', () => {
  it('pauses an agent: it reads, but writes and claims answer 423', async () => {
    expect((await claude.request('POST', '/issues/WEB-1/claim', {})).status).toBe(200);
    expect((await claude.request('PUT', `/agents/${agent.id}/pause`, {})).status).toBe(403);
    const paused = await admin.request<Agent>('PUT', `/agents/${agent.id}/pause`, {
      reason: 'Läuft im Kreis',
    });
    expect(paused.body.paused).toMatchObject({
      reason: 'Läuft im Kreis',
      by: { displayName: 'Lena Vogt' },
    });
    expect((await claude.request('GET', '/issues/WEB-1')).status).toBe(200);
    const comment = await claude.request<{ type: string; detail: string }>(
      'POST',
      '/issues/WEB-1/comments',
      { body: { markdown: 'Weiter' } },
    );
    expect(comment.status).toBe(423);
    expect(comment.body).toMatchObject({
      type: 'urn:lenipo:problem:agent-paused',
      detail: 'This agent is paused: Läuft im Kreis',
    });
    expect((await claude.request('POST', '/issues/WEB-2/claim', {})).status).toBe(423);
    expect(
      (await admin.request<{ claim: unknown }>('GET', '/issues/WEB-1/claim')).body.claim,
    ).toBeNull();
    await admin.request('DELETE', `/agents/${agent.id}/pause`);
    expect(
      (await claude.request('POST', '/issues/WEB-1/comments', { body: { markdown: 'Weiter' } }))
        .status,
    ).toBe(201);
  });

  it('pauses all agents of a project', async () => {
    await admin.request('PUT', '/projects/WEB/agent-settings/pause', { reason: 'Release' });
    const refused = await claude.request<{ detail: string }>('PATCH', '/issues/WEB-1', {
      summary: 'Anmelden',
    });
    expect(refused.status).toBe(423);
    expect(refused.body.detail).toBe('Agents are paused in this project: Release');
    // People are not held.
    expect((await admin.request('PATCH', '/issues/WEB-1', { summary: 'Anmelden' })).status).toBe(
      200,
    );
    await admin.request('DELETE', '/projects/WEB/agent-settings/pause');
    expect((await claude.request('POST', '/issues/WEB-1/claim', {})).status).toBe(200);
  });

  it('refuses new claims once the budget is used up and tells the responsible person', async () => {
    const usage = (await claude.request<AgentUsage>('GET', '/me/usage')).body;
    expect(usage.day.issues).toBe(2);
    await admin.request('PUT', `/agents/${agent.id}/budget`, {
      day: { issues: 2, minutes: null, cost: 5 },
      month: { issues: null, minutes: null, cost: null },
    });
    const refused = await claude.request<{ type: string }>('POST', '/issues/WEB-2/claim', {});
    expect(refused.status).toBe(409);
    expect(refused.body.type).toBe('urn:lenipo:problem:budget-exceeded');
    // Work already claimed goes on.
    expect((await claude.request('POST', '/issues/WEB-1/claim', {})).status).toBe(200);
    const reported = await claude.request<AgentUsage>('POST', '/me/usage', { cost: 4.25 });
    expect(reported.body).toMatchObject({
      day: { cost: 4.25 },
      exceeded: ['day.issues'],
    });
    const bell = (await admin.request<NotificationList>('GET', '/me/notifications')).body;
    const budget = bell.notifications.filter((entry) => entry.details.kind === 'budget');
    expect(budget.map((entry) => entry.details.items[0])).toEqual([
      { field: 'cost', from: 'day', to: '80' },
      { field: 'issues', from: 'day', to: '100' },
    ]);
    expect(budget[0]?.agent).toMatchObject({ displayName: 'Claude' });
    await admin.request('PUT', `/agents/${agent.id}/budget`, {});
  });

  it('lets a person approve moves of agents into kept statuses', async () => {
    const project = (await admin.request<ProjectDetails>('GET', '/projects/WEB')).body;
    const done = project.statuses.find((status) => status.category === 'done');
    await admin.request('PUT', '/projects/WEB/agent-settings', {
      approvalStatuses: [done?.id],
    });
    const toDone = (
      await claude.request<Transition[]>('GET', '/issues/WEB-1/transitions')
    ).body.find((entry) => entry.to.id === done?.id);
    const asked = await claude.request<IssueApproval>('POST', '/issues/WEB-1/transitions', {
      transitionId: toDone?.id,
      resolution: 'done',
    });
    expect(asked.status).toBe(202);
    expect(asked.body).toMatchObject({ status: 'pending', toStatus: { id: done?.id } });
    const pending = (await admin.request<PendingApprovals>('GET', '/approvals/pending')).body;
    expect(pending.issues.map((entry) => entry.id)).toEqual([asked.body.id]);
    expect(
      (
        await admin.request('POST', `/issue-approvals/${asked.body.id}/decision`, {
          approve: false,
        })
      ).status,
    ).toBe(400);
    const approved = await admin.request<IssueApproval>(
      'POST',
      `/issue-approvals/${asked.body.id}/decision`,
      { approve: true },
    );
    expect(approved.body).toMatchObject({
      status: 'approved',
      decidedBy: { displayName: 'Lena Vogt' },
    });
    const issue = (await admin.request<{ status: { id: string } }>('GET', '/issues/WEB-1')).body;
    expect(issue.status.id).toBe(done?.id);
    const told = (await claude.request<NotificationList>('GET', '/me/notifications')).body;
    expect(told.notifications[0]?.details).toMatchObject({
      kind: 'approval',
      items: [{ field: 'transition', to: 'approved' }],
    });
  });

  it('shows history, failures, the dashboard and the agent’s rights', async () => {
    const history = (
      await admin.request<AgentActivityPage>('GET', `/agents/${agent.id}/activity?limit=200`)
    ).body;
    const kinds = new Set(history.entries.map((entry) => entry.kind));
    expect([...kinds].sort()).toEqual(['approval', 'change', 'comment', 'request']);
    const failures = (
      await admin.request<AgentActivityPage>('GET', `/agents/${agent.id}/activity?failures=true`)
    ).body.entries;
    expect(failures.map((entry) => entry.status)).toEqual([409, 423, 423, 423, 403]);
    expect(failures[0]).toMatchObject({
      kind: 'request',
      title: 'POST /issues/WEB-2/claim',
      issue: { key: 'WEB-2' },
      ok: false,
    });
    expect((await claude.request('GET', `/agents/${agent.id}/activity`)).status).toBe(200);

    const overview = (await admin.request<AgentOverview[]>('GET', '/agents/overview')).body;
    expect(overview).toHaveLength(1);
    expect(overview[0]).toMatchObject({
      agent: { displayName: 'Claude', paused: null },
      throughput: 1,
      failures: 5,
      usage: { day: { issues: 2, cost: 4.25 } },
    });

    const rights = (await admin.request<AgentRights>('GET', `/agents/${agent.id}/rights`)).body;
    expect(rights.projects).toMatchObject([{ key: 'WEB', roles: ['implementer'], paused: false }]);
    expect(rights.projects[0]?.permissions).toContain('transition-issues');
    expect(rights.tokens).toMatchObject([
      { name: 'Lauf', scopes: ['issues:read', 'issues:write'] },
    ]);
  });
});
