import type { Board, Me, OnboardingResult, Page, ProjectDetails, Space } from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('POST', '/admin/users', {
    email: 'mira@example.org',
    displayName: 'Mira Kaya',
    password: 'ein-langes-passwort',
  });
  mira = new TestClient(test.baseUrl);
  await mira.request('POST', '/auth/login', {
    email: 'mira@example.org',
    password: 'ein-langes-passwort',
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('profile', () => {
  it('changes name, language and time zone', async () => {
    const updated = await mira.request<Me>('PATCH', '/me', {
      displayName: 'Mira K.',
      locale: 'en',
      timeZone: 'America/New_York',
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      displayName: 'Mira K.',
      locale: 'en',
      timeZone: 'America/New_York',
    });
    expect((await mira.request('PATCH', '/me', { timeZone: 'Mars/Olympus' })).status).toBe(400);
    expect((await mira.request('PATCH', '/me', { locale: 'fr' })).status).toBe(400);
  });

  it('switches the keyboard shortcuts off and on again (TL-7)', async () => {
    expect((await mira.request<Me>('GET', '/me')).body.keyboardShortcuts).toBe(true);
    const off = await mira.request<Me>('PATCH', '/me', { keyboardShortcuts: false });
    expect(off.body.keyboardShortcuts).toBe(false);
    expect((await mira.request<Me>('GET', '/me')).body).toMatchObject({
      keyboardShortcuts: false,
      displayName: 'Mira K.',
    });
    expect((await mira.request('PATCH', '/me', { keyboardShortcuts: 'nein' })).status).toBe(400);
    await mira.request('PATCH', '/me', { keyboardShortcuts: true });
  });
});

describe('welcome steps', () => {
  it('are pending for new people', async () => {
    expect((await admin.request<Me>('GET', '/me')).body.onboarded).toBe(false);
    expect((await mira.request<Me>('GET', '/me')).body.onboarded).toBe(false);
  });

  it('create a Scrum project with board, Lore space and start page in one go', async () => {
    const result = await admin.request<OnboardingResult>('POST', '/me/onboarding', {
      profile: { displayName: 'Lena V.', timeZone: 'Europe/Vienna' },
      start: { method: 'scrum', name: 'Atlas', key: 'ATL' },
    });
    expect(result.status).toBe(200);
    expect(result.body.spaceKey).toBe('ATL');
    expect(result.body.boardId).toBeTruthy();

    const me = (await admin.request<Me>('GET', '/me')).body;
    expect(me).toMatchObject({
      onboarded: true,
      displayName: 'Lena V.',
      timeZone: 'Europe/Vienna',
    });
    const project = (await admin.request<ProjectDetails>('GET', '/projects/ATL')).body;
    expect(project.template).toBe('scrum');
    expect(project.permissions).toContain('administer');
    const board = (await admin.request<Board>('GET', `/boards/${result.body.boardId}`)).body;
    expect(board.type).toBe('scrum');
    expect(board.columns.map((column) => column.name)).toEqual([
      'Offen',
      'In Arbeit',
      'Review',
      'Erledigt',
    ]);
    const space = (await admin.request<Space>('GET', '/spaces/ATL')).body;
    expect(space.project?.key).toBe('ATL');
    expect(space.homePageId).toBeTruthy();
    const home = (await admin.request<Page>('GET', `/pages/${space.homePageId}`)).body;
    expect(home).toMatchObject({ title: 'Willkommen bei Atlas', version: 1 });
    // Everyone in "users" may work in it, as with any new project.
    expect((await mira.request('GET', '/projects/ATL')).status).toBe(200);
  });

  it('roll back completely when the key is taken', async () => {
    const taken = await admin.request('POST', '/me/onboarding', {
      start: { method: 'kanban', name: 'Noch ein Atlas', key: 'ATL' },
    });
    expect(taken.status).toBe(409);
    const spaces = (await admin.request<Space[]>('GET', '/spaces')).body;
    expect(spaces.map((space) => space.key)).toEqual(['ATL']);
  });

  it('can create only a Lore space', async () => {
    const result = await admin.request<OnboardingResult>('POST', '/me/onboarding', {
      start: { method: 'lore', name: 'Handbuch', key: 'HB' },
    });
    expect(result.body).toEqual({ boardId: null, spaceKey: 'HB' });
    expect((await admin.request('GET', '/projects/HB')).status).toBe(404);
  });

  it('need the permission to create projects, and can be skipped', async () => {
    const denied = await mira.request('POST', '/me/onboarding', {
      start: { method: 'kanban', name: 'Mein Projekt', key: 'MIR' },
    });
    expect(denied.status).toBe(403);
    expect((await mira.request<Me>('GET', '/me')).body.onboarded).toBe(false);
    const skipped = await mira.request<OnboardingResult>('POST', '/me/onboarding', {});
    expect(skipped.body).toEqual({ boardId: null, spaceKey: null });
    expect((await mira.request<Me>('GET', '/me')).body.onboarded).toBe(true);
  });
});
