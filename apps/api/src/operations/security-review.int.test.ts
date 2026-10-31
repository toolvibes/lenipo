import type { CreatedToken, ImportJob } from '@tasklore/shared';
import { strToU8, zipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AutomationEngine } from '../automation/automation.engine.js';
import { EventProcessor } from '../events/event-processor.js';
import { SetupService } from '../identity/setup.service.js';
import { ImportService } from '../imports/import.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

/** Regression tests for the findings of the security review (TL-44, E-125). */
let test: TestApp;
let admin: TestClient;

async function comments(key: string): Promise<string[]> {
  const answer = await admin.request<
    { comments?: Array<{ bodyText?: string }> } | Array<{ bodyText?: string }>
  >('GET', `/issues/${key}/comments`);
  const list = Array.isArray(answer.body) ? answer.body : (answer.body.comments ?? []);
  return list.map((comment) => comment.bodyText ?? '');
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
  await admin.request('POST', '/projects', { key: 'HR', name: 'Personal', template: 'kanban' });
  await admin.request('POST', '/issues', { projectKey: 'WEB', issueType: 'task', summary: 'Web' });
  await admin.request('POST', '/issues', {
    projectKey: 'HR',
    issueType: 'task',
    summary: 'Gehalt',
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('security review fixes (TL-44)', () => {
  it('survives a realtime request with an unparseable origin', async () => {
    const origin = test.baseUrl.replace(/\/api\/v1$/, '');
    const response = await fetch(`${origin}/api/v1/realtime/?EIO=4&transport=polling`, {
      headers: { origin: 'null' },
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect((await admin.request('GET', '/health/live')).status).toBe(200);
  });

  it('keeps a project rule inside its project, whatever its query says', async () => {
    const rule = (
      await admin.request<{ id: string; webhookUrl: string }>('POST', '/automation/rules', {
        name: 'Ausbruch',
        projectKey: 'WEB',
        trigger: { type: 'incoming-webhook' },
        components: [
          {
            type: 'branch',
            over: 'query',
            query: 'key = WEB-1) OR (project = HR',
            components: [{ type: 'comment', body: 'Erreicht' }],
          },
        ],
      })
    ).body;
    const token = new URL(rule.webhookUrl, 'http://x').searchParams.get('token');
    await fetch(`${test.baseUrl}/automation/hooks/${rule.id}?token=${token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    await test.app.get(EventProcessor).drain();
    await test.app.get(AutomationEngine).runDue();
    expect(await comments('HR-1')).toEqual([]);
  });

  it('demands the admin scope from tokens for administration in services', async () => {
    const token = (
      await admin.request<CreatedToken>('POST', '/me/tokens', {
        name: 'Nur lesen',
        scopes: ['issues:read', 'issues:write'],
        expiresInDays: 1,
      })
    ).body.secret;
    const bot = new TestClient(test.baseUrl, { authorization: `Bearer ${token}` });
    const global = await bot.request('POST', '/automation/rules', {
      name: 'Global',
      trigger: { type: 'issue-created' },
      components: [{ type: 'comment', body: 'x' }],
    });
    expect(global.status).toBe(403);
  });

  it('never builds a file path from an archive id', async () => {
    const archive = {
      format: 'tasklore-archive',
      formatVersion: 1,
      kind: 'project',
      exportedAt: new Date().toISOString(),
      apiVersion: 'test',
      lookups: {
        users: [],
        issueTypes: [],
        statuses: [],
        priorities: [],
        resolutions: [],
        linkTypes: [],
        customFields: [],
      },
      root: {
        id: '01a00000-0000-7000-8000-000000000001',
        key: 'EVIL',
        name: 'Böse',
        template: 'kanban',
      },
      tables: {
        issues: [
          {
            id: '01a00000-0000-7000-8000-000000000002',
            number: 1,
            summary: 'Mit Anhang',
            rank: 'a',
            issue_type_id: null,
            status_id: null,
            priority_id: null,
          },
        ],
        issue_attachments: [
          {
            id: '../../../../etc/passwd',
            issue_id: '01a00000-0000-7000-8000-000000000002',
            file_name: 'passwd',
            content_type: 'text/plain',
            size: 1,
            sha256: 'x',
            image: false,
          },
        ],
      },
    };
    const form = new FormData();
    form.append(
      'file',
      new Blob([zipSync({ 'archive.json': strToU8(JSON.stringify(archive)) })], {
        type: 'application/zip',
      }),
      'evil.zip',
    );
    const uploaded = (await (
      await fetch(`${test.baseUrl}/admin/imports/archive?dryRun=false`, {
        method: 'POST',
        headers: { cookie: admin.cookie ?? '' },
        body: form,
      })
    ).json()) as ImportJob;
    await test.app.get(ImportService).runPending();
    const job = (await admin.request<ImportJob>('GET', `/admin/imports/${uploaded.id}`)).body;
    expect(job.state).toBe('done');
    expect(job.report?.skipped.join(' ')).toContain('ungültiger ID');
    const files = await admin.request<unknown[]>('GET', '/issues/EVIL-1/attachments');
    expect(files.body).toEqual([]);
  });

  it('sends security headers', async () => {
    const response = await admin.request('GET', '/health/live');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });
});
