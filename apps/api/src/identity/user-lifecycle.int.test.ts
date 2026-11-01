import type { Issue, RichText, UserSummary } from '@toolvibes/shared';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { auditLog, issueComments, issues } from '../db/schema/index.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { SetupService } from './setup.service.js';
import { relabelMentions } from './user-lifecycle.service.js';

let test: TestApp;
let admin: TestClient;
let adminId = '';
const ids: Record<string, string> = {};

const mention = (text: string, userId: string, label: string): RichText => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: `${text} ` },
        { type: 'mention', attrs: { id: userId, label } },
      ],
    },
  ],
});

async function signIn(email: string) {
  const client = new TestClient(test.baseUrl);
  const response = await client.request('POST', '/auth/login', {
    email,
    password: 'ein-langes-passwort',
  });
  return { client, status: response.status };
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
  adminId = (await admin.request<{ id: string }>('GET', '/me')).body.id;
  for (const [key, email, name] of [
    ['jonas', 'jonas@example.org', 'Jonas Schulz'],
    ['mira', 'mira@example.org', 'Mira Kaya'],
  ] as const) {
    ids[key] = (
      await admin.request<{ id: string }>('POST', '/admin/users', {
        email,
        displayName: name,
        password: 'ein-langes-passwort',
      })
    ).body.id;
  }
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web-Relaunch', template: 'scrum' });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('relabelMentions', () => {
  it('changes only mentions of the person', () => {
    const doc = mention('Hallo', 'a', 'Alt');
    expect(relabelMentions(doc, 'b', 'Neu')).toBeNull();
    expect(JSON.stringify(relabelMentions(doc, 'a', 'Neu'))).toContain('"label":"Neu"');
  });
});

describe('deactivating people (TL-39)', () => {
  it('ends their sessions, blocks sign-in and lets them back in after reactivation', async () => {
    const jonas = await signIn('jonas@example.org');
    expect((await jonas.client.request('GET', '/me')).status).toBe(200);
    expect((await admin.request('POST', `/admin/users/${ids.jonas}/deactivate`, {})).status).toBe(
      204,
    );
    expect((await jonas.client.request('GET', '/me')).status).toBe(401);
    expect((await signIn('jonas@example.org')).status).toBe(401);
    expect((await admin.request('POST', `/admin/users/${adminId}/deactivate`, {})).status).toBe(
      400,
    );
    expect((await admin.request('POST', `/admin/users/${ids.jonas}/reactivate`, {})).status).toBe(
      204,
    );
    expect((await signIn('jonas@example.org')).status).toBe(200);
  });
});

describe('anonymising people (GDPR, TL-39)', () => {
  it('replaces name and e-mail everywhere and keeps the contributions', async () => {
    const mira = await signIn('mira@example.org');
    const issue = (
      await admin.request<Issue>('POST', '/issues', {
        projectKey: 'WEB',
        issueType: 'task',
        summary: 'Login schlägt fehl',
        description: mention('Bitte prüfen,', ids.mira as string, 'Mira Kaya'),
      })
    ).body;
    await admin.request('PATCH', `/issues/${issue.key}`, { assigneeId: ids.mira });
    await mira.client.request('POST', `/issues/${issue.key}/comments`, {
      body: mention('Erledigt, danke', adminId, 'Lena Vogt'),
    });
    await admin.request('POST', `/issues/${issue.key}/comments`, {
      body: mention('Danke', ids.mira as string, 'Mira Kaya'),
    });

    expect(
      (
        await admin.request('POST', `/admin/users/${ids.mira}/anonymize`, {
          confirmation: 'Mira',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await admin.request('POST', `/admin/users/${ids.mira}/anonymize`, {
          confirmation: 'Mira Kaya',
        })
      ).status,
    ).toBe(204);

    const people = (await admin.request<UserSummary[]>('GET', '/admin/users')).body;
    expect(people.find((person) => person.id === ids.mira)).toMatchObject({
      displayName: 'Ehemalige Person 1',
      email: 'former-1@anonymized.invalid',
      status: 'deactivated',
      groups: [],
    });
    expect((await mira.client.request('GET', '/me')).status).toBe(401);

    const db = test.app.get<DatabaseHandle>(DATABASE).db;
    const [row] = await db.select().from(issues).where(eq(issues.id, issue.id));
    expect(row?.descriptionText).toBe('Bitte prüfen, @Ehemalige Person 1');
    expect(row?.assigneeId).toBe(ids.mira);
    const comments = await db
      .select({ authorId: issueComments.authorId, text: issueComments.bodyText })
      .from(issueComments)
      .where(eq(issueComments.issueId, issue.id));
    expect(comments).toContainEqual({ authorId: ids.mira, text: 'Erledigt, danke @Lena Vogt' });
    expect(comments).toContainEqual({ authorId: adminId, text: 'Danke @Ehemalige Person 1' });

    const history = await admin.request('GET', `/issues/${issue.key}/history`);
    expect(JSON.stringify(history.body)).toContain('Ehemalige Person 1');
    expect(JSON.stringify(history.body)).not.toContain('Mira');
    const audit = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(sql`${auditLog.details}::text like '%mira@example.org%'`);
    expect(audit[0]?.n).toBe(0);
    // Checked last: a failed sign-in with the old address is logged as typed.
    expect((await signIn('mira@example.org')).status).toBe(401);

    expect((await admin.request('POST', `/admin/users/${ids.mira}/reactivate`, {})).status).toBe(
      400,
    );
    expect(
      (
        await admin.request('POST', `/admin/users/${ids.mira}/anonymize`, {
          confirmation: 'Ehemalige Person 1',
        })
      ).status,
    ).toBe(400);
  });
});
