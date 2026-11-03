import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type {
  AppSummary,
  AppToken,
  AutomationRun,
  Comment,
  CreatedToken,
  InstalledApp,
} from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AutomationEngine } from '../automation/automation.engine.js';
import { EventProcessor } from '../events/event-processor.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let vendor: Server;
let vendorOrigin: string;
const manifests = new Map<string, unknown>();

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    key: 'abhaengigkeiten',
    name: 'Abhängigkeiten',
    vendor: 'Beispiel GmbH',
    baseUrl: `${vendorOrigin}/lenipo/`,
    scopes: ['issues:read'],
    modules: {
      issuePanels: [{ key: 'graph', title: 'Graph', url: 'panel.html' }],
      macros: [{ key: 'chart', title: 'Diagramm', url: '/lenipo/macro.html' }],
      gadgets: [{ key: 'kpi', title: 'Kennzahl', url: `${vendorOrigin}/lenipo/gadget.html` }],
    },
    ...overrides,
  };
}

async function drain(): Promise<void> {
  const processor = test.app.get(EventProcessor);
  await test.app.get(AutomationEngine).drain(() => processor.drain());
}

beforeAll(async () => {
  vendor = createServer((request, response) => {
    const body = manifests.get(request.url ?? '');
    response.statusCode = body ? 200 : 404;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(body ?? {}));
  });
  await new Promise<void>((resolve) => vendor.listen(0, '127.0.0.1', resolve));
  vendorOrigin = `http://127.0.0.1:${(vendor.address() as AddressInfo).port}`;
  manifests.set('/lenipo-app.json', manifest());

  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('POST', '/projects', { key: 'OPS', name: 'Betrieb', template: 'kanban' });
  await admin.request('POST', '/issues', {
    projectKey: 'OPS',
    issueType: 'task',
    summary: 'Zertifikat erneuern',
  });
  await drain();
}, 60_000);

afterAll(async () => {
  await test?.close();
  vendor?.close();
});

describe('apps (TL-50)', () => {
  let app: InstalledApp;

  it('installs an app only with its scopes approved and never on our own origin', async () => {
    const manifestUrl = `${vendorOrigin}/lenipo-app.json`;
    const preview = await admin.request<{ scopes: string[] }>('POST', '/admin/apps/preview', {
      manifestUrl,
    });
    expect(preview.body.scopes).toEqual(['issues:read']);
    expect(
      (await admin.request('POST', '/admin/apps', { manifestUrl, approvedScopes: [] })).status,
    ).toBe(409);

    const installed = await admin.request<InstalledApp>('POST', '/admin/apps', {
      manifestUrl,
      approvedScopes: ['issues:read'],
    });
    expect(installed.status).toBe(201);
    app = installed.body;
    expect(app.modules.issuePanels[0]?.url).toBe(`${vendorOrigin}/lenipo/panel.html`);
    expect(app.modules.macros[0]?.url).toBe(`${vendorOrigin}/lenipo/macro.html`);

    const ours = new URL(test.baseUrl).origin;
    manifests.set('/ours.json', manifest({ key: 'eigen', baseUrl: `${ours}/x/` }));
    expect(
      (
        await admin.request('POST', '/admin/apps/preview', {
          manifestUrl: `${vendorOrigin}/ours.json`,
        })
      ).status,
    ).toBe(400);
    manifests.set(
      '/away.json',
      manifest({
        key: 'weg',
        modules: { macros: [{ key: 'x', title: 'X', url: 'https://example.org/' }] },
      }),
    );
    expect(
      (
        await admin.request('POST', '/admin/apps/preview', {
          manifestUrl: `${vendorOrigin}/away.json`,
        })
      ).status,
    ).toBe(400);

    const listed = (await admin.request<AppSummary[]>('GET', '/apps')).body;
    expect(listed.map((entry) => entry.key)).toEqual(['abhaengigkeiten']);
  });

  it('hands the viewer a token limited to the approved scopes, usable from the app origin', async () => {
    const token = await admin.request<AppToken>('POST', `/apps/${app.id}/token`);
    expect(token.status).toBe(200);
    expect(token.body.expiresIn).toBe(900);
    const call = (method: string, path: string, body?: unknown, origin = vendorOrigin) =>
      fetch(`${test.baseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token.body.accessToken}`,
          origin,
          'sec-fetch-site': 'cross-site',
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    const read = await call('GET', '/issues/OPS-1');
    expect(read.status).toBe(200);
    expect(read.headers.get('access-control-allow-origin')).toBe(vendorOrigin);
    // Read only: writing is outside the approved scopes.
    expect((await call('PATCH', '/issues/OPS-1', { summary: 'Nein' })).status).toBe(403);
    const elsewhere = await call('GET', '/issues/OPS-1', undefined, 'https://evil.example');
    expect(elsewhere.headers.get('access-control-allow-origin')).toBeNull();

    const preflight = await fetch(`${test.baseUrl}/issues/OPS-1`, {
      method: 'OPTIONS',
      headers: { origin: vendorOrigin, 'access-control-request-method': 'PATCH' },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-headers')).toContain('Authorization');

    // A token cannot pass its access on to an app.
    const pat = await admin.request<CreatedToken>('POST', '/me/tokens', {
      name: 'Skript',
      scopes: ['issues:read'],
      expiresInDays: 1,
    });
    const viaToken = new TestClient(test.baseUrl, { authorization: `Bearer ${pat.body.secret}` });
    expect((await viaToken.request('POST', `/apps/${app.id}/token`)).status).toBe(403);

    // New scopes need a new approval; removing the app ends its tokens.
    manifests.set('/lenipo-app.json', manifest({ scopes: ['issues:read', 'issues:write'] }));
    expect((await admin.request('POST', `/admin/apps/${app.id}/refresh`, {})).status).toBe(409);
    const refreshed = await admin.request<InstalledApp>('POST', `/admin/apps/${app.id}/refresh`, {
      approvedScopes: ['issues:write'],
    });
    expect(refreshed.body.scopes).toEqual(['issues:read', 'issues:write']);
    expect((await admin.request('DELETE', `/admin/apps/${app.id}`)).status).toBe(204);
    expect((await call('GET', '/issues/OPS-1')).status).toBe(401);
    expect((await admin.request<AppSummary[]>('GET', '/apps')).body).toEqual([]);
  });
});

describe('scripts in automation rules (TL-50)', () => {
  it('computes values without side effects, within its limits', async () => {
    const rule = await admin.request<{ id: string }>('POST', '/automation/rules', {
      projectKey: 'OPS',
      name: 'Rechnen',
      trigger: { type: 'issue-created' },
      components: [
        {
          type: 'script',
          code: 'return { words: issue.summary.split(" ").length, upper: issue.summary.toUpperCase() };',
        },
        { type: 'comment', body: '{{script.result.words}} Wörter: {{script.result.upper}}' },
      ],
    });
    expect(rule.status).toBe(201);
    await admin.request('POST', '/issues', {
      projectKey: 'OPS',
      issueType: 'task',
      summary: 'Backup prüfen lassen',
    });
    await drain();
    const comments = (
      await admin.request<Comment[]>('GET', '/issues/OPS-2/comments?format=markdown')
    ).body;
    expect(comments.map((comment) => String(comment.body).trim())).toEqual([
      '3 Wörter: BACKUP PRÜFEN LASSEN',
    ]);

    await admin.request('PUT', `/automation/rules/${rule.body.id}`, {
      name: 'Endlos',
      projectKey: 'OPS',
      trigger: { type: 'issue-created' },
      components: [
        { type: 'script', code: 'while (true) {}' },
        { type: 'comment', body: 'nie' },
      ],
      enabled: true,
    });
    await admin.request('POST', '/issues', {
      projectKey: 'OPS',
      issueType: 'task',
      summary: 'Loop',
    });
    await drain();
    expect((await admin.request<Comment[]>('GET', '/issues/OPS-3/comments')).body).toEqual([]);
    const runs = (
      await admin.request<AutomationRun[]>('GET', `/automation/rules/${rule.body.id}/runs`)
    ).body;
    expect(JSON.stringify(runs[0])).toContain('länger als 1 s');
  });
});
