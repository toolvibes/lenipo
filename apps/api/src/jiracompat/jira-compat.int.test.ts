import type { CreatedToken, Issue } from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let jira: TestClient;

interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: Record<string, unknown>;
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
  await admin.request('POST', '/projects', { key: 'OPS', name: 'Betrieb', template: 'kanban' });
  const token = await admin.request<CreatedToken>('POST', '/me/tokens', {
    name: 'Jira-Skript',
    scopes: ['issues:read', 'issues:write'],
    expiresInDays: 30,
  });
  // Jira clients send the address and the token as Basic credentials.
  const basic = Buffer.from(`Lena@Example.org:${token.body.secret}`).toString('base64');
  jira = new TestClient(test.baseUrl.replace(/\/api\/v1$/, '/rest/api/2'), {
    authorization: `Basic ${basic}`,
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('Jira REST API v2 compatibility (TL-48)', () => {
  it('signs in with address and token, and only with both', async () => {
    const me = await jira.request<{ emailAddress: string }>('GET', '/myself');
    expect(me.body.emailAddress).toBe('lena@example.org');
    const info = await jira.request<{ versionNumbers: number[] }>('GET', '/serverInfo');
    expect(info.body.versionNumbers[0]).toBe(9);

    const wrong = new TestClient(test.baseUrl.replace(/\/api\/v1$/, '/rest/api/2'), {
      authorization: `Basic ${Buffer.from('lena@example.org:ein-langes-passwort').toString('base64')}`,
    });
    const denied = await wrong.request<{ errorMessages: string[] }>('GET', '/myself');
    expect(denied.status).toBe(401);
    expect(denied.body.errorMessages).toHaveLength(1);
  });

  it('creates, reads, changes and finds issues in Jira shapes', async () => {
    const created = await jira.request<JiraIssue>('POST', '/issue', {
      fields: {
        project: { key: 'OPS' },
        issuetype: { name: 'Bug' },
        summary: 'Backup schlägt fehl',
        description: 'Seit Montag *rot*.',
        priority: { name: 'Hoch' },
        assignee: { emailAddress: 'lena@example.org' },
        labels: ['backup'],
      },
    });
    expect(created.status).toBe(201);
    expect(created.body.key).toBe('OPS-1');
    expect(created.body.self).toContain(`/rest/api/2/issue/${created.body.id}`);

    const read = await jira.request<JiraIssue>('GET', '/issue/OPS-1');
    expect(read.body.fields).toMatchObject({
      summary: 'Backup schlägt fehl',
      description: 'Seit Montag *rot*.',
      issuetype: { name: 'Bug' },
      priority: { name: 'Hoch' },
      assignee: { displayName: 'Lena Vogt' },
      labels: ['backup'],
      status: { statusCategory: { key: 'new' } },
    });
    expect(read.body.fields.created).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}\+0000$/);
    // By id as well, and only the requested fields.
    const byId = await jira.request<JiraIssue>('GET', `/issue/${created.body.id}?fields=summary`);
    expect(Object.keys(byId.body.fields)).toEqual(['summary']);

    const edited = await jira.request('PUT', '/issue/OPS-1', {
      fields: { summary: 'Nächtliches Backup schlägt fehl', duedate: '2026-12-01' },
      update: { labels: [{ add: 'nacht' }, { remove: 'backup' }] },
    });
    expect(edited.status).toBe(204);
    const issue = (await admin.request<Issue>('GET', '/issues/OPS-1')).body;
    expect(issue).toMatchObject({
      summary: 'Nächtliches Backup schlägt fehl',
      dueDate: '2026-12-01',
      labels: ['nacht'],
    });

    const unknown = await jira.request<{ errors: Record<string, string> }>('PUT', '/issue/OPS-1', {
      fields: { environment: 'Prod' },
    });
    expect(unknown.status).toBe(400);
    expect(Object.keys(unknown.body.errors)).toEqual(['environment']);

    await jira.request('POST', '/issue', {
      fields: {
        project: { key: 'OPS' },
        issuetype: { name: 'task' },
        summary: 'Zertifikat erneuern',
      },
    });
    const found = await jira.request<{ total: number; issues: JiraIssue[] }>(
      'GET',
      `/search?jql=${encodeURIComponent('project = OPS ORDER BY key ASC')}&maxResults=1&fields=summary,status`,
    );
    expect(found.body.total).toBe(2);
    expect(found.body.issues).toHaveLength(1);
    expect(found.body.issues[0]).toMatchObject({ key: 'OPS-1' });
    expect(Object.keys(found.body.issues[0]?.fields ?? {}).sort()).toEqual(['status', 'summary']);
    const posted = await jira.request<{ issues: JiraIssue[] }>('POST', '/search', {
      jql: 'project = OPS AND labels = nacht',
    });
    expect(posted.body.issues.map((entry) => entry.key)).toEqual(['OPS-1']);
  });

  it('moves issues along their workflow and comments on them', async () => {
    const offered = await jira.request<{
      transitions: Array<{ id: string; to: { name: string } }>;
    }>('GET', '/issue/OPS-1/transitions');
    expect(offered.body.transitions.length).toBeGreaterThan(0);
    const next = offered.body.transitions[0];
    const moved = await jira.request('POST', '/issue/OPS-1/transitions', {
      transition: { id: next?.id },
      update: { comment: [{ add: { body: 'Fange an.' } }] },
    });
    expect(moved.status).toBe(204);
    const issue = (await admin.request<Issue>('GET', '/issues/OPS-1')).body;
    expect(issue.status.name).toBe(next?.to.name);

    const added = await jira.request<{ id: string; body: string }>('POST', '/issue/OPS-1/comment', {
      body: 'Ursache gefunden.',
    });
    expect(added.status).toBe(201);
    expect(added.body.body).toBe('Ursache gefunden.');
    const comments = await jira.request<{ total: number; comments: Array<{ body: string }> }>(
      'GET',
      '/issue/OPS-1/comment',
    );
    expect(comments.body.total).toBe(2);
    expect(comments.body.comments.map((comment) => comment.body)).toEqual([
      'Fange an.',
      'Ursache gefunden.',
    ]);
    expect((await jira.request('GET', '/issue/NOPE-1')).status).toBe(404);
  });
});
