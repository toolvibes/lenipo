import type {
  Agent,
  CreatedToken,
  Issue,
  Me,
  SearchResult,
  UserLookup,
  UserSummary,
} from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { SetupService } from './setup.service.js';

let test: TestApp;
let admin: TestClient;
let lenaId: string;
let max: TestClient;
let maxId: string;

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  lenaId = (await admin.request<Me>('GET', '/me')).body.id;
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  maxId = (
    await admin.request<UserSummary>('POST', '/admin/users', {
      email: 'max@example.org',
      displayName: 'Max Muster',
      password: 'ein-langes-passwort',
    })
  ).body.id;
  max = new TestClient(test.baseUrl);
  await max.request('POST', '/auth/login', {
    email: 'max@example.org',
    password: 'ein-langes-passwort',
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('agents (TL-92)', () => {
  let agent: Agent;
  let token: CreatedToken;

  it('are accounts of their own kind with a responsible person', async () => {
    const created = await admin.request<Agent>('POST', '/agents', {
      displayName: 'Claude',
      vendor: 'Claude Code',
      model: 'claude-opus-5-5',
      ownerId: maxId,
    });
    expect(created.status).toBe(201);
    agent = created.body;
    expect(agent).toMatchObject({
      displayName: 'Claude',
      vendor: 'Claude Code',
      owner: { id: maxId, displayName: 'Max Muster' },
      status: 'active',
    });
    const users = (await admin.request<UserSummary[]>('GET', '/admin/users')).body;
    expect(users.find((user) => user.id === agent.id)).toMatchObject({ agent: true, groups: [] });
    expect(users.find((user) => user.id === maxId)?.agent).toBe(false);
    const found = (await admin.request<UserLookup[]>('GET', '/users?query=claude')).body;
    expect(found).toEqual([expect.objectContaining({ id: agent.id, agent: true })]);
    expect((await max.request<Agent[]>('GET', '/agents')).body.map((entry) => entry.id)).toEqual([
      agent.id,
    ]);

    // Only administrators create and change agents; they answer to people, not to agents.
    expect((await max.request('POST', '/agents', { displayName: 'X', vendor: 'Y' })).status).toBe(
      403,
    );
    expect(
      (await admin.request('PATCH', `/agents/${agent.id}`, { ownerId: agent.id })).status,
    ).toBe(404);
    const changed = await admin.request<Agent>('PATCH', `/agents/${agent.id}`, {
      model: 'claude-fable-5-1',
    });
    expect(changed.body).toMatchObject({ model: 'claude-fable-5-1', owner: { id: maxId } });
  });

  it('get tokens from their responsible person, never with the admin scope', async () => {
    const outsider = await admin.request<UserSummary>('POST', '/admin/users', {
      email: 'eva@example.org',
      displayName: 'Eva Extern',
      password: 'ein-langes-passwort',
    });
    const eva = new TestClient(test.baseUrl);
    await eva.request('POST', '/auth/login', {
      email: 'eva@example.org',
      password: 'ein-langes-passwort',
    });
    expect(outsider.status).toBe(201);
    const body = { name: 'Sprint', scopes: ['issues:read', 'issues:write'], expiresInDays: 30 };
    expect((await eva.request('POST', `/agents/${agent.id}/tokens`, body)).status).toBe(403);
    expect(
      (await max.request('POST', `/agents/${agent.id}/tokens`, { ...body, scopes: ['admin'] }))
        .status,
    ).toBe(400);
    const created = await max.request<CreatedToken>('POST', `/agents/${agent.id}/tokens`, body);
    expect(created.status).toBe(201);
    token = created.body;
    expect((await admin.request<unknown[]>('GET', `/agents/${agent.id}/tokens`)).body).toHaveLength(
      1,
    );

    const asAgent = new TestClient(test.baseUrl, { authorization: `Bearer ${token.secret}` });
    const me = (await asAgent.request<Me>('GET', '/me')).body;
    expect(me).toMatchObject({ id: agent.id, agent: true, hasPassword: false });
    // An agent cannot mint tokens for itself.
    expect((await asAgent.request('POST', '/me/tokens', body)).status).toBe(403);
  });

  it('work in projects and are found with agents()', async () => {
    await admin.request('POST', '/projects/WEB/members', { role: 'developers', userId: agent.id });
    const asAgent = new TestClient(test.baseUrl, { authorization: `Bearer ${token.secret}` });
    const issue = await asAgent.request<Issue>('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Login-Seite testen',
      assigneeId: agent.id,
    });
    expect(issue.status).toBe(201);
    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Von Hand',
      assigneeId: lenaId,
    });
    const search = async (query: string) =>
      (await admin.request<SearchResult>('POST', '/search', { query })).body.issues.map(
        (entry) => entry.key,
      );
    expect(await search('assignee in agents()')).toEqual([issue.body.key]);
    expect(await search('reporter in agents()')).toEqual([issue.body.key]);
    expect(await search('assignee not in agents()')).toEqual(['WEB-2']);
  });

  it('stop working when deactivated', async () => {
    await admin.request('POST', `/admin/users/${agent.id}/deactivate`);
    const asAgent = new TestClient(test.baseUrl, { authorization: `Bearer ${token.secret}` });
    expect((await asAgent.request('GET', '/me')).status).toBe(401);
    expect((await admin.request<Agent>('GET', '/agents')).body).toEqual([
      expect.objectContaining({ id: agent.id, status: 'deactivated' }),
    ]);
  });
});
