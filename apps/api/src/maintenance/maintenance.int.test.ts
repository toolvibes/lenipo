import type { Attachment, Backup, Issue, Page, RetentionResult } from '@tasklore/shared';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { auditLog, issues, pageVersions } from '../db/schema/index.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { docFromText } from '../tracking/rich-text.js';
import { BackupService } from './backup.service.js';

let test: TestApp;
let admin: TestClient;
let fresh: TestApp | undefined;
let backupZip: Buffer;
let pageId = '';

const db = (app: TestApp) => app.app.get<DatabaseHandle>(DATABASE).db;

async function attach(key: string, name: string, content: string): Promise<Attachment> {
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'text/plain' }), name);
  const response = await fetch(`${test.baseUrl}/issues/${key}/attachments`, {
    method: 'POST',
    headers: { cookie: admin.cookie ?? '' },
    body: form,
  });
  return (await response.json()) as Attachment;
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
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web-Relaunch', template: 'scrum' });
  await admin.request('POST', '/spaces', { key: 'DOCS', name: 'Doku' });
  pageId = (await admin.request<Page>('POST', '/spaces/DOCS/pages', { title: 'Notizen' })).body.id;
  for (const text of ['Eins', 'Zwei', 'Drei']) {
    await admin.request('POST', `/pages/${pageId}/publish`, {
      title: 'Notizen',
      content: docFromText(text),
    });
  }
}, 60_000);

afterAll(async () => {
  await fresh?.close();
  await test?.close();
});

describe('retention (TL-39)', () => {
  it('deletes the trash, old versions and audit entries past their time', async () => {
    const kept = (
      await admin.request<Issue>('POST', '/issues', {
        projectKey: 'WEB',
        issueType: 'task',
        summary: 'Bleibt',
      })
    ).body;
    await attach(kept.key, 'bleibt.txt', 'bleibt');
    const gone = (
      await admin.request<Issue>('POST', '/issues', {
        projectKey: 'WEB',
        issueType: 'task',
        summary: 'Weg damit',
      })
    ).body;
    await attach(gone.key, 'weg.txt', 'weg');
    expect((await admin.request('DELETE', `/issues/${gone.key}`)).status).toBe(204);

    const longAgo = new Date(Date.now() - 40 * 86_400_000);
    await db(test).update(issues).set({ deletedAt: longAgo }).where(eq(issues.id, gone.id));
    await db(test)
      .update(pageVersions)
      .set({ createdAt: longAgo })
      .where(eq(pageVersions.pageId, pageId));
    await db(test)
      .insert(auditLog)
      .values({ action: 'test.old', at: new Date(Date.now() - 400 * 86_400_000) });

    // Versions are kept by default.
    let result = (await admin.request<RetentionResult>('POST', '/admin/retention/run')).body;
    expect(result).toMatchObject({ issues: 1, files: 1, versions: 0, auditEntries: 1 });
    expect((await admin.request('GET', `/issues/${kept.key}`)).status).toBe(200);
    expect((await admin.request('GET', `/issues/${gone.key}`)).status).toBe(404);

    expect(
      (
        await admin.request('PUT', '/admin/retention', {
          trashDays: 30,
          versionDays: 30,
          auditDays: 365,
        })
      ).status,
    ).toBe(200);
    result = (await admin.request<RetentionResult>('POST', '/admin/retention/run')).body;
    // Three versions of one day: only the last one stays.
    expect(result.versions).toBe(2);
    const versions = await db(test)
      .select({ number: pageVersions.number })
      .from(pageVersions)
      .where(eq(pageVersions.pageId, pageId));
    expect(versions).toEqual([{ number: 3 }]);
  });
});

describe('backup and restore (TL-39)', () => {
  it('writes a backup that can be downloaded', async () => {
    const started = await admin.request<Backup>('POST', '/admin/backups');
    expect(started.status).toBe(201);
    // The started one runs in the background; this one is awaited.
    const backup = await test.app.get(BackupService).create('manual', null);
    expect(backup).toMatchObject({ state: 'done', files: 1 });
    expect(backup.rows).toBeGreaterThan(50);
    const response = await fetch(`${test.baseUrl}/admin/backups/${backup.id}/download`, {
      headers: { cookie: admin.cookie ?? '' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('tasklore-backup-');
    backupZip = Buffer.from(await response.arrayBuffer());
    expect(backupZip.subarray(0, 2).toString()).toBe('PK');
  });

  it('restores into a fresh instance from the setup screen', async () => {
    fresh = await startTestApp();
    const code = (await fresh.app.get(SetupService).issueCode()) ?? '';
    const restore = async (headers: Record<string, string>) => {
      const form = new FormData();
      form.append('file', new Blob([backupZip], { type: 'application/zip' }), 'backup.zip');
      const response = await fetch(`${fresh?.baseUrl}/setup/restore`, {
        method: 'POST',
        headers,
        body: form,
      });
      return { status: response.status, body: (await response.json()) as Record<string, number> };
    };
    expect((await restore({})).status).toBe(403);
    const restored = await restore({ 'x-setup-code': code });
    expect(restored.status).toBe(200);
    expect(restored.body).toMatchObject({ files: 1 });

    const lena = new TestClient(fresh.baseUrl);
    expect(
      (
        await lena.request('POST', '/auth/login', {
          email: 'lena@example.org',
          password: 'ein-langes-passwort',
        })
      ).status,
    ).toBe(200);
    const issue = await lena.request<Issue>('GET', '/issues/WEB-1');
    expect(issue.body.summary).toBe('Bleibt');
    const files = await lena.request<Attachment[]>('GET', '/issues/WEB-1/attachments');
    const file = files.body[0] as Attachment;
    const origin = fresh.baseUrl.replace(/\/api\/v1$/, '');
    const download = await fetch(`${origin}${file.url}`, {
      headers: { cookie: lena.cookie ?? '' },
    });
    expect(await download.text()).toBe('bleibt');
    // Ids keep counting after the restored ones.
    const next = await lena.request<Issue>('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Nach dem Restore',
    });
    expect(next.status).toBe(201);
    await lena.request('POST', `/issues/${next.body.key}/comments`, {
      body: docFromText('geht'),
    });
    const [audit] = await db(fresh).select({ n: sql<number>`count(*)::int` }).from(auditLog);
    expect(audit?.n).toBeGreaterThan(0);
    // Setup is done now.
    expect((await restore({ 'x-setup-code': code })).status).toBe(409);
  });
});
