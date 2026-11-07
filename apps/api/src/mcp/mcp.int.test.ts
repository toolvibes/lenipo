import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ChangeGroup, CreatedToken, Issue } from '@toolvibes/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditLog } from '../db/schema/index.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let client: Client;
let readOnly: Client;
let mcpUrl: URL;

async function connect(secret: string): Promise<Client> {
  const mcp = new Client({ name: 'test', version: '1.0.0' });
  await mcp.connect(
    new StreamableHTTPClientTransport(mcpUrl, {
      requestInit: { headers: { authorization: `Bearer ${secret}` } },
    }),
  );
  return mcp;
}

async function call(mcp: Client, name: string, args: Record<string, unknown> = {}) {
  const result = (await mcp.callTool({ name, arguments: args })) as CallToolResult;
  const first = result.content[0];
  return { ...result, text: first?.type === 'text' ? first.text : '' };
}

beforeAll(async () => {
  test = await startTestApp();
  mcpUrl = new URL(test.baseUrl.replace(/\/api\/v1$/, '/mcp'));
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web-Relaunch', template: 'scrum' });
  const token = await admin.request<CreatedToken>('POST', '/me/tokens', {
    name: 'Claude',
    scopes: ['issues:read', 'issues:write'],
    expiresInDays: 30,
  });
  const reader = await admin.request<CreatedToken>('POST', '/me/tokens', {
    name: 'Reader',
    scopes: ['issues:read'],
    expiresInDays: 30,
  });
  client = await connect(token.body.secret);
  readOnly = await connect(reader.body.secret);
}, 60_000);

afterAll(async () => {
  await client?.close();
  await readOnly?.close();
  await test?.close();
});

describe('MCP', () => {
  it('lists unique, described tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(
      expect.arrayContaining([
        'whoami',
        'search_issues',
        'get_issue',
        'create_issue',
        'update_issue',
        'transition_issue',
        'assign_issue',
        'add_comment',
        'link_issues',
        'log_work',
        'get_issue_history',
        'list_projects',
        'get_project',
        'explain_tql',
      ]),
    );
    for (const tool of tools) {
      expect(tool.description?.length).toBeGreaterThan(10);
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  it('names the issue type keys, so an agent need not guess them', async () => {
    const project = await call(client, 'get_project', { project: 'WEB' });
    expect(project.text).toContain('task (Aufgabe)');

    const refused = await call(client, 'create_issue', {
      projectKey: 'WEB',
      issueType: 'Aufgabe',
      summary: 'Falscher Typ',
    });
    expect(refused.isError).toBe(true);
    expect(refused.text).toContain('is not available in WEB');
    expect(refused.text).toMatch(/Use one of these keys: .*\btask\b/);
  });

  it('works through an issue like an agent would', async () => {
    expect((await call(client, 'whoami')).text).toContain('Lena Vogt');
    const created = await call(client, 'create_issue', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Login prüfen',
      description: '## Schritte\n\n- anmelden\n- **abmelden**',
    });
    expect(created.isError).toBeFalsy();
    expect(created.text).toContain('# WEB-1: Login prüfen');
    expect(created.text).toContain('- **abmelden**');

    const allowed = await call(client, 'transition_issue', { key: 'WEB-1' });
    expect(allowed.text).toContain('Allowed transitions');
    const moved = await call(client, 'transition_issue', { key: 'WEB-1', to: 'in progress' });
    expect(moved.isError).toBeFalsy();
    expect((await call(client, 'transition_issue', { key: 'WEB-1', to: 'Mond' })).isError).toBe(
      true,
    );

    await call(client, 'assign_issue', { key: 'WEB-1', assignee: 'me' });
    await call(client, 'add_comment', { key: 'WEB-1', body: 'Geht *wieder*.' });
    await call(client, 'log_work', { key: 'WEB-1', timeSpent: '1h' });

    const found = await call(client, 'search_issues', {
      query: 'assignee = currentUser() AND project = WEB',
    });
    expect(found.text).toContain('WEB-1');
    expect(found.structuredContent).toMatchObject({ total: 1 });

    const shown = await call(client, 'get_issue', { key: 'WEB-1', comments: true });
    expect(shown.text).toContain('assignee: Lena Vogt');
    expect(shown.text).toContain('Geht *wieder*.');
    // Claude Code shows the model only structuredContent, so it carries the full text too.
    expect(shown.structuredContent).toMatchObject({ key: 'WEB-1', markdown: shown.text });

    // Changes are marked as MCP in the history and the audit log (D-MCP-06).
    const history = await admin.request<ChangeGroup[]>('GET', '/issues/WEB-1/history');
    expect(history.body.every((group) => group.via === 'mcp')).toBe(true);
    expect((await call(client, 'get_issue_history', { key: 'WEB-1' })).text).toContain('(via MCP)');
    const audit = await test.database.db.select().from(auditLog).where(eq(auditLog.via, 'mcp'));
    expect(audit.map((entry) => entry.action)).toEqual(
      expect.arrayContaining(['mcp.create_issue', 'mcp.transition_issue', 'mcp.add_comment']),
    );
    const issue = await admin.request<Issue>('GET', '/issues/WEB-1');
    expect(issue.body.timeTracking.timeSpentSeconds).toBe(3600);
  });

  it('explains queries and reports errors as tool errors', async () => {
    expect(
      (await call(client, 'explain_tql', { query: 'project = WEB ORDER BY key' })).text,
    ).toContain('Valid');
    const invalid = await call(client, 'explain_tql', { query: 'status = ' });
    expect(invalid.isError).toBe(true);
    expect(invalid.text).toContain('Invalid TQL');
    expect((await call(client, 'get_issue', { key: 'WEB-99' })).isError).toBe(true);
  });

  it('reads boards and moves cards', async () => {
    const board = await admin.request<{ id: string; columns: Array<{ name: string }> }>(
      'POST',
      '/boards',
      { name: 'Team', projectKey: 'WEB' },
    );
    const listed = await call(client, 'list_boards', { project: 'WEB' });
    expect(listed.text).toContain(board.body.id);
    const shown = await call(client, 'get_board', { board: board.body.id });
    expect(shown.text).toMatch(/## .+ \(1\)\n- WEB-1/);
    const target = board.body.columns.at(-1)?.name ?? '';
    const moved = await call(client, 'move_card', {
      board: board.body.id,
      key: 'WEB-1',
      column: target,
    });
    expect(moved.isError).toBeFalsy();
    expect(moved.text).toContain(`"${target}"`);
    const wrong = await call(client, 'move_card', {
      board: board.body.id,
      key: 'WEB-1',
      column: 'Mond',
    });
    expect(wrong.isError).toBe(true);
    expect(wrong.text).toContain('Columns:');
  });

  it('plans sprints', async () => {
    const board = await admin.request<{ id: string }>('POST', '/boards', {
      name: 'Scrum',
      projectKey: 'WEB',
      type: 'scrum',
    });
    const sprint = await admin.request<{ id: string }>(
      'POST',
      `/boards/${board.body.id}/sprints`,
      {},
    );
    const moved = await call(client, 'move_to_sprint', { keys: ['WEB-1'], sprint: sprint.body.id });
    expect(moved.isError).toBeFalsy();
    const backlog = await call(client, 'get_backlog', { board: board.body.id });
    expect(backlog.text).toMatch(/## Scrum Sprint 1 \(future\).*\n- WEB-1/);
    expect((await call(client, 'get_active_sprint', { board: board.body.id })).text).toContain(
      'No sprint is running',
    );
  });

  it('keeps the token’s limits', async () => {
    expect((await call(readOnly, 'search_issues', { query: 'project = WEB' })).text).toContain(
      'WEB-1',
    );
    const write = await call(readOnly, 'add_comment', { key: 'WEB-1', body: 'nein' });
    expect(write.isError).toBe(true);
    expect(write.text).toContain('issues:write');
  });

  it('refuses sessions and other methods', async () => {
    const response = await fetch(mcpUrl, { method: 'GET' });
    expect([401, 405]).toContain(response.status);
    const noToken = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    expect(noToken.status).toBe(401);
  });

  it('creates a project with board and wiki space, only with the admin scope', async () => {
    const denied = await call(client, 'create_project', {
      key: 'APP',
      name: 'App',
      template: 'scrum',
    });
    expect(denied.isError).toBe(true);
    expect(denied.text).toContain('admin scope');

    const token = await admin.request<CreatedToken>('POST', '/me/tokens', {
      name: 'Agent mit Admin',
      scopes: ['issues:read', 'issues:write', 'wiki:read', 'wiki:write', 'admin'],
      expiresInDays: 1,
    });
    const agent = await connect(token.body.secret);
    const created = await call(agent, 'create_project', {
      key: 'APP',
      name: 'App',
      template: 'scrum',
      description: 'Eine App',
      lore: true,
    });
    expect(created.isError).toBeFalsy();
    expect(created.text).toContain('scrum board');
    const issue = await call(agent, 'create_issue', {
      projectKey: 'APP',
      issueType: 'story',
      summary: 'Anmelden',
    });
    expect(issue.text).toContain('APP-1');
    const boards = (
      await admin.request<Array<{ id: string; type: string }>>('GET', '/boards?project=APP')
    ).body;
    expect(boards.map((board) => board.type)).toEqual(['scrum']);
    const backlog = await call(agent, 'get_backlog', { board: boards[0]?.id });
    expect(backlog.text).toContain('APP-1');
    const space = await admin.request<{ project: { key: string } | null }>('GET', '/spaces/APP');
    expect(space.body.project?.key).toBe('APP');
    await agent.close();
  });
});
