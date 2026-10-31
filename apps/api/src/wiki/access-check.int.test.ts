import type { AccessCheckResult, Issue, Page, SecurityScheme } from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
const ids: Record<string, string> = {};

async function check(body: object): Promise<AccessCheckResult> {
  const response = await admin.request<AccessCheckResult>('POST', '/admin/access-check', body);
  expect(response.status).toBe(200);
  return response.body;
}

const codes = (result: AccessCheckResult) =>
  result.steps.map((step) => `${step.code}:${step.passed}`);

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  for (const [email, displayName] of [
    ['mira@example.org', 'Mira Kaya'],
    ['olaf@example.org', 'Olaf Alt'],
  ] as const) {
    ids[email] = (
      await admin.request<{ id: string }>('POST', '/admin/users', {
        email,
        displayName,
        password: 'ein-langes-passwort',
      })
    ).body.id;
  }
  mira = new TestClient(test.baseUrl);
  await mira.request('POST', '/auth/login', {
    email: 'mira@example.org',
    password: 'ein-langes-passwort',
  });
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  await admin.request('POST', '/projects/WEB/members', {
    role: 'developers',
    userId: ids['mira@example.org'],
  });
  await admin.request('POST', '/projects/WEB/members', {
    role: 'users',
    userId: ids['olaf@example.org'],
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('access check (TL-15)', () => {
  it('is for global administrators only', async () => {
    const denied = await mira.request('POST', '/admin/access-check', {
      user: 'olaf@example.org',
      projectKey: 'WEB',
    });
    expect(denied.status).toBe(403);
  });

  it('explains project permissions through roles and scheme grants', async () => {
    const miraEdits = await check({
      user: 'mira@example.org',
      projectKey: 'WEB',
      permission: 'edit-issues',
    });
    expect(miraEdits.granted).toBe(true);
    expect(codes(miraEdits)).toContain('role:null');
    expect(miraEdits.steps.find((step) => step.code === 'grant')?.params.grantee).toBe(
      'role:developers',
    );
    const olafEdits = await check({
      user: 'olaf@example.org',
      projectKey: 'WEB',
      permission: 'edit-issues',
    });
    expect(olafEdits.granted).toBe(false);
    expect(codes(olafEdits)).toContain('no-grant:false');
  });

  it('names the issue security level that hides an issue', async () => {
    const scheme = (
      await admin.request<SecurityScheme>('POST', '/admin/security-schemes', { name: 'Intern' })
    ).body;
    const levels = (
      await admin.request<SecurityScheme>('PATCH', `/admin/security-schemes/${scheme.id}`, {
        levels: [{ name: 'Nur Entwicklung', grants: [{ role: 'developers' }] }],
      })
    ).body.levels;
    await admin.request('PUT', '/projects/WEB/security-scheme', { schemeId: scheme.id });
    const secret = (
      await mira.request<Issue>('POST', '/issues', {
        projectKey: 'WEB',
        issueType: 'task',
        summary: 'Geheim',
      })
    ).body;
    await admin.request('PATCH', `/issues/${secret.key}`, { securityLevelId: levels[0]?.id });
    const olaf = await check({ user: 'olaf@example.org', issueKey: secret.key });
    expect(olaf.granted).toBe(false);
    expect(olaf.steps.at(-1)).toMatchObject({
      code: 'security',
      passed: false,
      params: { level: 'Nur Entwicklung' },
    });
    // Global administrators pass the scheme but not the level.
    const lena = await check({ user: 'lena@example.org', issueKey: secret.key });
    expect(codes(lena)).toEqual(expect.arrayContaining(['global-admin:true', 'security:false']));
    expect(lena.granted).toBe(false);
  });

  it('explains space roles and page restrictions', async () => {
    await admin.request('POST', '/spaces', { key: 'DOCS', name: 'Doku' });
    await admin.request('POST', '/spaces/DOCS/members', {
      role: 'viewers',
      userId: ids['olaf@example.org'],
    });
    const page = (await admin.request<Page>('POST', '/spaces/DOCS/pages', { title: 'Plan' })).body;
    await admin.request('POST', `/pages/${page.id}/publish`, {
      title: 'Plan',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    });
    const open = await check({ user: 'olaf@example.org', pageId: page.id });
    expect(open.granted).toBe(true);
    // Olaf holds a role directly and, through everyone's group, maybe another.
    expect(codes(open)).toContain('space-role:null');
    expect(codes(open).at(-1)).toBe('space-permission:true');
    await admin.request('PUT', `/pages/${page.id}/restrictions`, {
      view: { userIds: [ids['mira@example.org']], groupIds: [] },
      edit: { userIds: [], groupIds: [] },
    });
    const closed = await check({ user: 'olaf@example.org', pageId: page.id });
    expect(closed.granted).toBe(false);
    expect(closed.steps.at(-1)).toMatchObject({ code: 'page-view', passed: false });
    const edit = await check({
      user: 'olaf@example.org',
      spaceKey: 'DOCS',
      spacePermission: 'administer',
    });
    expect(edit.granted).toBe(false);
    expect(codes(edit)).toContain('space-permission:false');
  });
});
