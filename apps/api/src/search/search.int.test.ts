import type {
  CreatedToken,
  Issue,
  Problem,
  SavedFilter,
  SearchResult,
  ValueSuggestion,
} from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { docFromText } from '../tracking/rich-text.js';

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

async function createIssue(client: TestClient, body: Record<string, unknown>): Promise<Issue> {
  const response = await client.request<Issue>('POST', '/issues', body);
  if (response.status !== 201)
    throw new Error(`Could not create issue: ${JSON.stringify(response.body)}`);
  return response.body;
}

/** Keys of the issues a query finds, in result order. */
async function keys(query: string, client: TestClient = admin): Promise<string[]> {
  const response = await client.request<SearchResult>('POST', '/search', { query });
  if (response.status !== 200) {
    throw new Error(`${query}: ${JSON.stringify(response.body)}`);
  }
  return response.body.issues.map((issue) => issue.key);
}

async function problem(query: string, client: TestClient = admin): Promise<Problem> {
  const response = await client.request<Problem>('POST', '/search', { query });
  expect(response.status).toBe(400);
  return response.body;
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
  // Without the default "users" group: no projects, no sharing.
  await admin.request('DELETE', `/admin/groups/users/members/${outsiderUser.body.id}`);
  member = await signIn('jonas@example.org', 'ein-langes-passwort');
  outsider = await signIn('gast@example.org', 'ein-langes-passwort');

  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web-Relaunch', template: 'scrum' });
  await admin.request('POST', '/projects', { key: 'OPS', name: 'Betrieb', template: 'basic' });
  await createIssue(admin, {
    projectKey: 'WEB',
    issueType: 'epic',
    summary: 'Anmeldung überarbeiten',
    description: docFromText('Die Sitzungen laufen zu früh ab.'),
    labels: ['auth'],
    storyPoints: 8,
    assigneeId: memberId,
  });
  await createIssue(member, {
    projectKey: 'WEB',
    issueType: 'story',
    summary: 'Login über Keycloak',
    description: docFromText('Sessions expire too early.'),
    labels: ['auth', 'sso'],
    storyPoints: 3,
    parentKey: 'WEB-1',
    dueDate: '2026-11-15',
  });
  await createIssue(admin, {
    projectKey: 'WEB',
    issueType: 'bug',
    summary: 'Fehler beim Speichern der Einstellungen',
    priority: 'high',
  });
  await admin.request('POST', '/issues/WEB-3/transitions', { transitionId: 'to-done' });
  await createIssue(admin, { projectKey: 'OPS', issueType: 'task', summary: 'Backups prüfen' });
  await admin.request('POST', '/issues/OPS-1/comments', {
    body: docFromText('Die Datenbanken werden nachts gesichert.'),
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('TQL search', () => {
  it('returns all visible issues, newest first, without a query', async () => {
    expect(await keys('')).toEqual(['OPS-1', 'WEB-3', 'WEB-2', 'WEB-1']);
  });

  it('pages through results with a total', async () => {
    const response = await admin.request<SearchResult>('POST', '/search', {
      query: 'ORDER BY key',
      limit: 2,
      offset: 2,
    });
    expect(response.body).toMatchObject({ total: 4, limit: 2, offset: 2 });
    // OPS-1 and WEB-1 are on the first page.
    expect(response.body.issues.map((issue) => issue.key)).toEqual(['WEB-2', 'WEB-3']);
  });

  it('filters by project, type, status, category, priority and resolution', async () => {
    expect(await keys('project = web ORDER BY key')).toEqual(['WEB-1', 'WEB-2', 'WEB-3']);
    expect(await keys('project in (Betrieb, WEB) ORDER BY key DESC')).toEqual([
      'WEB-3',
      'WEB-2',
      'WEB-1',
      'OPS-1',
    ]);
    expect(await keys('issuetype = Bug')).toEqual(['WEB-3']);
    expect(await keys('type in (story, Epic) ORDER BY key')).toEqual(['WEB-1', 'WEB-2']);
    expect(await keys('status = Erledigt')).toEqual(['WEB-3']);
    expect(await keys('statusCategory = done')).toEqual(['WEB-3']);
    expect(await keys('statusCategory != "To Do" ORDER BY key')).toEqual(['WEB-3']);
    expect(await keys('priority = Hoch')).toEqual(['WEB-3']);
    expect(await keys('resolution = done')).toEqual(['WEB-3']);
    expect(await keys('resolution is EMPTY ORDER BY key')).toEqual(['OPS-1', 'WEB-1', 'WEB-2']);
  });

  it('combines conditions with AND, OR, NOT and parentheses', async () => {
    expect(await keys('project = WEB AND (labels = sso OR priority = Hoch) ORDER BY key')).toEqual([
      'WEB-2',
      'WEB-3',
    ]);
    expect(await keys('NOT project = WEB')).toEqual(['OPS-1']);
  });

  it('filters by people, with currentUser(), membersOf() and JQL semantics for !=', async () => {
    expect(await keys('assignee = currentUser()', member)).toEqual(['WEB-1']);
    expect(await keys('assignee = "JONAS@example.org"')).toEqual(['WEB-1']);
    expect(await keys(`assignee = ${memberId}`)).toEqual(['WEB-1']);
    expect(await keys('assignee in membersOf(users)')).toEqual(['WEB-1']);
    // != never matches unassigned issues.
    expect(await keys('assignee != jonas@example.org')).toEqual([]);
    expect(await keys('assignee is EMPTY ORDER BY key')).toEqual(['OPS-1', 'WEB-2', 'WEB-3']);
    expect(await keys('reporter = currentUser()', member)).toEqual(['WEB-2']);
    expect(await keys('watcher = currentUser() ORDER BY key', member)).toEqual(['WEB-1', 'WEB-2']);
  });

  it('filters labels, numbers, keys, parents and dates', async () => {
    expect(await keys('labels = auth ORDER BY key')).toEqual(['WEB-1', 'WEB-2']);
    expect(await keys('labels not in (sso)')).toEqual(['WEB-1']);
    expect(await keys('labels is empty ORDER BY key')).toEqual(['OPS-1', 'WEB-3']);
    expect(await keys('storyPoints >= 5')).toEqual(['WEB-1']);
    expect(await keys('"story points" in (3, 8) ORDER BY storyPoints')).toEqual(['WEB-2', 'WEB-1']);
    expect(await keys('key in (web-1, OPS-1) ORDER BY key')).toEqual(['OPS-1', 'WEB-1']);
    expect(await keys('parent = WEB-1')).toEqual(['WEB-2']);
    expect(await keys('due < 2026-12-01')).toEqual(['WEB-2']);
    expect(await keys('due = "2026/11/15"')).toEqual(['WEB-2']);
    expect(await keys('created >= startOfDay() AND created <= now()')).toHaveLength(4);
    expect(await keys('created < -1d')).toEqual([]);
    expect(await keys('updated > startOfWeek(-1) AND updated < endOfYear()')).toHaveLength(4);
    expect(await keys('resolved >= startOfDay()')).toEqual(['WEB-3']);
  });

  it('searches text with German and English stems, prefixes and comments', async () => {
    expect(await keys('summary ~ keycloak')).toEqual(['WEB-2']);
    expect(await keys('summary ~ "speicher*"')).toEqual(['WEB-3']);
    expect(await keys('text ~ Sitzung')).toEqual(['WEB-1']);
    expect(await keys('description ~ session')).toEqual(['WEB-2']);
    expect(await keys('summary ~ Sitzung')).toEqual([]);
    expect(await keys('comment ~ gesichert')).toEqual(['OPS-1']);
    expect(await keys('text ~ datenbank')).toEqual(['OPS-1']);
    expect(await keys('summary !~ keycloak AND project = WEB ORDER BY key')).toEqual([
      'WEB-1',
      'WEB-3',
    ]);
  });

  it('orders by priority, status and assignee', async () => {
    expect((await keys('ORDER BY priority, key'))[0]).toBe('WEB-3');
    expect((await keys('ORDER BY status DESC, key'))[0]).toBe('WEB-3');
    expect((await keys('ORDER BY assignee, key'))[0]).toBe('WEB-1');
  });

  it('reports invalid queries with codes and positions', async () => {
    const unknown = await problem('project = WEB AND status = Fertig');
    expect(unknown.type).toBe('urn:lenipo:problem:query');
    expect(unknown.queryErrors).toEqual([
      expect.objectContaining({ code: 'value-not-found', start: 27, end: 33 }),
    ]);
    expect((await problem('status = ')).queryErrors?.[0]?.code).toBe('expected-value');
    expect((await problem('assignee = nobody@example.org')).queryErrors?.[0]?.code).toBe(
      'value-not-found',
    );
    expect((await problem('assignee in membersOf(nobody)')).queryErrors?.[0]?.params).toEqual({
      field: 'group',
      value: 'nobody',
    });
    expect((await problem('summary ~ "!!"')).queryErrors?.[0]?.code).toBe('no-search-terms');
  });

  it('never shows issues of projects one cannot browse', async () => {
    expect(await keys('', outsider)).toEqual([]);
    // A project one cannot see is reported exactly like one that does not exist.
    expect((await problem('project = WEB', outsider)).queryErrors?.[0]?.code).toBe(
      'value-not-found',
    );
  });

  it('requires an issues scope for tokens', async () => {
    const wikiOnly = await admin.request<CreatedToken>('POST', '/me/tokens', {
      name: 'Wiki',
      scopes: ['wiki:read'],
      expiresInDays: 1,
    });
    const reader = await admin.request<CreatedToken>('POST', '/me/tokens', {
      name: 'Lesen',
      scopes: ['issues:read'],
      expiresInDays: 1,
    });
    const wikiClient = new TestClient(test.baseUrl, {
      authorization: `Bearer ${wikiOnly.body.secret}`,
    });
    const readClient = new TestClient(test.baseUrl, {
      authorization: `Bearer ${reader.body.secret}`,
    });
    expect((await wikiClient.request('POST', '/search', { query: '' })).status).toBe(403);
    expect(await keys('project = OPS', readClient)).toEqual(['OPS-1']);
  });
});

describe('value suggestions', () => {
  async function suggest(field: string, prefix: string, client: TestClient = admin) {
    const params = new URLSearchParams({ field, prefix });
    const response = await client.request<ValueSuggestion[]>(
      'GET',
      `/search/suggestions?${params}`,
    );
    expect(response.status).toBe(200);
    return response.body;
  }

  it('suggests canonical values for each kind of field', async () => {
    expect((await suggest('status', 'in')).map((entry) => entry.value)).toEqual(
      expect.arrayContaining(['In Arbeit', 'In Prüfung']),
    );
    expect(await suggest('project', 'we')).toEqual([
      { value: 'WEB', label: 'Web-Relaunch', detail: 'WEB' },
    ]);
    expect((await suggest('assignee', 'jon')).map((entry) => entry.value)).toEqual([
      'jonas@example.org',
    ]);
    expect((await suggest('labels', '')).map((entry) => entry.value)).toEqual(['auth', 'sso']);
    expect((await suggest('parent', 'web-1')).map((entry) => entry.value)).toEqual(['WEB-1']);
    expect((await suggest('statusCategory', 'do')).map((entry) => entry.value)).toEqual(['done']);
  });

  it('suggests nothing from projects or people one may not see', async () => {
    expect(await suggest('project', '', outsider)).toEqual([]);
    expect(await suggest('labels', '', outsider)).toEqual([]);
    expect(await suggest('assignee', 'jon', outsider)).toEqual([]);
  });

  it('rejects unknown fields', async () => {
    const response = await admin.request('GET', '/search/suggestions?field=colour');
    expect(response.status).toBe(400);
  });
});

describe('saved filters', () => {
  let filter: SavedFilter;

  it('saves a valid query as a favourite of its owner', async () => {
    const response = await member.request<SavedFilter>('POST', '/filters', {
      name: 'Meine Arbeit',
      query: 'assignee = currentUser() AND resolution is EMPTY',
    });
    expect(response.status).toBe(201);
    filter = response.body;
    expect(filter).toMatchObject({
      name: 'Meine Arbeit',
      owner: { displayName: 'Jonas Schulz' },
      shares: [],
      favourite: true,
      editable: true,
    });
  });

  it('rejects duplicate names and invalid queries', async () => {
    const duplicate = await member.request('POST', '/filters', {
      name: 'meine arbeit',
      query: '',
    });
    expect(duplicate.status).toBe(409);
    const invalid = await member.request<Problem>('POST', '/filters', {
      name: 'Kaputt',
      query: 'status = Fertig',
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.queryErrors?.[0]?.code).toBe('value-not-found');
  });

  it('keeps unshared filters private', async () => {
    expect((await admin.request('GET', `/filters/${filter.id}`)).status).toBe(404);
    expect((await admin.request('GET', '/filters/not-a-uuid')).status).toBe(404);
  });

  it('shares read-only with everyone signed in', async () => {
    const shared = await member.request<SavedFilter>('PATCH', `/filters/${filter.id}`, {
      shares: [{ type: 'authenticated' }, { type: 'authenticated' }],
    });
    expect(shared.status).toBe(200);
    expect(shared.body.shares).toEqual([{ type: 'authenticated' }]);

    const seen = await admin.request<SavedFilter[]>('GET', '/filters?scope=shared');
    expect(seen.body.map((entry) => [entry.name, entry.editable, entry.favourite])).toEqual([
      ['Meine Arbeit', false, false],
    ]);
    expect((await admin.request('PATCH', `/filters/${filter.id}`, { name: 'Meins' })).status).toBe(
      403,
    );

    expect((await admin.request('PUT', `/filters/${filter.id}/favourite`)).status).toBe(204);
    const favourites = await admin.request<SavedFilter[]>('GET', '/filters?scope=favourites');
    expect(favourites.body.map((entry) => entry.id)).toEqual([filter.id]);
  });

  it('shares with a project only for its members', async () => {
    const projects = await member.request<Array<{ id: string; key: string }>>('GET', '/projects');
    const web = projects.body.find((project) => project.key === 'WEB');
    const response = await member.request<SavedFilter>('PATCH', `/filters/${filter.id}`, {
      shares: [{ type: 'project', projectId: web?.id }],
    });
    expect(response.body.shares).toEqual([
      { type: 'project', project: { id: web?.id, key: 'WEB', name: 'Web-Relaunch' } },
    ]);
    expect((await outsider.request('GET', `/filters/${filter.id}`)).status).toBe(404);
    expect((await admin.request('GET', `/filters/${filter.id}`)).status).toBe(200);
  });

  it('allows sharing only with own groups and with the share-filters permission', async () => {
    const groups = await admin.request<Array<{ id: string; name: string }>>('GET', '/admin/groups');
    const externe = groups.body.find((group) => group.name === 'externe');
    const foreign = await member.request('PATCH', `/filters/${filter.id}`, {
      shares: [{ type: 'group', groupId: externe?.id }],
    });
    expect(foreign.status).toBe(400);

    const own = await outsider.request<SavedFilter>('POST', '/filters', {
      name: 'Privat',
      query: '',
    });
    expect(own.status).toBe(201);
    const shareAttempt = await outsider.request('PATCH', `/filters/${own.body.id}`, {
      shares: [{ type: 'authenticated' }],
    });
    expect(shareAttempt.status).toBe(403);
  });

  it('lists by scope and lets only the owner delete', async () => {
    const mine = await member.request<SavedFilter[]>('GET', '/filters?scope=mine');
    expect(mine.body.map((entry) => entry.name)).toEqual(['Meine Arbeit']);
    expect((await outsider.request('DELETE', `/filters/${filter.id}`)).status).toBe(404);
    expect((await member.request('DELETE', `/filters/${filter.id}`)).status).toBe(204);
    expect((await member.request('GET', `/filters/${filter.id}`)).status).toBe(404);
  });
});
