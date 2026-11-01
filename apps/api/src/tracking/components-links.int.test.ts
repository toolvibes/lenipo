import type {
  ChangeGroup,
  Comment,
  Component,
  Issue,
  Problem,
  ProjectDetails,
  SearchResult,
  UserRef,
} from '@toolvibes/shared';
import { and, eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { groups, projectRoleMembers } from '../db/schema/index.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { docFromText } from './rich-text.js';

let test: TestApp;
let admin: TestClient;
let member: TestClient;
let outsider: TestClient;
let memberId: string;
let web: ProjectDetails;

async function signIn(email: string, password: string): Promise<TestClient> {
  const client = new TestClient(test.baseUrl);
  const response = await client.request('POST', '/auth/login', { email, password });
  if (response.status !== 200) throw new Error(`Login failed for ${email}`);
  return client;
}

async function createIssue(client: TestClient, body: Record<string, unknown>): Promise<Issue> {
  const response = await client.request<Issue>('POST', '/issues', body);
  if (response.status !== 201) throw new Error(JSON.stringify(response.body));
  return response.body;
}

async function keys(query: string, client: TestClient = admin): Promise<string[]> {
  const response = await client.request<SearchResult>('POST', '/search', { query });
  if (response.status !== 200) throw new Error(`${query}: ${JSON.stringify(response.body)}`);
  return response.body.issues.map((issue) => issue.key);
}

async function history(key: string): Promise<Array<[string, string | null, string | null]>> {
  const response = await admin.request<ChangeGroup[]>('GET', `/issues/${key}/history`);
  return response.body.flatMap((group) =>
    group.items.map(
      (item) => [item.field, item.from, item.to] as [string, string | null, string | null],
    ),
  );
}

/** Gives the member the developer role in a project (there is no role API yet). */
async function makeDeveloper(projectId: string): Promise<void> {
  await test.database.db
    .insert(projectRoleMembers)
    .values({ id: uuidv7(), projectId, role: 'developers', userId: memberId });
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
  await admin.request('DELETE', `/admin/groups/users/members/${outsiderUser.body.id}`);
  member = await signIn('jonas@example.org', 'ein-langes-passwort');
  outsider = await signIn('gast@example.org', 'ein-langes-passwort');

  web = (
    await admin.request<ProjectDetails>('POST', '/projects', {
      key: 'WEB',
      name: 'Web-Relaunch',
      template: 'scrum',
    })
  ).body;
  // A project the member cannot see: without the default role of the "users" group.
  const sec = await admin.request<ProjectDetails>('POST', '/projects', {
    key: 'SEC',
    name: 'Sicherheit',
    template: 'basic',
  });
  const [usersGroup] = await test.database.db.select().from(groups).where(eq(groups.name, 'users'));
  await test.database.db
    .delete(projectRoleMembers)
    .where(
      and(
        eq(projectRoleMembers.projectId, sec.body.id),
        eq(projectRoleMembers.groupId, usersGroup?.id ?? ''),
      ),
    );
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('project people', () => {
  it('finds people who can work in the project, without the global directory', async () => {
    const found = await member.request<UserRef[]>('GET', '/projects/WEB/users?query=jon');
    expect(found.body).toEqual([{ id: memberId, displayName: 'Jonas Schulz' }]);
    // A name starting with the query comes before one that merely contains it.
    const ranked = await member.request<UserRef[]>('GET', '/projects/WEB/users?query=l');
    expect(ranked.body.map((user) => user.displayName)).toEqual(['Lena Vogt', 'Jonas Schulz']);
    // Global administrators count as project members.
    const all = await member.request<UserRef[]>('GET', '/projects/WEB/users');
    expect(all.body.map((user) => user.displayName)).toEqual(['Jonas Schulz', 'Lena Vogt']);
    expect((await outsider.request('GET', '/projects/WEB/users')).status).toBe(404);
    const sec = await admin.request<UserRef[]>('GET', '/projects/SEC/users');
    expect(sec.body.map((user) => user.displayName)).toEqual(['Lena Vogt']);
  });
});

describe('components', () => {
  it('lets project administrators manage components', async () => {
    const backend = await admin.request<Component>('POST', '/projects/WEB/components', {
      name: 'Backend',
      defaultAssigneeId: memberId,
    });
    expect(backend.status).toBe(201);
    expect(backend.body).toMatchObject({
      name: 'Backend',
      lead: null,
      defaultAssignee: { displayName: 'Jonas Schulz' },
      issueCount: 0,
    });
    const api = await admin.request<Component>('POST', '/projects/WEB/components', {
      name: 'API',
      description: 'Öffentliche Schnittstelle',
    });
    expect(api.status).toBe(201);
    const duplicate = await admin.request('POST', '/projects/WEB/components', { name: 'backend' });
    expect(duplicate.status).toBe(409);
    expect((await member.request('POST', '/projects/WEB/components', { name: 'UI' })).status).toBe(
      403,
    );
    // Only people of the project can lead a component.
    const lead = await admin.request('POST', '/projects/SEC/components', {
      name: 'Audit',
      leadId: memberId,
    });
    expect(lead.status).toBe(400);
  });

  it('assigns new issues to the default assignee of their first component', async () => {
    const issue = await createIssue(admin, {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Login-Endpunkt',
      components: ['backend', 'API'],
    });
    expect(issue.key).toBe('WEB-1');
    expect(issue.components.map((component) => component.name)).toEqual(['API', 'Backend']);
    // API (first by name) has no default assignee, Backend does.
    expect(issue.assignee?.displayName).toBe('Jonas Schulz');

    // An explicit assignee wins over the component's default.
    const me = await admin.request<{ id: string }>('GET', '/me');
    const explicit = await createIssue(admin, {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Dokumentation',
      components: ['Backend'],
      assigneeId: me.body.id,
    });
    expect(explicit.key).toBe('WEB-2');
    expect(explicit.assignee?.displayName).toBe('Lena Vogt');

    const unknown = await admin.request<Problem>('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'x',
      components: ['Frontend'],
    });
    expect(unknown.status).toBe(400);
  });

  it('changes components with history and finds them with TQL', async () => {
    const updated = await admin.request<Issue>('PATCH', '/issues/WEB-2', { components: ['API'] });
    expect(updated.body.components.map((component) => component.name)).toEqual(['API']);
    expect(await history('WEB-2')).toContainEqual(['components', 'Backend', 'API']);

    await createIssue(admin, { projectKey: 'WEB', issueType: 'task', summary: 'Ohne Komponente' });
    expect(await keys('component = Backend')).toEqual(['WEB-1']);
    expect(await keys('component in (api) ORDER BY key')).toEqual(['WEB-1', 'WEB-2']);
    expect(await keys('component != Backend')).toEqual(['WEB-2']);
    expect(await keys('project = WEB AND component is EMPTY')).toEqual(['WEB-3']);
  });

  it('counts issues and removes deleted components from them', async () => {
    const list = await member.request<Component[]>('GET', '/projects/WEB/components');
    expect(list.body.map((component) => [component.name, component.issueCount])).toEqual([
      ['API', 2],
      ['Backend', 1],
    ]);
    const backend = list.body.find((component) => component.name === 'Backend');
    const removed = await admin.request('DELETE', `/projects/WEB/components/${backend?.id}`);
    expect(removed.status).toBe(204);
    const issue = await admin.request<Issue>('GET', '/issues/WEB-1');
    expect(issue.body.components.map((component) => component.name)).toEqual(['API']);
  });
});

describe('issue links', () => {
  it('links issues and shows the link from both sides', async () => {
    const linked = await admin.request<Issue>('POST', '/issues/WEB-1/links', {
      type: 'blocks',
      issueKey: 'web-2',
    });
    expect(linked.status).toBe(201);
    expect(linked.body.links).toMatchObject([
      {
        direction: 'outward',
        type: { key: 'blocks', outward: 'blockiert' },
        issue: { key: 'WEB-2' },
      },
    ]);
    const other = await admin.request<Issue>('GET', '/issues/WEB-2');
    expect(other.body.links).toMatchObject([
      { direction: 'inward', type: { inward: 'wird blockiert von' }, issue: { key: 'WEB-1' } },
    ]);
    expect(await history('WEB-1')).toContainEqual(['link', null, 'blockiert WEB-2']);
    expect(await history('WEB-2')).toContainEqual(['link', null, 'wird blockiert von WEB-1']);

    const inward = await admin.request<Issue>('POST', '/issues/WEB-3/links', {
      type: 'Duplikat',
      direction: 'inward',
      issueKey: 'WEB-1',
    });
    expect(inward.body.links[0]).toMatchObject({ direction: 'inward', issue: { key: 'WEB-1' } });
  });

  it('rejects duplicate, self and unknown links', async () => {
    const again = await admin.request('POST', '/issues/WEB-1/links', {
      type: 'blocks',
      issueKey: 'WEB-2',
    });
    expect(again.status).toBe(409);
    const self = await admin.request('POST', '/issues/WEB-1/links', {
      type: 'blocks',
      issueKey: 'WEB-1',
    });
    expect(self.status).toBe(400);
    const type = await admin.request('POST', '/issues/WEB-1/links', {
      type: 'causes',
      issueKey: 'WEB-2',
    });
    expect(type.status).toBe(400);
    const missing = await admin.request('POST', '/issues/WEB-1/links', {
      type: 'blocks',
      issueKey: 'WEB-99',
    });
    expect(missing.status).toBe(404);
  });

  it('requires edit-issues and hides links to issues one cannot see', async () => {
    await createIssue(admin, { projectKey: 'SEC', issueType: 'task', summary: 'Geheimer Vorgang' });
    await admin.request('POST', '/issues/WEB-1/links', { type: 'relates', issueKey: 'SEC-1' });
    const asAdmin = await admin.request<Issue>('GET', '/issues/WEB-1');
    expect(asAdmin.body.links.map((link) => link.issue.key)).toContain('SEC-1');
    const asMember = await member.request<Issue>('GET', '/issues/WEB-1');
    expect(asMember.body.links.map((link) => link.issue.key)).not.toContain('SEC-1');

    expect(
      (await member.request('POST', '/issues/WEB-2/links', { type: 'relates', issueKey: 'WEB-3' }))
        .status,
    ).toBe(403);
    await makeDeveloper(web.id);
    expect(
      (await member.request('POST', '/issues/WEB-2/links', { type: 'relates', issueKey: 'WEB-3' }))
        .status,
    ).toBe(201);
    // The hidden issue looks like it does not exist.
    expect(
      (await member.request('POST', '/issues/WEB-2/links', { type: 'relates', issueKey: 'SEC-1' }))
        .status,
    ).toBe(404);
  });

  it('finds linked issues with TQL', async () => {
    expect(await keys('issueLinkType = blockiert')).toEqual(['WEB-1']);
    expect(await keys('issueLinkType = blocks ORDER BY key')).toEqual(['WEB-1', 'WEB-2']);
    expect(await keys('key in linkedIssues(WEB-1) ORDER BY key')).toEqual([
      'SEC-1',
      'WEB-2',
      'WEB-3',
    ]);
    expect(await keys('key in linkedIssues(WEB-1, blockiert)')).toEqual(['WEB-2']);
    expect(await keys('key in linkedIssues(WEB-2, "wird blockiert von")')).toEqual(['WEB-1']);
    // Links to hidden issues are not visible through TQL either.
    expect(await keys('issueLinkType = relates ORDER BY key', member)).toEqual(['WEB-2', 'WEB-3']);
    const hidden = await member.request<Problem>('POST', '/search', {
      query: 'key in linkedIssues(SEC-1)',
    });
    expect(hidden.body.queryErrors?.[0]).toMatchObject({ code: 'value-not-found' });
  });

  it('removes links', async () => {
    const issue = await admin.request<Issue>('GET', '/issues/WEB-2');
    const link = issue.body.links.find((entry) => entry.issue.key === 'WEB-1');
    expect((await admin.request('DELETE', `/issues/WEB-2/links/${link?.id}`)).status).toBe(204);
    expect(await keys('key in linkedIssues(WEB-2)')).toEqual(['WEB-3']);
    expect(await history('WEB-1')).toContainEqual(['link', 'blockiert WEB-2', null]);
    expect((await admin.request('DELETE', `/issues/WEB-2/links/${link?.id}`)).status).toBe(404);
  });
});

describe('comments', () => {
  let own: Comment;

  it('lets authors edit their comments and marks them as edited', async () => {
    const created = await member.request<Comment>('POST', '/issues/WEB-1/comments', {
      body: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Frage an ' },
              { type: 'mention', attrs: { id: 'x', label: 'Lena Vogt' } },
            ],
          },
        ],
      },
    });
    own = created.body;
    expect(own).toMatchObject({ edited: false, canEdit: true, canDelete: true });
    // Mentions are searchable by name.
    expect(await keys('comment ~ Vogt')).toEqual(['WEB-1']);

    const edited = await member.request<Comment>('PATCH', `/issues/WEB-1/comments/${own.id}`, {
      body: docFromText('Geklärt'),
    });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ edited: true, body: docFromText('Geklärt') });
  });

  it('allows others neither to edit nor to delete, except project administrators deleting', async () => {
    const asAdmin = await admin.request<Comment[]>('GET', '/issues/WEB-1/comments');
    expect(asAdmin.body[0]).toMatchObject({ canEdit: false, canDelete: true });
    expect(
      (await admin.request('PATCH', `/issues/WEB-1/comments/${own.id}`, { body: docFromText('x') }))
        .status,
    ).toBe(403);

    const adminComment = await admin.request<Comment>('POST', '/issues/WEB-1/comments', {
      body: docFromText('Vom Admin'),
    });
    expect(
      (await member.request('DELETE', `/issues/WEB-1/comments/${adminComment.body.id}`)).status,
    ).toBe(403);
    expect((await admin.request('DELETE', `/issues/WEB-1/comments/${own.id}`)).status).toBe(204);
    const left = await member.request<Comment[]>('GET', '/issues/WEB-1/comments');
    expect(left.body.map((comment) => comment.id)).toEqual([adminComment.body.id]);
    expect((await member.request('DELETE', `/issues/WEB-1/comments/${own.id}`)).status).toBe(404);
  });
});
