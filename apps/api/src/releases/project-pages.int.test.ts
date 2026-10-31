import type {
  BoardSummary,
  LabelledPage,
  Page,
  ProjectWikiPages,
  Release,
  Sprint,
  Version,
} from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EventProcessor } from '../events/event-processor.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());

async function recent(): Promise<LabelledPage[]> {
  return (await admin.request<LabelledPage[]>('GET', '/wiki/recent-pages?space=DOC&limit=20')).body;
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
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  await admin.request('POST', '/spaces', { key: 'DOC', name: 'Doku' });
  await admin.request('POST', '/issues', {
    projectKey: 'WEB',
    issueType: 'story',
    summary: 'Fertig',
  });
  await admin.request('POST', '/issues', {
    projectKey: 'WEB',
    issueType: 'story',
    summary: 'Offen',
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('automatic project wiki pages (TL-28)', () => {
  it('are switched on per project with a space', async () => {
    const off = (await admin.request<ProjectWikiPages>('GET', '/projects/WEB/wiki-pages')).body;
    expect(off).toEqual({
      spaceKey: null,
      retroOnSprintEnd: false,
      reportOnSprintEnd: false,
      notesOnRelease: false,
    });
    const saved = await admin.request<ProjectWikiPages>('PUT', '/projects/WEB/wiki-pages', {
      spaceKey: 'DOC',
      retroOnSprintEnd: true,
      reportOnSprintEnd: true,
      notesOnRelease: true,
    });
    expect(saved.status).toBe(200);
  });

  it('creates a retro page and a sprint report when a sprint completes', async () => {
    const board = (
      await admin.request<BoardSummary>('POST', '/boards', {
        name: 'Team',
        projectKey: 'WEB',
        type: 'scrum',
      })
    ).body;
    const sprint = (await admin.request<Sprint>('POST', `/boards/${board.id}/sprints`, {})).body;
    await admin.request('POST', '/sprints/move-issues', {
      issueKeys: ['WEB-1', 'WEB-2'],
      sprintId: sprint.id,
    });
    await admin.request('POST', `/sprints/${sprint.id}/start`, {
      startDate: today,
      endDate: today,
    });
    await admin.request('POST', '/issues/WEB-1/transitions', {
      transitionId: 'to-done',
      resolution: 'done',
    });
    await admin.request('POST', `/sprints/${sprint.id}/complete`, { moveTo: 'backlog' });
    await test.app.get(EventProcessor).drain();
    await test.app.get(EventProcessor).drain();
    const titles = (await recent()).map((page) => page.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        `Retrospektive ${sprint.name}`,
        `Sprint-Bericht ${sprint.name}`,
        'Sprint-Berichte',
      ]),
    );
    // Only once, even if the event were handled again.
    expect(titles.filter((title) => title === `Retrospektive ${sprint.name}`)).toHaveLength(1);
    const report = (await recent()).find((page) => page.title === `Sprint-Bericht ${sprint.name}`);
    const page = (await admin.request<Page>('GET', `/pages/${report?.id}?format=markdown`)).body;
    expect(String(page.content)).toContain(':issue[WEB-1]');
    expect(page.ancestors.at(-1)?.title).toBe('Sprint-Berichte');
  });

  it('publishes release notes when a version is released', async () => {
    const version = (
      await admin.request<Version>('POST', '/projects/WEB/versions', { name: '1.0' })
    ).body;
    await admin.request('PATCH', '/issues/WEB-1', { fixVersions: ['1.0'] });
    await admin.request('POST', `/projects/WEB/versions/${version.id}/release`, {});
    await test.app.get(EventProcessor).drain();
    const release = (await admin.request<Release>('GET', `/projects/WEB/releases/${version.id}`))
      .body;
    expect(release.notesPage).toMatchObject({ title: 'Release Notes Web 1.0', spaceKey: 'DOC' });
  });
});
