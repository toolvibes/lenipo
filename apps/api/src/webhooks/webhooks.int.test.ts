import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { CreatedWebhook, Webhook, WebhookDelivery, WebhookSecret } from '@toolvibes/shared';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { webhookDeliveries, webhooks } from '../db/schema/index.js';
import { EventProcessor } from '../events/event-processor.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { docFromText } from '../tracking/rich-text.js';
import { sign } from './signature.js';
import { WebhookService } from './webhook.service.js';

interface Received {
  headers: IncomingHttpHeaders;
  body: string;
}

/** A local receiver that records requests and answers with the next queued status (200 by default). */
class Receiver {
  readonly requests: Received[] = [];
  readonly statuses: number[] = [];
  private server: Server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      this.requests.push({
        headers: request.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      });
      response.statusCode = this.statuses.shift() ?? 200;
      response.end('ok');
    });
  });

  async start(): Promise<string> {
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}/hook`;
  }

  get port(): number {
    return (this.server.address() as AddressInfo).port;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  payloads(): Array<{ type: string; data: Record<string, unknown> }> {
    return this.requests.map((entry) => JSON.parse(entry.body));
  }
}

async function setUpAdmin(test: TestApp): Promise<TestClient> {
  const admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  return admin;
}

describe('webhooks', () => {
  let test: TestApp;
  let admin: TestClient;
  let receiver: Receiver;
  let webhook: CreatedWebhook;

  const deliver = async () => {
    await test.app.get(EventProcessor).drain();
    while ((await test.app.get(WebhookService).deliverDue()) > 0);
  };

  beforeAll(async () => {
    test = await startTestApp({ WEBHOOK_ALLOW_PRIVATE_NETWORKS: 'true' });
    admin = await setUpAdmin(test);
    receiver = new Receiver();
    await admin.request('POST', '/projects', {
      key: 'WEB',
      name: 'Web-Relaunch',
      template: 'scrum',
    });
    await admin.request('POST', '/projects', { key: 'OPS', name: 'Betrieb', template: 'basic' });
  }, 60_000);

  afterAll(async () => {
    await receiver?.stop();
    await test?.close();
  });

  it('is managed by global administrators only', async () => {
    await admin.request('POST', '/admin/users', {
      email: 'jonas@example.org',
      displayName: 'Jonas Schulz',
      password: 'ein-langes-passwort',
    });
    const member = new TestClient(test.baseUrl);
    await member.request('POST', '/auth/login', {
      email: 'jonas@example.org',
      password: 'ein-langes-passwort',
    });
    expect((await member.request('GET', '/admin/webhooks')).status).toBe(403);
  });

  it('creates a webhook and shows the secret only once', async () => {
    const url = await receiver.start();
    const created = await admin.request<CreatedWebhook>('POST', '/admin/webhooks', {
      name: 'Chat',
      url,
      events: ['issue.created', 'issue.transitioned', 'comment.created'],
      projectKeys: ['web'],
    });
    expect(created.status).toBe(201);
    webhook = created.body;
    expect(webhook).toMatchObject({ name: 'Chat', projectKeys: ['WEB'], enabled: true });
    expect(webhook.secret).toMatch(/^whsec_/);
    const list = await admin.request<Webhook[]>('GET', '/admin/webhooks');
    expect(list.body[0]).not.toHaveProperty('secret');
    const unknown = await admin.request('POST', '/admin/webhooks', {
      name: 'x',
      url,
      events: ['issue.created'],
      projectKeys: ['NOPE'],
    });
    expect(unknown.status).toBe(400);
  });

  it('delivers matching events, signed per Standard Webhooks', async () => {
    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Login',
    });
    await admin.request('POST', '/issues', {
      projectKey: 'OPS',
      issueType: 'task',
      summary: 'Backup',
    });
    await deliver();
    expect(receiver.requests).toHaveLength(1);
    const [request] = receiver.requests;
    const id = String(request?.headers['webhook-id']);
    const timestamp = Number(request?.headers['webhook-timestamp']);
    expect(Math.abs(timestamp - Date.now() / 1000)).toBeLessThan(60);
    expect(request?.headers['webhook-signature']).toBe(
      sign(webhook.secret, id, timestamp, request?.body ?? ''),
    );
    expect(receiver.payloads()[0]).toMatchObject({
      type: 'issue.created',
      data: {
        actor: { displayName: 'Lena Vogt' },
        issue: { key: 'WEB-1', summary: 'Login', status: { key: 'open' } },
      },
    });
  });

  it('sends transitions and comments but not unsubscribed changes', async () => {
    await admin.request('PATCH', '/issues/WEB-1', { summary: 'Login über Keycloak' });
    await admin.request('POST', '/issues/WEB-1/transitions', { transitionId: 'to-in-progress' });
    await admin.request('POST', '/issues/WEB-1/comments', { body: docFromText('Gestartet') });
    await deliver();
    const [transition, comment] = receiver.payloads().slice(1);
    expect(receiver.requests).toHaveLength(3);
    expect(transition).toMatchObject({
      type: 'issue.transitioned',
      data: {
        changes: [{ field: 'status', from: 'Offen', to: 'In Arbeit' }],
        issue: { summary: 'Login über Keycloak', status: { key: 'in-progress' } },
      },
    });
    expect(comment).toMatchObject({
      type: 'comment.created',
      data: { comment: { text: 'Gestartet', body: docFromText('Gestartet') } },
    });
  });

  it('retries failed deliveries later and can resend them at once', async () => {
    receiver.statuses.push(500);
    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Fehler',
    });
    await deliver();
    const [failed] = (
      await admin.request<WebhookDelivery[]>('GET', `/admin/webhooks/${webhook.id}/deliveries`)
    ).body;
    expect(failed).toMatchObject({ status: 'pending', attempts: 1, responseStatus: 500 });
    expect(new Date(failed?.nextAttemptAt ?? 0).getTime()).toBeGreaterThan(Date.now());
    // The first retry is due after 5 s, which a loaded test run can outlast: push it back so
    // "not due yet" does not depend on timing.
    await test.database.db
      .update(webhookDeliveries)
      .set({ nextAttemptAt: sql`now() + interval '1 hour'` })
      .where(eq(webhookDeliveries.id, failed?.id ?? ''));
    // Not due yet, so nothing is sent again.
    const before = receiver.requests.length;
    await deliver();
    expect(receiver.requests).toHaveLength(before);

    const resent = await admin.request<WebhookDelivery>(
      'POST',
      `/admin/webhooks/${webhook.id}/deliveries/${failed?.id}/resend`,
    );
    expect(resent.body).toMatchObject({ status: 'succeeded', attempts: 2, responseStatus: 200 });
    // Retries keep the message id, so receivers can drop duplicates.
    expect(receiver.requests.at(-1)?.headers['webhook-id']).toBe(failed?.id);
    const health = await admin.request<Webhook>('GET', `/admin/webhooks/${webhook.id}`);
    expect(health.body.failingSince).toBeNull();
  });

  it('sends test messages and signs with a rotated secret', async () => {
    const rotated = await admin.request<WebhookSecret>(
      'POST',
      `/admin/webhooks/${webhook.id}/rotate-secret`,
    );
    expect(rotated.body.secret).not.toBe(webhook.secret);
    const ping = await admin.request<WebhookDelivery>('POST', `/admin/webhooks/${webhook.id}/test`);
    expect(ping.body).toMatchObject({ type: 'webhook.test', status: 'succeeded' });
    const request = receiver.requests.at(-1);
    expect(request?.headers['webhook-signature']).toBe(
      sign(
        rotated.body.secret,
        String(request?.headers['webhook-id']),
        Number(request?.headers['webhook-timestamp']),
        request?.body ?? '',
      ),
    );
  });

  it('switches a webhook off after three days of failures and on again', async () => {
    await test.database.db
      .update(webhooks)
      .set({ failingSince: sql`now() - interval '4 days'` })
      .where(eq(webhooks.id, webhook.id));
    receiver.statuses.push(503);
    await admin.request('POST', '/issues/WEB-1/comments', { body: docFromText('Noch einer') });
    await deliver();
    const off = await admin.request<Webhook>('GET', `/admin/webhooks/${webhook.id}`);
    expect(off.body).toMatchObject({
      enabled: false,
      disabledReason: expect.stringContaining('3 days'),
    });

    // Disabled webhooks get no new deliveries.
    const before = receiver.requests.length;
    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Still',
    });
    await deliver();
    expect(receiver.requests).toHaveLength(before);

    const on = await admin.request<Webhook>('PATCH', `/admin/webhooks/${webhook.id}`, {
      enabled: true,
    });
    expect(on.body).toMatchObject({ enabled: true, disabledReason: null, failingSince: null });
  });

  it('deletes a webhook with its log', async () => {
    expect((await admin.request('DELETE', `/admin/webhooks/${webhook.id}`)).status).toBe(204);
    expect((await admin.request('GET', `/admin/webhooks/${webhook.id}`)).status).toBe(404);
  });
});

describe('webhooks and private networks', () => {
  let test: TestApp;
  let admin: TestClient;
  let receiver: Receiver;

  beforeAll(async () => {
    test = await startTestApp();
    admin = await setUpAdmin(test);
    receiver = new Receiver();
    await receiver.start();
  }, 60_000);

  afterAll(async () => {
    await receiver?.stop();
    await test?.close();
  });

  it('refuses private targets by default', async () => {
    for (const url of [
      `http://127.0.0.1:${receiver.port}/`,
      'http://localhost/',
      'http://[::1]/',
      'http://169.254.169.254/',
    ]) {
      const response = await admin.request('POST', '/admin/webhooks', {
        name: 'Intern',
        url,
        events: ['issue.created'],
      });
      expect(response.status, url).toBe(400);
    }
  });

  it('checks the resolved address when connecting', async () => {
    // "localhost." passes the form check but resolves to a loopback address.
    const created = await admin.request<CreatedWebhook>('POST', '/admin/webhooks', {
      name: 'Umweg',
      url: `http://localhost.:${receiver.port}/`,
      events: ['issue.created'],
    });
    expect(created.status).toBe(201);
    const ping = await admin.request<WebhookDelivery>(
      'POST',
      `/admin/webhooks/${created.body.id}/test`,
    );
    expect(ping.body).toMatchObject({ status: 'failed', responseStatus: null });
    expect(ping.body.responseBody).toContain('private address');
    expect(receiver.requests).toHaveLength(0);
  });
});
