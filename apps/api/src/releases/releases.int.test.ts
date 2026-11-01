import type { Page, Release, ReleaseNotes, Version } from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let version: Version;

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
  await admin.request('POST', '/spaces', { key: 'DOCS', name: 'Doku' });
  version = (
    await admin.request<Version>('POST', '/projects/WEB/versions', {
      name: '1.0',
      releaseDate: '2026-01-15',
    })
  ).body;
  const me = (await admin.request<{ id: string }>('GET', '/me')).body;
  for (const [issueType, summary, assigned] of [
    ['story', 'Startseite', true],
    ['bug', 'Absturz beim Login', false],
    ['story', 'Suche', true],
    ['task', 'Server', true],
  ] as const) {
    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType,
      summary,
      assigneeId: assigned ? me.id : null,
      fixVersions: summary === 'Server' ? [] : ['1.0'],
    });
  }
  await admin.request('POST', '/issues/WEB-1/transitions', {
    transitionId: 'to-done',
    resolution: 'done',
  });
  await admin.request('POST', '/issues/WEB-4/links', { type: 'blocks', issueKey: 'WEB-3' });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('releases (TL-25)', () => {
  it('shows progress, issues by status and warnings', async () => {
    const release = (await admin.request<Release>('GET', `/projects/WEB/releases/${version.id}`))
      .body;
    expect(release.progress).toMatchObject({ issues: 3, done: 1 });
    expect(release.done.map((issue) => issue.key)).toEqual(['WEB-1']);
    expect(release.todo.map((issue) => issue.key).sort()).toEqual(['WEB-2', 'WEB-3']);
    expect(release.warnings).toEqual(
      expect.arrayContaining([
        { kind: 'overdue', issueKey: 'WEB-2', blockerKey: null },
        { kind: 'overdue', issueKey: 'WEB-3', blockerKey: null },
        { kind: 'blocked', issueKey: 'WEB-3', blockerKey: 'WEB-4' },
        { kind: 'unassigned', issueKey: 'WEB-2', blockerKey: null },
      ]),
    );
    expect(release.warnings).toHaveLength(4);
    expect(release).toMatchObject({ notesPage: null, canEdit: true });
  });

  it('generates notes and publishes them to one wiki page', async () => {
    const notes = (
      await admin.request<ReleaseNotes>('GET', `/projects/WEB/releases/${version.id}/notes`)
    ).body;
    expect(notes.title).toBe('Release Notes Web 1.0');
    expect(notes.markdown).toContain('## Story');
    expect(notes.markdown).toContain(':issue[WEB-1] Startseite');
    expect(notes.markdown).not.toContain('WEB-2');

    expect(
      (
        await admin.request('POST', `/projects/WEB/releases/${version.id}/notes`, {
          title: notes.title,
          markdown: notes.markdown,
        })
      ).status,
    ).toBe(404);
    const published = (
      await admin.request<Release>('POST', `/projects/WEB/releases/${version.id}/notes`, {
        ...notes,
        spaceKey: 'DOCS',
      })
    ).body;
    expect(published.notesPage).toMatchObject({ title: notes.title, spaceKey: 'DOCS' });
    const again = (
      await admin.request<Release>('POST', `/projects/WEB/releases/${version.id}/notes`, {
        title: notes.title,
        markdown: `${notes.markdown}\n\nNachtrag.`,
      })
    ).body;
    expect(again.notesPage?.id).toBe(published.notesPage?.id);
    const page = (await admin.request<Page>('GET', `/pages/${again.notesPage?.id}`)).body;
    expect(page.version).toBe(2);
  });
});
