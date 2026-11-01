import type { CreatedWebhook, Issue, TrashedIssue } from '@tasklore/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { webhookDeliveries } from '../db/schema/index.js';
import { EventProcessor } from '../events/event-processor.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let member: TestClient;

beforeAll(async () => {
  test = await startTestApp({ WEBHOOK_ALLOW_PRIVATE_NETWORKS: 'true' });
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('POST', '/admin/users', {
    email: 'jonas@example.org',
    displayName: 'Jonas Schulz',
    password: 'ein-langes-passwort',
  });
  member = new TestClient(test.baseUrl);
  await member.request('POST', '/auth/login', {
    email: 'jonas@example.org',
    password: 'ein-langes-passwort',
  });
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('deleting single issues (TL-61)', () => {
  it('moves an issue with its subtasks to the trash and brings it back', async () => {
    const hook = (
      await admin.request<CreatedWebhook>('POST', '/admin/webhooks', {
        name: 'Löschungen',
        url: 'http://127.0.0.1:9/hook',
        events: ['issue.deleted'],
      })
    ).body;
    const story = (
      await admin.request<Issue>('POST', '/issues', {
        projectKey: 'WEB',
        issueType: 'story',
        summary: 'Anmeldung',
      })
    ).body;
    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'subtask',
      summary: 'Formular',
      parentKey: story.key,
    });

    // People without the permission may neither delete nor look into the trash.
    expect((await member.request('DELETE', `/issues/${story.key}`)).status).toBe(403);
    expect((await member.request('GET', '/projects/WEB/trash')).status).toBe(403);

    expect((await admin.request('DELETE', `/issues/${story.key}`)).status).toBe(204);
    expect((await admin.request('GET', `/issues/${story.key}`)).status).toBe(404);
    expect((await admin.request('GET', '/issues/WEB-2')).status).toBe(404);

    const trash = (await admin.request<TrashedIssue[]>('GET', '/projects/WEB/trash')).body;
    expect(trash).toEqual([
      expect.objectContaining({
        key: story.key,
        summary: 'Anmeldung',
        subtasks: 1,
        deletedBy: expect.objectContaining({ displayName: 'Lena Vogt' }),
      }),
    ]);

    await test.app.get(EventProcessor).drain();
    const deliveries = await test.app
      .get<DatabaseHandle>(DATABASE)
      .db.select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, hook.id));
    expect(deliveries.map((row) => row.type)).toEqual(['issue.deleted']);
    expect(JSON.stringify(deliveries[0]?.payload)).toContain('WEB-2');

    const restored = await admin.request<Issue>('POST', `/issues/${story.key}/restore`);
    expect(restored.status).toBe(200);
    expect(restored.body.children.map((child) => child.key)).toEqual(['WEB-2']);
    expect((await admin.request<TrashedIssue[]>('GET', '/projects/WEB/trash')).body).toEqual([]);
  });
});
