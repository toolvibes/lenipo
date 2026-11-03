import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { BoardSummary, CreatedToken, Sprint } from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let client: Client;
let board: BoardSummary;
let sprint: Sprint;

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  const me = (await admin.request<{ id: string }>('GET', '/me')).body;
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web-Relaunch', template: 'scrum' });
  await admin.request('POST', '/issues', {
    projectKey: 'WEB',
    issueType: 'story',
    summary: 'Login mit Passkey',
    assigneeId: me.id,
  });
  board = (
    await admin.request<BoardSummary>('POST', '/boards', {
      name: 'Team',
      projectKey: 'WEB',
      type: 'scrum',
    })
  ).body;
  sprint = (
    await admin.request<Sprint>('POST', `/boards/${board.id}/sprints`, { goal: 'Anmelden' })
  ).body;
  await admin.request('POST', '/sprints/move-issues', {
    issueKeys: ['WEB-1'],
    sprintId: sprint.id,
  });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
  await admin.request('POST', `/sprints/${sprint.id}/start`, { startDate: today, endDate: today });
  const token = await admin.request<CreatedToken>('POST', '/me/tokens', {
    name: 'Claude',
    scopes: ['issues:read'],
    expiresInDays: 30,
  });
  client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(test.baseUrl.replace(/\/api\/v1$/, '/mcp')), {
      requestInit: { headers: { authorization: `Bearer ${token.body.secret}` } },
    }),
  );
}, 60_000);

afterAll(async () => {
  await client?.close();
  await test?.close();
});

const textOf = (result: Awaited<ReturnType<Client['readResource']>>) => {
  const first = result.contents[0];
  return first && 'text' in first ? String(first.text) : '';
};

describe('MCP resources and prompts (D-MCP-08/09)', () => {
  it('offers resource templates and lists the caller’s open issues', async () => {
    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates.map((entry) => entry.uriTemplate).sort()).toEqual([
      'lenipo://board/{id}',
      'lenipo://issue/{key}',
      'lenipo://page/{id}',
      'lenipo://project/{key}/team',
      'lenipo://sprint/{id}',
    ]);
    const { resources } = await client.listResources();
    expect(resources).toEqual([
      expect.objectContaining({ uri: 'lenipo://issue/WEB-1', name: 'WEB-1 Login mit Passkey' }),
    ]);
  });

  it('reads issues, boards and sprints as Markdown', async () => {
    const issue = await client.readResource({ uri: 'lenipo://issue/WEB-1' });
    expect(issue.contents[0]?.mimeType).toBe('text/markdown');
    expect(textOf(issue)).toContain('Login mit Passkey');
    expect(textOf(await client.readResource({ uri: `lenipo://board/${board.id}` }))).toContain(
      '# Team',
    );
    expect(textOf(await client.readResource({ uri: `lenipo://sprint/${sprint.id}` }))).toContain(
      'WEB-1',
    );
    await expect(client.readResource({ uri: 'lenipo://issue/WEB-99' })).rejects.toThrow(/404/);
  });

  it('offers prompts that bring their data along', async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.map((prompt) => prompt.name).sort()).toEqual([
      'backlog_cleanup',
      'bug_from_error',
      'release_notes',
      'retro_prep',
      'sprint_review',
    ]);
    const review = await client.getPrompt({
      name: 'sprint_review',
      arguments: { sprint: sprint.id },
    });
    const text = review.messages[0]?.content.type === 'text' ? review.messages[0].content.text : '';
    expect(text).toContain('sprint goal');
    expect(text).toContain('WEB-1');
    const bug = await client.getPrompt({
      name: 'bug_from_error',
      arguments: { project: 'WEB', error: 'TypeError: x is undefined' },
    });
    expect(JSON.stringify(bug.messages)).toContain('TypeError: x is undefined');
  });
});
