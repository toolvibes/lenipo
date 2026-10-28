import type {
  ChangeGroup,
  Comment,
  Issue,
  IssueList,
  Me,
  Problem,
  ProjectDetails,
  ProjectSummary,
  Transition,
  UserLookup,
} from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { docFromText } from './rich-text.js';

let test: TestApp;
let admin: TestClient;
let member: TestClient;
let outsider: TestClient;
let memberId: string;

async function signIn(email: string, password: string): Promise<TestClient> {
  const client = new TestClient(test.baseUrl);
  const response = await client.request('POST', '/auth/login', { email, password });
  if (response.status !== 200) throw new Error(`Login failed for ${email}`);
  return client;
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
  const created = await admin.request<{ id: string }>('POST', '/admin/users', {
    email: 'jonas@example.org',
    displayName: 'Jonas Schulz',
    password: 'ein-langes-passwort',
  });
  memberId = created.body.id;
  await admin.request('POST', '/admin/groups', { name: 'externe', description: '' });
  const outsiderUser = await admin.request<{ id: string }>('POST', '/admin/users', {
    email: 'gast@example.org',
    displayName: 'Gast',
    password: 'ein-langes-passwort',
    groups: ['externe'],
  });
  // An outsider who is not in the default "users" group sees no projects.
  await admin.request('DELETE', `/admin/groups/users/members/${outsiderUser.body.id}`);
  member = await signIn('jonas@example.org', 'ein-langes-passwort');
  outsider = await signIn('gast@example.org', 'ein-langes-passwort');
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('projects', () => {
  it('creates a project from a template', async () => {
    const response = await admin.request<ProjectDetails>('POST', '/projects', {
      key: 'WEB',
      name: 'Web-Relaunch',
      template: 'scrum',
    });
    expect(response.status).toBe(201);
    expect(response.body.statuses.map((status) => status.key)).toEqual([
      'open',
      'in-progress',
      'review',
      'done',
    ]);
    expect(response.body.issueTypes.map((type) => type.key)).toEqual([
      'epic',
      'story',
      'task',
      'bug',
      'subtask',
    ]);
    expect(response.body.permissions).toContain('administer');
  });

  it('applies template restrictions on issue types', async () => {
    const response = await admin.request<ProjectDetails>('POST', '/projects', {
      key: 'OPS',
      name: 'Betrieb',
      template: 'basic',
    });
    expect(response.body.issueTypes.map((type) => type.key)).toEqual(['task', 'subtask']);
  });

  it('rejects duplicate keys and invalid keys', async () => {
    expect(
      (await admin.request('POST', '/projects', { key: 'WEB', name: 'Doppelt', template: 'scrum' }))
        .status,
    ).toBe(409);
    const invalid = await admin.request<Problem>('POST', '/projects', {
      key: 'web-1',
      name: 'X',
      template: 'scrum',
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.errors?.key).toBeDefined();
  });

  it('requires the create-projects permission', async () => {
    expect(
      (await member.request('POST', '/projects', { key: 'NOPE', name: 'Nein', template: 'scrum' }))
        .status,
    ).toBe(403);
  });

  it('shows projects to members of the users group but hides them from others', async () => {
    const memberView = await member.request<ProjectSummary[]>('GET', '/projects');
    expect(memberView.body.map((project) => project.key)).toEqual(['OPS', 'WEB']);
    const outsiderView = await outsider.request<ProjectSummary[]>('GET', '/projects');
    expect(outsiderView.body).toEqual([]);
    expect((await outsider.request('GET', '/projects/WEB')).status).toBe(404);
  });
});

describe('issues', () => {
  let epic: Issue;
  let story: Issue;

  it('creates issues with sequential keys, default priority and initial status', async () => {
    const created = await admin.request<Issue>('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'epic',
      summary: 'Anmeldung',
    });
    expect(created.status).toBe(201);
    epic = created.body;
    expect(epic.key).toBe('WEB-1');
    expect(epic.status.key).toBe('open');
    expect(epic.priority.key).toBe('medium');
    expect(epic.watching).toBe(true);

    const second = await member.request<Issue>('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'story',
      summary: 'Login über Keycloak',
      description: docFromText('Nach Token-Ablauf leere Seite.'),
      parentKey: 'WEB-1',
      labels: ['oidc', 'oidc', 'regression'],
      storyPoints: 3,
    });
    expect(second.status).toBe(201);
    story = second.body;
    expect(story.key).toBe('WEB-2');
    expect(story.parent?.key).toBe('WEB-1');
    expect(story.labels).toEqual(['oidc', 'regression']);
    expect(story.rank > epic.rank).toBe(true);
    expect(story.reporter?.displayName).toBe('Jonas Schulz');
  });

  it('enforces the issue hierarchy and template types', async () => {
    const subtaskWithoutParent = await admin.request<Problem>('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'subtask',
      summary: 'X',
    });
    expect(subtaskWithoutParent.status).toBe(400);
    const storyUnderStory = await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'story',
      summary: 'X',
      parentKey: 'WEB-2',
    });
    expect(storyUnderStory.status).toBe(400);
    const hiddenType = await admin.request('POST', '/issues', {
      projectKey: 'OPS',
      issueType: 'bug',
      summary: 'X',
    });
    expect(hiddenType.status).toBe(400);
    const subtask = await admin.request<Issue>('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'subtask',
      summary: 'Refresh-Token prüfen',
      parentKey: 'WEB-2',
    });
    expect(subtask.status).toBe(201);
    const parent = await admin.request<Issue>('GET', '/issues/web-2');
    expect(parent.body.children.map((child) => child.key)).toEqual([subtask.body.key]);
  });

  it('needs the assign permission to change the assignee', async () => {
    // Members of the "users" role may create and comment, but not assign, not even themselves.
    expect(
      (await member.request('PATCH', `/issues/${story.key}`, { assigneeId: memberId })).status,
    ).toBe(403);
    const assigned = await admin.request<Issue>('PATCH', `/issues/${story.key}`, {
      assigneeId: memberId,
    });
    expect(assigned.body.assignee?.displayName).toBe('Jonas Schulz');
    const me = await admin.request<Me>('GET', '/me');
    expect(
      (await admin.request('PATCH', `/issues/${story.key}`, { assigneeId: me.body.id })).status,
    ).toBe(200);
    expect(
      (await admin.request('PATCH', `/issues/${story.key}`, { assigneeId: memberId })).status,
    ).toBe(200);
  });

  it('only lets members edit fields with the edit permission', async () => {
    // Members of the "users" role may create and comment, but not edit.
    expect((await member.request('PATCH', `/issues/${story.key}`, { summary: 'Neu' })).status).toBe(
      403,
    );
    const updated = await admin.request<Issue>('PATCH', `/issues/${story.key}`, {
      summary: 'Login über Keycloak schlägt fehl',
      priority: 'highest',
      labels: ['oidc'],
      storyPoints: 5,
      dueDate: '2026-11-14',
    });
    expect(updated.status).toBe(200);
    expect(updated.body.priority.key).toBe('highest');
    expect(updated.body.dueDate).toBe('2026-11-14');
  });

  it('records every field change in the history', async () => {
    const history = await admin.request<ChangeGroup[]>('GET', `/issues/${story.key}/history`);
    const fields = history.body.flatMap((group) => group.items.map((item) => item.field));
    expect(fields).toEqual(
      expect.arrayContaining([
        'assignee',
        'summary',
        'priority',
        'labels',
        'storyPoints',
        'dueDate',
      ]),
    );
    const summary = history.body
      .flatMap((group) => group.items)
      .find((item) => item.field === 'summary');
    expect(summary).toEqual({
      field: 'summary',
      from: 'Login über Keycloak',
      to: 'Login über Keycloak schlägt fehl',
    });
    expect(history.body[0]?.author?.displayName).toBe('Lena Vogt');
  });

  it('moves issues through the workflow and sets the resolution when done', async () => {
    const transitions = await admin.request<Transition[]>(
      'GET',
      `/issues/${story.key}/transitions`,
    );
    expect(transitions.body.map((transition) => transition.to.key)).toEqual([
      'in-progress',
      'review',
      'done',
    ]);
    const done = await admin.request<Issue>('POST', `/issues/${story.key}/transitions`, {
      transitionId: 'to-done',
    });
    expect(done.body.status.key).toBe('done');
    expect(done.body.resolution?.key).toBe('done');
    expect(done.body.resolvedAt).not.toBeNull();
    const reopened = await admin.request<Issue>('POST', `/issues/${story.key}/transitions`, {
      transitionId: 'to-open',
    });
    expect(reopened.body.resolution).toBeNull();
    expect(
      (await admin.request('POST', `/issues/${story.key}/transitions`, { transitionId: 'to-open' }))
        .status,
    ).toBe(400);
    expect(
      (
        await member.request('POST', `/issues/${story.key}/transitions`, {
          transitionId: 'to-done',
        })
      ).status,
    ).toBe(403);
  });

  it('accepts comments from members and makes commenters watchers', async () => {
    const comment = await member.request<Comment>('POST', `/issues/${epic.key}/comments`, {
      body: docFromText('Gilt das auch für Tokens?'),
    });
    expect(comment.status).toBe(201);
    expect(
      (
        await member.request('POST', `/issues/${epic.key}/comments`, {
          body: { type: 'doc', content: [] },
        })
      ).status,
    ).toBe(400);
    const list = await admin.request<Comment[]>('GET', `/issues/${epic.key}/comments`);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]?.author?.displayName).toBe('Jonas Schulz');
    expect((await member.request<Issue>('GET', `/issues/${epic.key}`)).body.watching).toBe(true);
  });

  it('filters the issue list', async () => {
    const all = await admin.request<IssueList>('GET', '/projects/WEB/issues');
    expect(all.body.total).toBe(3);
    expect(all.body.issues.map((issue) => issue.key)).toEqual(['WEB-1', 'WEB-2', 'WEB-3']);
    const mine = await member.request<IssueList>('GET', '/projects/WEB/issues?assignee=me');
    expect(mine.body.issues.map((issue) => issue.key)).toEqual(['WEB-2']);
    const search = await admin.request<IssueList>('GET', '/projects/WEB/issues?q=keycloak');
    expect(search.body.issues.map((issue) => issue.key)).toEqual(['WEB-2']);
    const epics = await admin.request<IssueList>('GET', '/projects/WEB/issues?type=epic&limit=1');
    expect(epics.body.total).toBe(1);
    expect((await admin.request('GET', '/projects/WEB/issues?limit=500')).status).toBe(400);
  });

  it('hides issues from people outside the project', async () => {
    expect((await outsider.request('GET', `/issues/${story.key}`)).status).toBe(404);
    expect((await outsider.request('GET', '/issues/WEB-999')).status).toBe(404);
  });

  it('supports token access with issue scopes', async () => {
    const read = await member.request<{ secret: string }>('POST', '/me/tokens', {
      name: 'lesen',
      scopes: ['issues:read'],
      expiresInDays: 1,
    });
    const client = new TestClient(test.baseUrl, { authorization: `Bearer ${read.body.secret}` });
    expect((await client.request('GET', `/issues/${story.key}`)).status).toBe(200);
    expect(
      (await client.request('POST', `/issues/${epic.key}/comments`, { body: docFromText('x') }))
        .status,
    ).toBe(403);
    expect(
      (await client.request<UserLookup[]>('GET', '/users?query=lena')).body.map(
        (user) => user.displayName,
      ),
    ).toEqual(['Lena Vogt']);
  });
});
