import { createServer, type Server } from 'node:http';
import type { Attachment, BoardData, Comment, ImportJob, Issue, Worklog } from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { ImportService } from './import.service.js';

let test: TestApp;
let admin: TestClient;
let jira: Server;
let jiraUrl = '';

const lena = { key: 'lena', emailAddress: 'lena@example.org', displayName: 'Lena Vogt' };
const boss = { key: 'boss', emailAddress: 'boss@corp.example', displayName: 'Old Boss' };
const at = '2025-03-01T10:00:00.000+0100';

function issuesPage() {
  return {
    total: 2,
    issues: [
      {
        id: '1001',
        key: 'JRA-1',
        fields: {
          summary: 'Anmeldung',
          issuetype: { name: 'Epic' },
          status: { name: 'Done', statusCategory: { key: 'done' } },
          resolution: { name: 'Fixed' },
          priority: { name: 'High' },
          reporter: lena,
          created: at,
          updated: at,
          resolutiondate: at,
        },
        changelog: { histories: [] },
      },
      {
        id: '1003',
        key: 'JRA-3',
        fields: {
          summary: 'Login mit Passkey',
          issuetype: { name: 'Story' },
          status: { name: 'In Review', statusCategory: { key: 'indeterminate' } },
          priority: { name: 'Blocker' },
          assignee: lena,
          reporter: boss,
          description: 'h2. Ziel\nDas ist *wichtig*.',
          labels: ['auth'],
          customfield_10002: 5,
          customfield_10001: 'JRA-1',
          fixVersions: [{ id: '10' }],
          components: [{ id: '20' }],
          created: at,
          updated: at,
          comment: {
            total: 1,
            comments: [{ id: '100', author: boss, body: 'Bitte _bald_', created: at }],
          },
          worklog: {
            total: 1,
            worklogs: [{ id: '200', author: lena, started: at, timeSpentSeconds: 3600 }],
          },
          attachment: [
            {
              id: '300',
              filename: 'plan.txt',
              mimeType: 'text/plain',
              content: `${jiraUrl}/secure/attachment/300/plan.txt`,
              author: lena,
              created: at,
            },
          ],
          issuelinks: [
            {
              id: '400',
              type: { name: 'Blocks', outward: 'blocks', inward: 'is blocked by' },
              outwardIssue: { key: 'JRA-1' },
            },
          ],
        },
        changelog: {
          histories: [
            {
              id: '500',
              author: lena,
              created: at,
              items: [{ field: 'status', fromString: 'Open', toString: 'In Review' }],
            },
          ],
        },
      },
    ],
  };
}

const routes: Record<string, () => unknown> = {
  '/rest/api/2/field': () => [
    { id: 'customfield_10002', name: 'Story Points', custom: true },
    { id: 'customfield_10001', name: 'Epic Link', custom: true },
  ],
  '/rest/api/2/project/JRA': () => ({
    key: 'JRA',
    name: 'Jira Demo',
    versions: [{ id: '10', name: '1.0', released: true, releaseDate: '2025-04-01' }],
    components: [{ id: '20', name: 'Backend' }],
  }),
  '/rest/api/2/search': issuesPage,
  '/rest/agile/1.0/board': () => ({
    values: [{ id: 7, name: 'JRA Board', type: 'scrum' }],
    isLast: true,
  }),
  '/rest/agile/1.0/board/7/sprint': () => ({
    values: [
      {
        id: 70,
        name: 'Sprint 1',
        state: 'active',
        goal: 'Login',
        startDate: at,
        endDate: '2025-03-14T10:00:00.000+0100',
      },
    ],
    isLast: true,
  }),
  '/rest/agile/1.0/sprint/70/issue': () => ({ issues: [{ key: 'JRA-3' }], total: 1 }),
};

async function runImport(dryRun: boolean): Promise<ImportJob> {
  const job = (
    await admin.request<ImportJob>('POST', '/admin/imports/jira', {
      url: jiraUrl,
      token: 'jira-token',
      projectKeys: ['JRA'],
      dryRun,
    })
  ).body;
  await test.app.get(ImportService).runPending();
  return (await admin.request<ImportJob>('GET', `/admin/imports/${job.id}`)).body;
}

beforeAll(async () => {
  jira = createServer((request, response) => {
    if (request.headers.authorization !== 'Bearer jira-token') {
      response.writeHead(401).end();
      return;
    }
    const path = (request.url ?? '').split('?')[0] ?? '';
    if (path === '/secure/attachment/300/plan.txt') {
      response.writeHead(200, { 'content-type': 'text/plain' }).end('Plan');
      return;
    }
    const route = routes[path];
    if (!route) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(route()));
  });
  await new Promise<void>((resolve) => jira.listen(0, '127.0.0.1', resolve));
  const address = jira.address();
  jiraUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
  await new Promise((resolve) => jira?.close(resolve));
});

describe('import from Jira Server/DC (TL-35)', () => {
  it('reports in a dry run without writing', async () => {
    const job = await runImport(true);
    expect(job.state).toBe('done');
    expect(job.report?.counts).toMatchObject({
      'Projekte anzulegen': 1,
      Vorgänge: 2,
      'Personen anzulegen (deaktiviert)': 1,
      Kommentare: 1,
      Anhänge: 1,
      Sprints: 1,
    });
    expect((await admin.request('GET', '/projects/JRA')).status).toBe(404);
  });

  it('imports projects with issues, people, history, comments, work, files, links and sprints', async () => {
    const job = await runImport(false);
    expect(job.state, job.log.join('\n')).toBe('done');
    const story = (await admin.request<Issue>('GET', '/issues/JRA-3?format=markdown')).body;
    expect(story).toMatchObject({
      key: 'JRA-3',
      summary: 'Login mit Passkey',
      storyPoints: 5,
      labels: ['auth'],
      assignee: { displayName: 'Lena Vogt' },
      reporter: { displayName: 'Old Boss' },
      parent: { key: 'JRA-1' },
      fixVersions: [expect.objectContaining({ name: '1.0' })],
    });
    expect(story.status.category).toBe('in_progress');
    expect(String(story.description)).toContain('## Ziel');
    expect(String(story.description)).toContain('**wichtig**');
    expect((await admin.request<Issue>('GET', '/issues/JRA-1')).body.resolution).not.toBeNull();
    const comments = (
      await admin.request<Comment[]>('GET', '/issues/JRA-3/comments?format=markdown')
    ).body;
    expect(comments.map((comment) => [comment.author?.displayName, comment.body])).toEqual([
      ['Old Boss', 'Bitte *bald*'],
    ]);
    expect(
      (await admin.request<Worklog[]>('GET', '/issues/JRA-3/worklogs')).body[0]?.timeSpentSeconds,
    ).toBe(3600);
    expect(
      (await admin.request<Attachment[]>('GET', '/issues/JRA-3/attachments')).body.map(
        (file) => file.fileName,
      ),
    ).toEqual(['plan.txt']);
    expect(job.report?.mappings).toEqual(
      expect.arrayContaining([expect.stringContaining('Priorität Blocker')]),
    );
    const boards = (
      await admin.request<Array<{ id: string; name: string }>>('GET', '/boards?project=JRA')
    ).body;
    const board = boards.find((entry) => entry.name === 'JRA Board');
    const data = (await admin.request<BoardData>('GET', `/boards/${board?.id}/issues`)).body;
    expect(data.sprint?.name).toBe('Sprint 1');
    expect(data.issues.map((issue) => issue.key)).toEqual(['JRA-3']);
    // New issues continue after the highest imported number.
    const next = await admin.request<Issue>('POST', '/issues', {
      projectKey: 'JRA',
      issueType: 'story',
      summary: 'Neu',
    });
    expect(next.body.key).toBe('JRA-4');
  });

  it('skips what it imported before', async () => {
    const job = await runImport(false);
    expect(job.report?.counts).toMatchObject({ 'Vorgänge schon da': 2 });
    expect((await admin.request<Comment[]>('GET', '/issues/JRA-3/comments')).body).toHaveLength(1);
  });

  it('fails clearly when the project key is taken', async () => {
    await admin.request('POST', '/projects', { key: 'TAKEN', name: 'Belegt', template: 'scrum' });
    routes['/rest/api/2/project/TAKEN'] = () => ({ key: 'TAKEN', name: 'Taken' });
    const job = (
      await admin.request<ImportJob>('POST', '/admin/imports/jira', {
        url: jiraUrl,
        token: 'jira-token',
        projectKeys: ['TAKEN'],
        dryRun: false,
      })
    ).body;
    await test.app.get(ImportService).runPending();
    const done = (await admin.request<ImportJob>('GET', `/admin/imports/${job.id}`)).body;
    expect(done.state).toBe('failed');
    expect(done.log.join()).toContain('TAKEN gibt es in Tasklore schon');
  });
});
