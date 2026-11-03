import type {
  Agent,
  AgentWebhook,
  ClaimResult,
  Comment,
  CreatedToken,
  Issue,
  NotificationList,
  Presence,
  Webhook,
} from '@toolvibes/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { webhookDeliveries } from '../db/schema/index.js';
import { EventProcessor } from '../events/event-processor.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let claude: TestClient;
let codex: TestClient;
let codexAgent: Agent;
let codexSecret: string;

async function newAgent(name: string, vendor: string): Promise<[Agent, string]> {
  const agent = (await admin.request<Agent>('POST', '/agents', { displayName: name, vendor })).body;
  await admin.request('POST', '/projects/WEB/members', { role: 'developers', userId: agent.id });
  const token = await admin.request<CreatedToken>('POST', `/agents/${agent.id}/tokens`, {
    name: 'Lauf',
    scopes: ['issues:read', 'issues:write'],
    expiresInDays: 30,
  });
  return [agent, token.body.secret];
}

/** Opens the event stream; `next` resolves with the first notification event. */
async function openEvents(secret: string, signal: AbortSignal): Promise<{ next: Promise<string> }> {
  const response = await fetch(`${test.baseUrl}/me/events`, {
    headers: { authorization: `Bearer ${secret}` },
    signal,
  });
  expect(response.headers.get('content-type')).toContain('text/event-stream');
  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  const next = (async () => {
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return buffer;
      buffer += decoder.decode(value);
      const event = buffer.split('\n\n').find((block) => block.includes('event: notification'));
      if (event) return event;
    }
  })();
  return { next };
}

beforeAll(async () => {
  test = await startTestApp({ WEBHOOK_ALLOW_PRIVATE_NETWORKS: 'true' });
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  for (const summary of ['Login', 'Datenbank']) {
    await admin.request('POST', '/issues', { projectKey: 'WEB', issueType: 'task', summary });
  }
  const [, claudeSecret] = await newAgent('Claude', 'Claude Code');
  [codexAgent, codexSecret] = await newAgent('Codex', 'Codex CLI');
  claude = new TestClient(test.baseUrl, { authorization: `Bearer ${claudeSecret}` });
  codex = new TestClient(test.baseUrl, { authorization: `Bearer ${codexSecret}` });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('handovers and events (TL-95)', () => {
  it('gives an agent its own webhook, apart from the instance webhooks', async () => {
    const set = await admin.request<AgentWebhook>('PUT', `/agents/${codexAgent.id}/webhook`, {
      url: 'http://127.0.0.1:9/codex',
    });
    expect(set.status).toBe(200);
    expect(set.body.secret).toMatch(/^whsec_/);
    expect((await codex.request('PUT', `/agents/${codexAgent.id}/webhook`, set.body)).status).toBe(
      403,
    );
    expect((await admin.request<Webhook[]>('GET', '/admin/webhooks')).body).toEqual([]);
    const agents = (await admin.request<Agent[]>('GET', '/agents')).body;
    expect(agents.find((agent) => agent.id === codexAgent.id)?.webhookUrl).toBe(
      'http://127.0.0.1:9/codex',
    );
  });

  it('hands over with assignee, claim and a live event for the next one', async () => {
    await claude.request('POST', '/issues/WEB-1/claim', {
      branch: 'agent/WEB-1-login',
      paths: ['apps/web'],
    });
    const abort = new AbortController();
    const events = await openEvents(codexSecret, abort.signal);
    const handed = await claude.request<Comment>('POST', '/issues/WEB-1/handover', {
      done: 'Formular und Validierung.',
      open: 'Tests für den Fehlerfall.',
      to: codexAgent.id,
    });
    expect(handed.status).toBe(201);
    expect(handed.body.kind).toBe('handover');
    // The worker turns the comment into notifications; in tests it runs on demand.
    await test.app.get(EventProcessor).drain();

    const received = await Promise.race([
      events.next,
      new Promise<string>((resolve) => setTimeout(() => resolve('timeout'), 8000)),
    ]);
    abort.abort();
    expect(received).toContain('event: notification');
    expect(received).toContain('"key":"WEB-1"');

    const issue = (await admin.request<Issue>('GET', '/issues/WEB-1')).body;
    expect(issue.assignee?.id).toBe(codexAgent.id);
    const claim = (await admin.request<ClaimResult>('GET', '/issues/WEB-1/claim')).body.claim;
    expect(claim).toMatchObject({ user: { displayName: 'Codex' }, branch: 'agent/WEB-1-login' });
    const comments = (
      await admin.request<Comment[]>('GET', '/issues/WEB-1/comments?format=markdown')
    ).body;
    expect(String(comments.at(-1)?.body)).toContain('**Übergabe** an @[Codex]');
    expect(String(comments.at(-1)?.body)).toContain('**Offen**');

    // The mention also waits in the inbox and goes to Codex's own webhook.
    const inbox = (await codex.request<NotificationList>('GET', '/me/notifications?unread=true'))
      .body;
    expect(inbox.notifications.map((entry) => entry.issue?.key)).toContain('WEB-1');
    const deliveries = await test.database.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.type, 'notification.created'));
    expect(deliveries.length).toBeGreaterThan(0);
    expect(deliveries[0]?.payload).toMatchObject({
      type: 'notification.created',
      data: { notification: { issue: { key: 'WEB-1' } } },
    });
  }, 20_000);

  it('reports a blocker with link, comment and blocked state', async () => {
    const reported = await codex.request<Comment>('POST', '/issues/WEB-1/blocker', {
      blockedBy: 'WEB-2',
      note: 'Die Tabelle fehlt noch.',
    });
    expect(reported.status).toBe(201);
    const issue = (await admin.request<Issue>('GET', '/issues/WEB-1')).body;
    expect(JSON.stringify(issue.links)).toContain('WEB-2');
    expect((await codex.request<Presence>('GET', '/me/presence')).body).toMatchObject({
      state: 'blocked',
      issue: { key: 'WEB-1' },
      note: 'Die Tabelle fehlt noch.',
    });
    // Reporting the same blocker again works.
    expect(
      (
        await codex.request('POST', '/issues/WEB-1/blocker', {
          blockedBy: 'WEB-2',
          note: 'Immer noch.',
        })
      ).status,
    ).toBe(201);
  });
});
