import type { InactiveProject, ProjectDetails, ProjectSummary } from '@toolvibes/shared';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { issues, projectRoleMembers } from '../db/schema/index.js';
import { SetupService } from '../identity/setup.service.js';
import { RetentionService } from '../maintenance/retention.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;

const DAY = 86_400_000;
const listed = async (client: TestClient) =>
  (await client.request<ProjectSummary[]>('GET', '/projects')).body.map((project) => project.key);
const inactive = async (client: TestClient) =>
  (await client.request<InactiveProject[]>('GET', '/projects/inactive')).body;

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  const miraId = (
    await admin.request<{ id: string }>('POST', '/admin/users', {
      email: 'mira@example.org',
      displayName: 'Mira Kaya',
      password: 'ein-langes-passwort',
    })
  ).body.id;
  mira = new TestClient(test.baseUrl);
  await mira.request('POST', '/auth/login', {
    email: 'mira@example.org',
    password: 'ein-langes-passwort',
  });
  const old = (
    await admin.request<ProjectDetails>('POST', '/projects', {
      key: 'OLD',
      name: 'Altes Projekt',
      template: 'scrum',
    })
  ).body;
  await test.database.db
    .insert(projectRoleMembers)
    .values({ id: uuidv7(), projectId: old.id, role: 'developers', userId: miraId });
  await admin.request('POST', '/issues', { projectKey: 'OLD', issueType: 'task', summary: 'Eins' });
  await admin.request('POST', '/spaces', { key: 'OLD', name: 'Altes Wiki' });
  await admin.request('PATCH', '/spaces/OLD', { projectKey: 'OLD' });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('archiving a project (E-164)', () => {
  it('is for project administrators only', async () => {
    expect((await mira.request('POST', '/projects/OLD/archive', {})).status).toBe(403);
    expect((await mira.request('POST', '/projects/OLD/delete', {})).status).toBe(403);
  });

  it('hides the project, keeps its wiki unless asked, and lists it for its administrators', async () => {
    expect((await admin.request('POST', '/projects/OLD/archive', {})).status).toBe(204);
    expect(await listed(mira)).not.toContain('OLD');
    expect((await mira.request('GET', '/projects/OLD')).status).toBe(404);
    expect((await mira.request('GET', '/issues/OLD-1')).status).toBe(404);
    expect((await admin.request('GET', '/spaces/OLD')).status).toBe(200);
    expect(await inactive(mira)).toEqual([]);
    const [entry] = await inactive(admin);
    expect(entry).toMatchObject({
      key: 'OLD',
      deletedAt: null,
      purgeAt: null,
      spaces: [{ key: 'OLD', name: 'Altes Wiki', inactive: false }],
    });
    expect((await admin.request('POST', '/projects/OLD/archive', {})).status).toBe(409);
  });

  it('comes back on restore', async () => {
    const restored = await admin.request<ProjectDetails>('POST', '/projects/OLD/restore', {});
    expect(restored.status).toBe(200);
    expect(await listed(mira)).toContain('OLD');
    expect(await inactive(admin)).toEqual([]);
  });

  it('takes the linked wiki space along when asked, both ways', async () => {
    await admin.request('POST', '/projects/OLD/archive', { spaces: true });
    expect((await admin.request('GET', '/spaces/OLD')).status).toBe(404);
    expect((await inactive(admin))[0]?.spaces).toEqual([
      { key: 'OLD', name: 'Altes Wiki', inactive: true },
    ]);
    await admin.request('POST', '/projects/OLD/restore', { spaces: true });
    expect((await admin.request('GET', '/spaces/OLD')).status).toBe(200);
    expect((await mira.request('GET', '/issues/OLD-1')).status).toBe(200);
  });
});

describe('deleting a project (E-164)', () => {
  it('moves it into the trash with a date when it goes for good, and restores from there', async () => {
    expect((await admin.request('POST', '/projects/OLD/delete', { spaces: true })).status).toBe(
      204,
    );
    const [entry] = await inactive(admin);
    expect(entry?.deletedAt).not.toBeNull();
    const purgeIn =
      new Date(entry?.purgeAt ?? 0).getTime() - new Date(entry?.deletedAt ?? 0).getTime();
    expect(Math.round(purgeIn / DAY)).toBe(30);
    expect((await admin.request('GET', '/spaces/OLD')).status).toBe(404);
    await admin.request('POST', '/projects/OLD/restore', { spaces: true });
    expect(await listed(admin)).toContain('OLD');
    expect((await admin.request('GET', '/spaces/OLD')).status).toBe(200);
  });

  it('is gone with its issues and wiki once the trash days have passed; the key is free again', async () => {
    await admin.request('POST', '/projects/OLD/delete', { spaces: true });
    const retention = test.app.get(RetentionService);
    // Not yet: still in the trash.
    expect((await retention.run(new Date(Date.now() + 10 * DAY))).projects).toBe(0);
    const result = await retention.run(new Date(Date.now() + 31 * DAY));
    expect(result).toMatchObject({ projects: 1, spaces: 1 });
    expect(await inactive(admin)).toEqual([]);
    expect(await test.database.db.select().from(issues)).toEqual([]);
    const again = await admin.request('POST', '/projects', {
      key: 'OLD',
      name: 'Neu',
      template: 'basic',
    });
    expect(again.status).toBe(201);
  });
});
