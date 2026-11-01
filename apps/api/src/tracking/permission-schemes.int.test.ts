import type {
  PermissionGrantInput,
  PermissionScheme,
  PermissionSchemeSummary,
  ProjectDetails,
  ProjectSummary,
  UserRef,
} from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let customer: TestClient;
let auditor: TestClient;
let ids: Record<string, string> = {};
let scheme: PermissionScheme;

async function signIn(email: string): Promise<TestClient> {
  const client = new TestClient(test.baseUrl);
  await client.request('POST', '/auth/login', { email, password: 'ein-langes-passwort' });
  return client;
}

const visible = async (client: TestClient) =>
  (await client.request<ProjectSummary[]>('GET', '/projects')).body.map((project) => project.key);

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
    ['kunde@example.org', 'Karl Kunde'],
    ['pruefer@example.org', 'Paula Prüfer'],
  ]) {
    await admin.request('POST', '/admin/users', {
      email,
      displayName,
      password: 'ein-langes-passwort',
    });
  }
  const people = (await admin.request<Array<{ id: string; email: string }>>('GET', '/admin/users'))
    .body;
  ids = Object.fromEntries(people.map((person) => [person.email, person.id]));
  // Both are outsiders: no project through the "users" group.
  for (const email of ['kunde@example.org', 'pruefer@example.org']) {
    await admin.request('DELETE', `/admin/groups/users/members/${ids[email]}`);
  }
  customer = await signIn('kunde@example.org');
  auditor = await signIn('pruefer@example.org');
  await admin.request('POST', '/projects', { key: 'APP', name: 'Kunden-App', template: 'scrum' });
  await admin.request('POST', '/projects/APP/members', {
    role: 'users',
    userId: ids['kunde@example.org'],
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('permission schemes (TL-70)', () => {
  it('start with the default scheme holding the former rights', async () => {
    const list = (
      await admin.request<PermissionSchemeSummary[]>('GET', '/admin/permission-schemes')
    ).body;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: 'Standard', isDefault: true });
    expect(list[0]?.projects.map((project) => project.key)).toEqual(['APP']);
    const standard = (
      await admin.request<PermissionScheme>('GET', `/admin/permission-schemes/${list[0]?.id}`)
    ).body;
    const users = standard.grants
      .filter((grant) => grant.role === 'users')
      .map((g) => g.permission);
    expect(users.sort()).toEqual(['browse', 'comment', 'create-issues']);
    expect((await customer.request('GET', '/admin/permission-schemes')).status).toBe(403);
  });

  it('copy, edit and assign a scheme: roles, groups and single people', async () => {
    const created = await admin.request<PermissionScheme>('POST', '/admin/permission-schemes', {
      name: 'Kunden',
      description: 'Kunden lesen und kommentieren',
    });
    expect(created.status).toBe(201);
    expect(created.body.grants.length).toBeGreaterThan(10);
    const grants: PermissionGrantInput[] = [
      ...created.body.grants
        .filter((grant) => grant.grantee === 'role' && grant.role !== 'users')
        .map((grant) => ({ permission: grant.permission, role: grant.role as 'developers' })),
      { permission: 'browse', role: 'users' },
      { permission: 'comment', role: 'users' },
      // An auditor reads along without any role.
      { permission: 'browse', userId: ids['pruefer@example.org'] as string },
    ];
    scheme = (
      await admin.request<PermissionScheme>(
        'PATCH',
        `/admin/permission-schemes/${created.body.id}`,
        {
          grants,
        },
      )
    ).body;
    expect(scheme.grants).toHaveLength(grants.length);
    expect(
      (await customer.request('PUT', '/projects/APP/permission-scheme', { schemeId: scheme.id }))
        .status,
    ).toBe(403);
    expect(
      (await admin.request('PUT', '/projects/APP/permission-scheme', { schemeId: scheme.id }))
        .status,
    ).toBe(204);
    expect(
      (await admin.request<ProjectDetails>('GET', '/projects/APP')).body.permissionScheme.name,
    ).toBe('Kunden');

    // The customer still sees and comments, but no longer creates issues.
    const issue = await admin.request<{ key: string }>('POST', '/issues', {
      projectKey: 'APP',
      issueType: 'task',
      summary: 'Login',
    });
    expect(
      (
        await customer.request('POST', '/issues', {
          projectKey: 'APP',
          issueType: 'task',
          summary: 'Wunsch',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await customer.request('POST', `/issues/${issue.body.key}/comments`, {
          body: { markdown: 'Passt' },
        })
      ).status,
    ).toBe(201);
    // The auditor sees the project through the personal grant, and can be found in it.
    expect(await visible(auditor)).toEqual(['APP']);
    expect(
      (
        await auditor.request('POST', `/issues/${issue.body.key}/comments`, {
          body: { markdown: 'Gelesen' },
        })
      ).status,
    ).toBe(403);
    const people = (await admin.request<UserRef[]>('GET', '/projects/APP/users?query=Paula')).body;
    expect(people.map((person) => person.displayName)).toEqual(['Paula Prüfer']);
  });

  it('give the reporter and the assignee rights on their own issues only (TL-72)', async () => {
    const base = scheme.grants.flatMap((grant): PermissionGrantInput[] =>
      grant.grantee === 'role'
        ? [{ permission: grant.permission, role: grant.role as 'users' }]
        : grant.grantee === 'user'
          ? [{ permission: grant.permission, userId: grant.user?.id as string }]
          : [],
    );
    const patch = (grants: PermissionGrantInput[]) =>
      admin.request<PermissionScheme>('PATCH', `/admin/permission-schemes/${scheme.id}`, {
        grants,
      });
    // Seeing, creating and administering stay project rights.
    for (const permission of ['browse', 'create-issues', 'administer']) {
      const grant = { permission, grantee: 'reporter' } as unknown as PermissionGrantInput;
      expect((await patch([...base, grant])).status).toBe(400);
    }
    const updated = await patch([
      ...base,
      { permission: 'create-issues', role: 'users' },
      { permission: 'edit-issues', grantee: 'reporter' },
      { permission: 'transition-issues', grantee: 'assignee' },
      { permission: 'edit-issues', grantee: 'assignee' },
    ]);
    expect(updated.body.grants.filter((grant) => grant.grantee === 'reporter')).toHaveLength(1);

    const own = await customer.request<{ key: string; canEdit: boolean }>('POST', '/issues', {
      projectKey: 'APP',
      issueType: 'task',
      summary: 'Mein Wunsch',
    });
    expect(own.status).toBe(201);
    const other = await admin.request<{ key: string }>('POST', '/issues', {
      projectKey: 'APP',
      issueType: 'task',
      summary: 'Fremd',
    });
    const read = async (key: string) =>
      (
        await customer.request<{ canEdit: boolean; canTransition: boolean }>(
          'GET',
          `/issues/${key}`,
        )
      ).body;
    expect(await read(own.body.key)).toMatchObject({ canEdit: true, canTransition: false });
    expect(await read(other.body.key)).toMatchObject({ canEdit: false, canTransition: false });
    expect(
      (await customer.request('PATCH', `/issues/${own.body.key}`, { summary: 'Mein Wunsch, klar' }))
        .status,
    ).toBe(200);
    expect(
      (await customer.request('PATCH', `/issues/${other.body.key}`, { summary: 'Meins' })).status,
    ).toBe(403);

    // Assigned to the customer, the other issue moves on, and is editable through the assignee.
    await admin.request('PATCH', `/issues/${other.body.key}`, {
      assigneeId: ids['kunde@example.org'],
    });
    expect(await read(other.body.key)).toMatchObject({ canEdit: true, canTransition: true });
    const transitions = (
      await admin.request<Array<{ id: string }>>('GET', `/issues/${other.body.key}/transitions`)
    ).body;
    expect(
      (
        await customer.request('POST', `/issues/${other.body.key}/transitions`, {
          transitionId: transitions[0]?.id,
        })
      ).status,
    ).toBe(200);
    // The auditor sees the project only through a personal grant; as assignee that is enough.
    await admin.request('PATCH', `/issues/${other.body.key}`, {
      assigneeId: ids['pruefer@example.org'],
    });
    expect(
      (await auditor.request<{ canEdit: boolean }>('GET', `/issues/${other.body.key}`)).body
        .canEdit,
    ).toBe(true);
  });

  it('keep the default scheme and schemes in use', async () => {
    const list = (
      await admin.request<PermissionSchemeSummary[]>('GET', '/admin/permission-schemes')
    ).body;
    const standard = list.find((entry) => entry.isDefault);
    expect(
      (await admin.request('DELETE', `/admin/permission-schemes/${standard?.id}`)).status,
    ).toBe(409);
    expect((await admin.request('DELETE', `/admin/permission-schemes/${scheme.id}`)).status).toBe(
      409,
    );
    await admin.request('PUT', '/projects/APP/permission-scheme', { schemeId: null });
    expect(await visible(auditor)).toEqual([]);
    expect((await admin.request('DELETE', `/admin/permission-schemes/${scheme.id}`)).status).toBe(
      204,
    );
    expect(
      (await admin.request('POST', '/admin/permission-schemes', { name: 'Standard' })).status,
    ).toBe(409);
  });
});
