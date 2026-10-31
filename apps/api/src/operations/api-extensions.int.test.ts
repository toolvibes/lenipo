import { createHash, randomBytes } from 'node:crypto';
import type {
  AutomationRule,
  BulkItemsResult,
  CreatedWebhook,
  Issue,
  OAuthAppCreated,
  OAuthClientInfo,
  OAuthConsentResult,
  Page,
} from '@tasklore/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AutomationEngine } from '../automation/automation.engine.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { webhookDeliveries } from '../db/schema/index.js';
import { EventProcessor } from '../events/event-processor.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web-Relaunch', template: 'scrum' });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('Idempotency-Key (TL-41)', () => {
  it('answers a repeat with the first answer and refuses a different request', async () => {
    const body = { projectKey: 'WEB', issueType: 'task', summary: 'Einmal' };
    const first = await admin.request<Issue>('POST', '/issues', body, { 'idempotency-key': 'k-1' });
    expect(first.status).toBe(201);
    const again = await admin.request<Issue>('POST', '/issues', body, { 'idempotency-key': 'k-1' });
    expect(again.status).toBe(201);
    expect(again.headers.get('idempotent-replayed')).toBe('true');
    expect(again.body.key).toBe(first.body.key);
    const other = await admin.request(
      'POST',
      '/issues',
      { ...body, summary: 'Anders' },
      {
        'idempotency-key': 'k-1',
      },
    );
    expect(other.status).toBe(422);
    // Without a key, or with a new one, it runs again.
    const fresh = await admin.request<Issue>('POST', '/issues', body, { 'idempotency-key': 'k-2' });
    expect(fresh.body.key).not.toBe(first.body.key);
    // Failures are not kept.
    const bad = { projectKey: 'NOPE', issueType: 'task', summary: 'x' };
    expect((await admin.request('POST', '/issues', bad, { 'idempotency-key': 'k-3' })).status).toBe(
      404,
    );
    expect(
      (await admin.request('POST', '/issues', body, { 'idempotency-key': 'k-3' })).status,
    ).toBe(201);
  });
});

describe('bulk endpoints (TL-41)', () => {
  it('creates many issues and reports each one', async () => {
    const result = await admin.request<BulkItemsResult>('POST', '/issues/bulk-create', {
      issues: [
        { projectKey: 'WEB', issueType: 'task', summary: 'Eins' },
        { projectKey: 'NOPE', issueType: 'task', summary: 'Zwei' },
        { projectKey: 'WEB', issueType: 'bug', summary: 'Drei' },
      ],
    });
    expect(result.status).toBe(200);
    expect(result.body.results.map((line) => line.ok)).toEqual([true, false, true]);
    expect(result.body.results[1]?.error).toBeTruthy();
  });

  it('creates all or nothing when atomic', async () => {
    const before = (
      await admin.request<{ total: number }>('POST', '/search', { query: 'project = WEB' })
    ).body.total;
    const failed = await admin.request<BulkItemsResult>('POST', '/issues/bulk-create', {
      atomic: true,
      issues: [
        { projectKey: 'WEB', issueType: 'task', summary: 'Teil eins' },
        { projectKey: 'NOPE', issueType: 'task', summary: 'Teil zwei' },
      ],
    });
    expect(failed.body.results.map((line) => line.ok)).toEqual([false, false]);
    expect(failed.body.results[0]?.error).toContain('item 2');
    const after = (
      await admin.request<{ total: number }>('POST', '/search', { query: 'project = WEB' })
    ).body.total;
    expect(after).toBe(before);
    const done = await admin.request<BulkItemsResult>('POST', '/issues/bulk-create', {
      atomic: true,
      issues: [
        { projectKey: 'WEB', issueType: 'task', summary: 'Ganz eins' },
        { projectKey: 'WEB', issueType: 'task', summary: 'Ganz zwei' },
      ],
    });
    expect(done.body.results.every((line) => line.ok && line.key)).toBe(true);
  });

  it('changes issues each in its own way', async () => {
    const result = await admin.request<BulkItemsResult>('POST', '/issues/bulk-update', {
      updates: [
        { key: 'WEB-1', fields: { summary: 'Neu eins' } },
        { key: 'web-2', fields: { labels: ['api'] } },
      ],
    });
    expect(result.body.results.map((line) => line.key)).toEqual(['WEB-1', 'WEB-2']);
    expect((await admin.request<Issue>('GET', '/issues/WEB-1')).body.summary).toBe('Neu eins');
    expect((await admin.request<Issue>('GET', '/issues/WEB-2')).body.labels).toEqual(['api']);
  });
});

describe('OAuth apps registered by admins (TL-41)', () => {
  it('lets a confidential app sign in only with its secret', async () => {
    const redirect = 'https://app.example.org/callback';
    const created = await admin.request<OAuthAppCreated>('POST', '/admin/oauth-apps', {
      name: 'Zeiterfassung GmbH',
      description: 'Bucht Zeiten aus der Stempeluhr',
      redirectUris: [redirect],
    });
    expect(created.status).toBe(201);
    const { app, clientSecret } = created.body;
    expect(app.confidential).toBe(true);
    expect(clientSecret).toMatch(/^tl_ocs_/);
    const info = await admin.request<OAuthClientInfo>(
      'GET',
      `/oauth/client?client_id=${app.id}&redirect_uri=${encodeURIComponent(redirect)}`,
    );
    expect(info.body).toMatchObject({
      registered: true,
      description: 'Bucht Zeiten aus der Stempeluhr',
    });

    const verifier = randomBytes(32).toString('base64url');
    const consent = async () =>
      new URL(
        (
          await admin.request<OAuthConsentResult>('POST', '/oauth/consent', {
            clientId: app.id,
            redirectUri: redirect,
            scopes: ['issues:read'],
            approve: true,
            codeChallenge: createHash('sha256').update(verifier).digest('base64url'),
            codeChallengeMethod: 'S256',
          })
        ).body.redirect,
      ).searchParams.get('code') ?? '';
    const exchange = async (code: string, headers: Record<string, string>, extra = {}) => {
      const response = await fetch(`${test.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          code_verifier: verifier,
          client_id: app.id,
          ...extra,
        }),
      });
      return { status: response.status, body: (await response.json()) as Record<string, string> };
    };
    const code = await consent();
    const without = await exchange(code, {});
    expect(without.status).toBe(401);
    expect(without.body.error).toBe('invalid_client');
    // The wrong attempt did not use up the code.
    const basic = Buffer.from(`${app.id}:${clientSecret}`).toString('base64');
    const ok = await exchange(code, { authorization: `Basic ${basic}` });
    expect(ok.status).toBe(200);
    expect(ok.body.access_token).toMatch(/^tl_oat_/);

    const rotated = await admin.request<OAuthAppCreated>(
      'POST',
      `/admin/oauth-apps/${app.id}/secret`,
    );
    const old = await exchange(await consent(), {}, { client_secret: clientSecret ?? '' });
    expect(old.status).toBe(401);
    const fresh = await exchange(
      await consent(),
      {},
      {
        client_secret: rotated.body.clientSecret ?? '',
      },
    );
    expect(fresh.status).toBe(200);
    const apps = await admin.request<Array<{ id: string; connections: number }>>(
      'GET',
      '/admin/oauth-apps',
    );
    expect(apps.body.find((entry) => entry.id === app.id)?.connections).toBeGreaterThan(0);
    expect((await admin.request('DELETE', `/admin/oauth-apps/${app.id}`)).status).toBe(204);
  });
});

describe('webhook filters and new events (TL-41)', () => {
  it('delivers only matching issues and page events of chosen spaces', async () => {
    await admin.request('POST', '/spaces', { key: 'DOCS', name: 'Doku' });
    await admin.request('POST', '/spaces', { key: 'ANDERS', name: 'Anders' });
    await test.app.get(EventProcessor).drain();
    expect(
      (
        await admin.request('POST', '/admin/webhooks', {
          name: 'Kaputt',
          url: 'https://hooks.example.org/x',
          events: ['issue.created'],
          tql: 'nonsense ===',
        })
      ).status,
    ).toBe(400);
    const hook = (
      await admin.request<CreatedWebhook>('POST', '/admin/webhooks', {
        name: 'Nur Bugs und Doku',
        url: 'https://hooks.example.org/x',
        events: ['issue.created', 'page.published'],
        tql: 'type = Bug',
        spaceKeys: ['DOCS'],
      })
    ).body;
    expect(hook).toMatchObject({ tql: 'type = Bug', spaceKeys: ['DOCS'] });
    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Aufgabe',
    });
    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'bug',
      summary: 'Fehler',
    });
    for (const space of ['DOCS', 'ANDERS']) {
      const page = (await admin.request<Page>('POST', `/spaces/${space}/pages`, { title: space }))
        .body;
      await admin.request('POST', `/pages/${page.id}/publish`, {
        title: `Seite ${space}`,
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
        },
      });
    }
    await test.app.get(EventProcessor).drain();
    const rows = await test.app
      .get<DatabaseHandle>(DATABASE)
      .db.select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, hook.id));
    const delivered = rows.map((row) => {
      const data = (row.payload as { data: Record<string, { summary?: string; title?: string }> })
        .data;
      return `${row.type}:${data.issue?.summary ?? data.page?.title}`;
    });
    expect(delivered).toContain('issue.created:Fehler');
    expect(delivered).toContain('page.published:Seite DOCS');
    expect(delivered.filter((line) => /Aufgabe|ANDERS/.test(line))).toEqual([]);
  });
});

describe('incoming webhooks (TL-41)', () => {
  it('accepts the secret in a header and can rotate it', async () => {
    const rule = (
      await admin.request<AutomationRule & { webhookUrl: string | null }>(
        'POST',
        '/automation/rules',
        {
          name: 'Von außen',
          projectKey: 'WEB',
          trigger: { type: 'incoming-webhook' },
          components: [{ type: 'comment', body: 'Angestoßen' }],
        },
      )
    ).body;
    const url = new URL(rule.webhookUrl ?? '', 'http://tasklore.test');
    const secret = url.searchParams.get('token') ?? '';
    const call = (headers: Record<string, string>) =>
      fetch(`${test.baseUrl}/automation/hooks/${rule.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({ issues: ['WEB-1'] }),
      });
    expect((await call({ authorization: `Bearer ${secret}` })).status).toBe(202);
    expect((await call({ 'x-tasklore-token': secret })).status).toBe(202);
    const rotated = await admin.request<{ webhookUrl: string }>(
      'POST',
      `/automation/rules/${rule.id}/webhook-token`,
    );
    expect(rotated.body.webhookUrl).not.toContain(secret);
    expect((await call({ 'x-tasklore-token': secret })).status).not.toBe(202);
    await test.app.get(AutomationEngine).runDue();
  });
});
