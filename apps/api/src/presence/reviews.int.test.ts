import type {
  Agent,
  Comment,
  CreatedToken,
  Issue,
  NotificationList,
  ProjectDetails,
  ReviewRequest,
  Transition,
} from '@toolvibes/shared';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { developmentLinks, gitConnections } from '../db/schema/index.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let claude: TestClient;
let claudeAgent: Agent;
let codex: TestClient;
let codexAgent: Agent;
let review: ReviewRequest;

async function newAgent(
  name: string,
  vendor: string,
  roles: string[],
): Promise<[Agent, TestClient]> {
  const agent = (await admin.request<Agent>('POST', '/agents', { displayName: name, vendor })).body;
  await admin.request('POST', '/projects/WEB/members', { role: 'developers', userId: agent.id });
  await admin.request('PUT', `/projects/WEB/agent-settings/roles/${agent.id}`, { roles });
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
  await admin.request('POST', '/issues', {
    projectKey: 'WEB',
    issueType: 'task',
    summary: 'Login',
  });
  [claudeAgent, claude] = await newAgent('Claude', 'Claude Code', ['implementer']);
  await newAgent('Claude Review', 'Claude Code', ['reviewer']);
  [codexAgent, codex] = await newAgent('Codex', 'Codex CLI', ['reviewer']);
  // A pull request the git integration reported for the issue.
  const issue = (await admin.request<Issue>('GET', '/issues/WEB-1')).body;
  const connection = uuidv7();
  await test.database.db
    .insert(gitConnections)
    .values({ id: connection, name: 'GitHub', provider: 'github', secret: 'geheim' });
  await test.database.db.insert(developmentLinks).values({
    id: uuidv7(),
    connectionId: connection,
    issueId: issue.id,
    kind: 'pull_request',
    externalId: 'org/web#7',
    repository: 'org/web',
    title: 'WEB-1 Login',
    url: 'https://github.example/org/web/pull/7',
    state: 'open',
    data: { review: null },
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('reviews (TL-97)', () => {
  it('picks a reviewer of another vendor, never the author', async () => {
    await claude.request('POST', '/issues/WEB-1/claim', {});
    const asked = await claude.request<ReviewRequest>('POST', '/issues/WEB-1/reviews', {});
    expect(asked.status).toBe(201);
    review = asked.body;
    expect(review).toMatchObject({
      reviewer: { displayName: 'Codex' },
      requester: { displayName: 'Claude' },
      status: 'requested',
      pullRequest: { url: 'https://github.example/org/web/pull/7', state: 'open' },
    });
    expect(
      (await claude.request('POST', '/issues/WEB-1/reviews', { reviewer: claudeAgent.id })).status,
    ).toBe(400);
    const queue = (await codex.request<ReviewRequest[]>('GET', '/me/reviews')).body;
    expect(queue.map((entry) => entry.id)).toEqual([review.id]);
    const bell = (await codex.request<NotificationList>('GET', '/me/notifications')).body;
    expect(bell.notifications[0]?.details).toMatchObject({
      kind: 'review',
      items: [{ field: 'review', to: 'requested' }],
    });
  });

  it('turns the verdict into a review comment and the project’s status', async () => {
    const project = (await admin.request<ProjectDetails>('GET', '/projects/WEB')).body;
    const inProgress = project.statuses.find((status) => status.name === 'In Arbeit');
    await admin.request('PUT', '/projects/WEB/agent-settings', {
      reviewStatuses: { approved: null, changesRequested: inProgress?.id ?? null },
    });
    const toReview = (
      await claude.request<Transition[]>('GET', '/issues/WEB-1/transitions')
    ).body.find((entry) => entry.to.name === 'Review');
    if (toReview) {
      await claude.request('POST', '/issues/WEB-1/transitions', { transitionId: toReview.id });
    }

    expect(
      (
        await claude.request('POST', `/reviews/${review.id}/verdict`, {
          verdict: 'approved',
          body: 'Passt.',
        })
      ).status,
    ).toBe(403);
    const decided = await codex.request<ReviewRequest>('POST', `/reviews/${review.id}/verdict`, {
      verdict: 'changes_requested',
      body: 'Fehlerfall ohne Test.',
    });
    expect(decided.status).toBe(200);
    expect(decided.body).toMatchObject({
      status: 'changes_requested',
      verdict: 'Fehlerfall ohne Test.',
    });
    expect(
      (
        await codex.request('POST', `/reviews/${review.id}/verdict`, {
          verdict: 'approved',
          body: 'Doch.',
        })
      ).status,
    ).toBe(409);

    const comments = (
      await admin.request<Comment[]>('GET', '/issues/WEB-1/comments?format=markdown')
    ).body;
    expect(comments.at(-1)).toMatchObject({ kind: 'review', author: { displayName: 'Codex' } });
    expect(String(comments.at(-1)?.body)).toContain('**Review: Änderungen nötig**');
    const issue = (await admin.request<Issue>('GET', '/issues/WEB-1')).body;
    expect(issue.status.name).toBe('In Arbeit');
    const told = (await claude.request<NotificationList>('GET', '/me/notifications')).body;
    expect(told.notifications[0]?.details).toMatchObject({
      kind: 'review',
      items: [{ to: 'changes_requested' }],
      excerpt: 'Fehlerfall ohne Test.',
    });
  });

  it('can be withdrawn by who asked', async () => {
    const again = (
      await claude.request<ReviewRequest>('POST', '/issues/WEB-1/reviews', {
        reviewer: codexAgent.id,
      })
    ).body;
    expect((await codex.request('DELETE', `/reviews/${again.id}`)).status).toBe(403);
    expect((await claude.request('DELETE', `/reviews/${again.id}`)).status).toBe(204);
    const reviews = (await admin.request<ReviewRequest[]>('GET', '/issues/WEB-1/reviews')).body;
    expect(reviews.map((entry) => entry.status)).toEqual(['cancelled', 'changes_requested']);
  });
});
