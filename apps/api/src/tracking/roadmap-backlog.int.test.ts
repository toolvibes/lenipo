import type { BoardSummary, Issue, Space } from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BoardService } from '../boards/board.service.js';
import type { Principal } from '../core/http/principal.js';
import { SetupService } from '../identity/setup.service.js';
import { SearchService } from '../search/search.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { SpaceService } from '../wiki/space.service.js';
import { IssueService } from './issue.service.js';
import { ProjectService } from './project.service.js';
import { type BacklogServices, importBacklog, type PlannedEpic } from './roadmap-backlog.js';
import { VersionService } from './version.service.js';

let test: TestApp;
let admin: TestClient;
let principal: Principal;
let services: BacklogServices;

const epics: PlannedEpic[] = [
  {
    summary: 'Phase 4: Konfigurierbarkeit',
    description: '**Ziel:** Alles anpassbar.',
    fixVersion: '1.0',
    stories: [
      {
        summary: 'Grafischer Workflow-Editor',
        description: '| ID | Feature | Prio |\n| --- | --- | --- |\n| T-WF-02 | Editor | P2 |',
        fixVersion: '1.0',
      },
    ],
  },
  { summary: 'Phase 7: Ausbau', description: '', fixVersion: null, stories: [] },
];

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
  principal = { userId: me.id, via: 'session', sessionId: 'test' };
  services = {
    projects: test.app.get(ProjectService),
    boards: test.app.get(BoardService),
    versions: test.app.get(VersionService),
    issues: test.app.get(IssueService),
    search: test.app.get(SearchService),
    spaces: test.app.get(SpaceService),
  };
  await admin.request('POST', '/spaces', { key: 'TL', name: 'Tasklore' });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('backlog from the roadmap', () => {
  it('create the project, version, epics and stories, and link the space', async () => {
    const result = await importBacklog(services, principal, epics, {
      projectKey: 'tl',
      projectName: 'Tasklore',
    });
    expect(result).toEqual({ created: ['TL-1', 'TL-2', 'TL-3'], existing: 0 });
    const story = (await admin.request<Issue>('GET', '/issues/TL-2')).body;
    expect(story.issueType.key).toBe('story');
    expect(story.parent?.key).toBe('TL-1');
    expect(story.fixVersions.map((version) => version.name)).toEqual(['1.0']);
    expect(JSON.stringify(story.description)).toContain('T-WF-02');
    const space = (await admin.request<Space>('GET', '/spaces/TL')).body;
    expect(space.project?.key).toBe('TL');
    const boards = (await admin.request<BoardSummary[]>('GET', '/boards?project=TL')).body;
    expect(boards.map((board) => [board.name, board.type])).toEqual([['Tasklore', 'scrum']]);
  });

  it('add only what is missing on a rerun', async () => {
    await admin.request('PATCH', '/issues/TL-2', { storyPoints: 5 });
    const more = [
      ...epics,
      { summary: 'Phase 8: Neu', description: '', fixVersion: null, stories: [] },
    ];
    const result = await importBacklog(services, principal, more, {
      projectKey: 'TL',
      projectName: 'Tasklore',
    });
    expect(result).toEqual({ created: ['TL-4'], existing: 3 });
    expect((await admin.request<Issue>('GET', '/issues/TL-2')).body.storyPoints).toBe(5);
    expect((await admin.request<BoardSummary[]>('GET', '/boards?project=TL')).body).toHaveLength(1);
  });
});
