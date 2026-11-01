import type { ProjectMember, ProjectSummary } from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let customer: TestClient;
let customerId: string;
let mira: TestClient;

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
    ['mira@example.org', 'Mira Kaya'],
  ]) {
    await admin.request('POST', '/admin/users', {
      email,
      displayName,
      password: 'ein-langes-passwort',
    });
  }
  const people = (await admin.request<Array<{ id: string; email: string }>>('GET', '/admin/users'))
    .body;
  customerId = people.find((person) => person.email === 'kunde@example.org')?.id ?? '';
  // An external customer: not in the "users" group, so no project at all by default.
  await admin.request('DELETE', `/admin/groups/users/members/${customerId}`);
  customer = await signIn('kunde@example.org');
  mira = await signIn('mira@example.org');
  for (const [key, name] of [
    ['APP', 'Kunden-App'],
    ['INT', 'Intern'],
  ]) {
    await admin.request('POST', '/projects', { key, name, template: 'scrum' });
  }
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('project members (TL-65)', () => {
  it('give an outside person exactly one project', async () => {
    expect(await visible(customer)).toEqual([]);
    const added = await admin.request<ProjectMember[]>('POST', '/projects/APP/members', {
      role: 'users',
      userId: customerId,
    });
    expect(added.status).toBe(201);
    expect(
      added.body.map((member) => [member.role, member.user?.displayName ?? member.group?.name]),
    ).toEqual(
      expect.arrayContaining([
        ['administrators', 'Lena Vogt'],
        ['users', 'Karl Kunde'],
        ['users', 'users'],
      ]),
    );
    expect(await visible(customer)).toEqual(['APP']);
    // The "users" role may create and comment, but not edit.
    const issue = await customer.request<{ key: string }>('POST', '/issues', {
      projectKey: 'APP',
      issueType: 'task',
      summary: 'Fehler im Login',
    });
    expect(issue.status).toBe(201);
    expect(
      (await customer.request('PATCH', `/issues/${issue.body.key}`, { summary: 'Anders' })).status,
    ).toBe(403);
    expect((await customer.request('GET', '/projects/INT')).status).toBe(404);
  });

  it('refuse duplicates, strangers and losing the last administrator', async () => {
    expect(
      (await admin.request('POST', '/projects/APP/members', { role: 'users', userId: customerId }))
        .status,
    ).toBe(409);
    expect((await mira.request('GET', '/projects/APP/members')).status).toBe(403);
    expect((await customer.request('GET', '/projects/APP/members')).status).toBe(403);
    expect(
      (
        await admin.request('POST', '/projects/APP/members', {
          role: 'users',
          userId: '01a00000-0000-7000-8000-000000000000',
        })
      ).status,
    ).toBe(400);
    const members = (await admin.request<ProjectMember[]>('GET', '/projects/APP/members')).body;
    const lastAdmin = members.find((member) => member.role === 'administrators');
    expect((await admin.request('DELETE', `/projects/APP/members/${lastAdmin?.id}`)).status).toBe(
      409,
    );
  });

  it('give and take roles to groups and people', async () => {
    const groups = (
      await admin.request<Array<{ id: string; name: string }>>('GET', '/admin/groups')
    ).body;
    const usersGroup = groups.find((group) => group.name === 'users');
    const developers = await admin.request<ProjectMember[]>('POST', '/projects/INT/members', {
      role: 'developers',
      groupId: usersGroup?.id,
    });
    expect(developers.status).toBe(201);
    // Mira now edits in INT through her group.
    const issue = await mira.request<{ key: string }>('POST', '/issues', {
      projectKey: 'INT',
      issueType: 'task',
      summary: 'Intern',
    });
    expect(
      (await mira.request('PATCH', `/issues/${issue.body.key}`, { summary: 'Intern 2' })).status,
    ).toBe(200);

    const customerRole = (
      await admin.request<ProjectMember[]>('GET', '/projects/APP/members')
    ).body.find((member) => member.user?.id === customerId);
    expect(
      (await admin.request('DELETE', `/projects/APP/members/${customerRole?.id}`)).status,
    ).toBe(204);
    expect(await visible(customer)).toEqual([]);
  });
});
