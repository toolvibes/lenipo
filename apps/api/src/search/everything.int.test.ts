import type { EverythingResult, Page } from '@toolvibes/shared';
import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { issueAttachments, issues } from '../db/schema/index.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { snippet } from './everything.service.js';

let test: TestApp;
let admin: TestClient;
let outsider: TestClient;

const doc = (...paragraphs: string[]) => ({
  type: 'doc',
  content: paragraphs.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
});

async function find(client: TestClient, query: string): Promise<EverythingResult> {
  const response = await client.request<EverythingResult>(
    'GET',
    `/search/everything?${new URLSearchParams({ q: query }).toString()}`,
  );
  expect(response.status).toBe(200);
  return response.body;
}

async function page(spaceKey: string, title: string, parentId?: string, ...text: string[]) {
  const created = await admin.request<Page>('POST', `/spaces/${spaceKey}/pages`, {
    title,
    parentId,
  });
  if (text.length > 0) {
    await admin.request('POST', `/pages/${created.body.id}/publish`, {
      title,
      content: doc(...text),
    });
  }
  return created.body;
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
  const olaf = await admin.request<{ id: string }>('POST', '/admin/users', {
    email: 'olaf@example.org',
    displayName: 'Olaf Außen',
    password: 'ein-langes-passwort',
  });
  await admin.request('DELETE', `/admin/groups/users/members/${olaf.body.id}`);
  outsider = new TestClient(test.baseUrl);
  await outsider.request('POST', '/auth/login', {
    email: 'olaf@example.org',
    password: 'ein-langes-passwort',
  });

  await admin.request('POST', '/projects', { key: 'ATL', name: 'Atlas', template: 'scrum' });
  await admin.request('POST', '/projects', { key: 'KMP', name: 'Kompass', template: 'kanban' });
  for (const [projectKey, summary, description] of [
    ['ATL', 'Offline-Sync für Mobilgeräte', null],
    ['ATL', 'Konflikte anzeigen', 'Beim Synchronisieren entstehen Konflikte.'],
    ['ATL', 'Login reparieren', null],
    ['KMP', 'Offline-Karten laden', null],
  ] as const) {
    await admin.request('POST', '/issues', {
      projectKey,
      issueType: 'task',
      summary,
      description: description ? { markdown: description } : null,
    });
  }
  await admin.request('POST', '/spaces', { key: 'ATLAS', name: 'Atlas-Doku' });
  await admin.request('PATCH', '/spaces/ATLAS', { projectKey: 'ATL' });
  await admin.request('POST', '/spaces', { key: 'TEAM', name: 'Team-Handbuch' });
  const architecture = await page('ATLAS', 'Architektur', undefined, 'Grundlagen');
  await page(
    'ATLAS',
    'Offline-Sync: Architektur',
    architecture.id,
    'Wie Atlas Änderungen ohne Verbindung speichert.',
    'Die Synchronisierung nutzt eine lokale Warteschlange.',
  );
  await page('TEAM', 'Retro 13', undefined, 'Die erste Synchronisierung lief ohne Datenverlust.');
  // Never published: drafts are not searched.
  await page('TEAM', 'Entwurf zur Synchronisierung');
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('global search', () => {
  it('finds issues, published pages, projects and spaces with counts', async () => {
    const result = await find(admin, 'Synchronisierung');
    expect(result.counts).toEqual({ issue: 1, page: 2, project: 0, space: 0 });
    expect(result.issues.map((issue) => issue.key)).toEqual(['ATL-2']);
    expect(result.pages.map((hit) => hit.title).sort()).toEqual([
      'Offline-Sync: Architektur',
      'Retro 13',
    ]);
    const hit = result.pages.find((entry) => entry.title === 'Retro 13');
    expect(hit?.space).toEqual({ key: 'TEAM', name: 'Team-Handbuch' });
    expect(hit?.snippet.some((part) => part.hit && /Synchronisierung/.test(part.text))).toBe(true);
    const nested = result.pages.find((entry) => entry.title === 'Offline-Sync: Architektur');
    expect(nested?.parentTitle).toBe('Architektur');
  });

  it('matches the last word as a prefix and stems German words', async () => {
    expect((await find(admin, 'Offline-Sy')).issues.map((issue) => issue.key)).toEqual(['ATL-1']);
    const typing = await find(admin, 'offl');
    expect(typing.issues.map((issue) => issue.key).sort()).toEqual(['ATL-1', 'KMP-1']);
    // "Konflikt" finds "Konflikte" through the German stemmer.
    expect((await find(admin, 'Konflikt')).issues.map((issue) => issue.key)).toEqual(['ATL-2']);
    expect((await find(admin, 'atl')).counts.project).toBe(1);
    expect((await find(admin, 'handbuch')).spaces.map((space) => space.key)).toEqual(['TEAM']);
  });

  it('finds an issue by its key and puts it first', async () => {
    const result = await find(admin, 'atl-3');
    expect(result.issues[0]?.key).toBe('ATL-3');
  });

  it('understands quotes and -word', async () => {
    const result = await find(admin, 'offline -karten');
    expect(result.issues.map((issue) => issue.key)).toEqual(['ATL-1']);
  });

  it('narrows to one project and its Wiki', async () => {
    const response = await admin.request<EverythingResult>(
      'GET',
      '/search/everything?q=Synchronisierung&project=ATL',
    );
    expect(response.body.counts).toEqual({ issue: 1, page: 1, project: 0, space: 0 });
    const pagesOnly = await admin.request<EverythingResult>(
      'GET',
      '/search/everything?q=Synchronisierung&type=page',
    );
    expect(pagesOnly.body.issues).toEqual([]);
    expect(pagesOnly.body.pages).toHaveLength(2);
    expect(pagesOnly.body.counts.issue).toBe(1);
  });

  it('shows nothing the caller may not see', async () => {
    const result = await find(outsider, 'Synchronisierung');
    expect(result.counts).toEqual({ issue: 0, page: 0, project: 0, space: 0 });
  });

  it('finds issues and pages through comments and attachment names (TL-3)', async () => {
    await admin.request('POST', '/issues/ATL-3/comments', {
      body: { markdown: 'Ohne Tresorschlüssel geht offline nichts.' },
    });
    const retro = (await find(admin, 'Retro')).pages[0];
    await admin.request('POST', `/pages/${retro?.id}/comments`, {
      body: { markdown: 'Den Tresorschlüssel bitte rotieren.' },
    });
    const [issue] = await test.database.db
      .select({ id: issues.id })
      .from(issues)
      .where(eq(issues.key, 'KMP-1'));
    await test.database.db.insert(issueAttachments).values({
      id: uuidv7(),
      issueId: issue?.id ?? '',
      fileName: 'tresor-protokoll.pdf',
      contentType: 'application/pdf',
      size: 1,
      sha256: 'x',
      storageKey: `test/${uuidv7()}`,
    });

    const result = await find(admin, 'Tresorschlüssel');
    expect(result.counts).toMatchObject({ issue: 1, page: 1 });
    expect(result.issues[0]).toMatchObject({
      key: 'ATL-3',
      match: { in: 'comment', author: 'Lena Vogt' },
    });
    expect(result.issues[0]?.match?.snippet.some((part) => part.hit)).toBe(true);
    expect(result.pages[0]).toMatchObject({ title: 'Retro 13', match: { in: 'comment' } });
    const files = await find(admin, 'tresor-protokoll');
    expect(files.issues.map((hit) => [hit.key, hit.match?.in])).toEqual([['KMP-1', 'attachment']]);
    // Hits in the issue itself come before hits only in a comment.
    const offline = await find(admin, 'offline');
    expect(
      offline.issues
        .map((hit) => hit.key)
        .slice(0, 2)
        .sort(),
    ).toEqual(['ATL-1', 'KMP-1']);
    expect(offline.issues[2]).toMatchObject({ key: 'ATL-3', match: { in: 'comment' } });
    expect(offline.issues[0]?.match).toBeUndefined();
    expect((await find(outsider, 'Tresorschlüssel')).counts.issue).toBe(0);
  });
});

describe('snippet', () => {
  it('splits headline output at the hit marks', () => {
    expect(snippet('Die \u0001Sync\u0002 läuft')).toEqual([
      { text: 'Die ', hit: false },
      { text: 'Sync', hit: true },
      { text: ' läuft', hit: false },
    ]);
  });
});
