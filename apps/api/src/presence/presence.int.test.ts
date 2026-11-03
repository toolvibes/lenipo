import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Agent, CreatedToken, Presence, TeamMember } from '@toolvibes/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { presence } from '../db/schema/index.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let agent: Agent;
let asAgent: TestClient;
let secret: string;

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
  await admin.request('POST', '/projects', { key: 'OPS', name: 'Betrieb', template: 'basic' });
  for (const summary of ['Login-Seite', 'Suche']) {
    await admin.request('POST', '/issues', { projectKey: 'WEB', issueType: 'task', summary });
  }
  await admin.request('POST', '/issues', {
    projectKey: 'OPS',
    issueType: 'task',
    summary: 'Backup',
  });
  agent = (
    await admin.request<Agent>('POST', '/agents', { displayName: 'Claude', vendor: 'Claude Code' })
  ).body;
  await admin.request('POST', '/projects/WEB/members', { role: 'developers', userId: agent.id });
  await admin.request('POST', '/projects/OPS/members', { role: 'developers', userId: agent.id });
  secret = (
    await admin.request<CreatedToken>('POST', `/agents/${agent.id}/tokens`, {
      name: 'Lauf',
      scopes: ['issues:read', 'issues:write'],
      expiresInDays: 30,
    })
  ).body.secret;
  asAgent = new TestClient(test.baseUrl, { authorization: `Bearer ${secret}` });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

const team = async (project = 'WEB') =>
  (await admin.request<TeamMember[]>('GET', `/projects/${project}/team`)).body;

describe('presence (TL-93)', () => {
  it('starts offline and takes heartbeats with issue and branch', async () => {
    expect((await asAgent.request<Presence>('GET', '/me/presence')).body).toMatchObject({
      state: 'offline',
      heartbeatAt: null,
    });
    const beat = await asAgent.request<Presence>('PUT', '/me/presence', {
      state: 'active',
      issueKey: 'WEB-1',
      branch: 'agent/WEB-1-login',
    });
    expect(beat.status).toBe(200);
    expect(beat.body).toMatchObject({
      state: 'active',
      issue: { key: 'WEB-1', summary: 'Login-Seite' },
      branch: 'agent/WEB-1-login',
    });
    // Left out keeps issue and branch; an unknown issue is refused.
    const waiting = await asAgent.request<Presence>('PUT', '/me/presence', {
      state: 'blocked',
      note: 'Wartet auf API-Schlüssel',
    });
    expect(waiting.body).toMatchObject({
      state: 'blocked',
      issue: { key: 'WEB-1' },
      note: 'Wartet auf API-Schlüssel',
    });
    expect(
      (await asAgent.request('PUT', '/me/presence', { state: 'active', issueKey: 'WEB-99' }))
        .status,
    ).toBe(404);
  });

  it('lists people and agents of a project, agents first', async () => {
    const members = await team();
    expect(members.map((member) => member.user.displayName)).toEqual(['Claude', 'Lena Vogt']);
    expect(members[0]).toMatchObject({
      agent: true,
      state: 'blocked',
      issue: { key: 'WEB-1' },
      branch: 'agent/WEB-1-login',
      openIssues: 0,
    });
    // Lena created the issues and is signed in.
    expect(members[1]).toMatchObject({ agent: false, state: 'active', issue: null });
    expect(members[1]?.lastActivityAt).not.toBeNull();
    // The issue of another project is not shown there.
    const ops = await team('OPS');
    expect(ops.find((member) => member.user.id === agent.id)).toBeUndefined();
  });

  it('counts an old heartbeat as offline', async () => {
    await test.database.db
      .update(presence)
      .set({ updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) })
      .where(eq(presence.userId, agent.id));
    expect((await asAgent.request<Presence>('GET', '/me/presence')).body.state).toBe('offline');
    // Without changes in the project and without a fresh heartbeat, the agent is not listed.
    expect((await team()).map((member) => member.user.displayName)).toEqual(['Lena Vogt']);
  });

  it('works through MCP', async () => {
    const mcp = new Client({ name: 'test', version: '1.0.0' });
    await mcp.connect(
      new StreamableHTTPClientTransport(new URL(test.baseUrl.replace(/\/api\/v1$/, '/mcp')), {
        requestInit: { headers: { authorization: `Bearer ${secret}` } },
      }),
    );
    const set = (await mcp.callTool({
      name: 'set_status',
      arguments: { state: 'active', issue: 'WEB-2', branch: 'agent/WEB-2-suche' },
    })) as CallToolResult;
    expect(set.isError).toBeFalsy();
    const read = await mcp.readResource({ uri: 'lenipo://project/WEB/team' });
    const text = read.contents[0] && 'text' in read.contents[0] ? read.contents[0].text : '';
    expect(text).toContain('Claude (agent): active – WEB-2 Suche, branch agent/WEB-2-suche');
    await mcp.close();
  });
});
