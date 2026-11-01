import type { Me, ProjectMember, SpaceMember, UserSummary } from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Mailer, type MailMessage } from '../notifications/mailer.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { SetupService } from './setup.service.js';

let test: TestApp;
let admin: TestClient;
const sent: MailMessage[] = [];
const tokenIn = (mail: MailMessage | undefined) =>
  /token=([A-Za-z0-9_-]+)/.exec(mail?.text ?? '')?.[1] ?? '';

async function signIn(email: string): Promise<TestClient> {
  const client = new TestClient(test.baseUrl);
  const response = await client.request('POST', '/auth/login', {
    email,
    password: 'ein-langes-passwort',
  });
  if (response.status !== 200) throw new Error(`Login failed for ${email}`);
  return client;
}

beforeAll(async () => {
  test = await startTestApp({ SMTP_URL: 'smtp://127.0.0.1:1' });
  test.app.get(Mailer).transport = {
    sendMail: async (message) => {
      sent.push(message);
    },
  };
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  await admin.request('POST', '/projects', { key: 'OPS', name: 'Betrieb', template: 'basic' });
  await admin.request('POST', '/spaces', { key: 'WEBDOC', name: 'Web-Doku', projectKey: 'WEB' });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('external collaborators (TL-66, TL-68)', () => {
  it('see only the projects and spaces they are given', async () => {
    const created = await admin.request<UserSummary>('POST', '/admin/users', {
      email: 'kunde@example.org',
      displayName: 'Karla Kunde',
      password: 'ein-langes-passwort',
      external: true,
    });
    expect(created.body).toMatchObject({ external: true, groups: [] });
    const kunde = await signIn('kunde@example.org');

    expect((await kunde.request<Me>('GET', '/me')).body.globalPermissions).toEqual([]);
    expect((await kunde.request<unknown[]>('GET', '/projects')).body).toEqual([]);
    expect((await kunde.request('GET', '/users?query=lena')).status).toBe(403);
    expect(
      (await kunde.request('POST', '/projects', { key: 'NEU', name: 'Neu', template: 'basic' }))
        .status,
    ).toBe(403);
    expect((await kunde.request('POST', '/spaces', { key: 'NEU', name: 'Neu' })).status).toBe(403);

    // Into one project, with its linked space at the matching level.
    const members = await admin.request<ProjectMember[]>('POST', '/projects/WEB/members', {
      role: 'users',
      userId: created.body.id,
      shareSpace: true,
    });
    expect(members.body.find((member) => member.user?.id === created.body.id)).toMatchObject({
      external: true,
    });
    const projects = (await kunde.request<Array<{ key: string }>>('GET', '/projects')).body;
    expect(projects.map((project) => project.key)).toEqual(['WEB']);
    const spaceMembers = await admin.request<SpaceMember[]>('GET', '/spaces/WEBDOC/members');
    expect(spaceMembers.body.find((member) => member.user?.id === created.body.id)?.role).toBe(
      'commenters',
    );

    // Back to a regular account and out again.
    const internal = await admin.request<UserSummary>(
      'POST',
      `/admin/users/${created.body.id}/external`,
      { external: false },
    );
    expect(internal.body).toMatchObject({ external: false, groups: ['users'] });
    const external = await admin.request<UserSummary>(
      'POST',
      `/admin/users/${created.body.id}/external`,
      { external: true },
    );
    expect(external.body).toMatchObject({ external: true, groups: [] });
  });

  it('can be invited into one project as external', async () => {
    const invited = await admin.request('POST', '/invitations', {
      email: 'gast@example.org',
      projectKey: 'WEB',
      role: 'developers',
      external: true,
      shareSpace: true,
    });
    expect(invited.status).toBe(201);
    const gast = new TestClient(test.baseUrl);
    const accepted = await gast.request('POST', '/invitations/accept', {
      token: tokenIn(sent.at(-1)),
      displayName: 'Gerd Gast',
      password: 'ein-langes-passwort',
    });
    expect(accepted.status).toBe(200);
    const users = (await admin.request<UserSummary[]>('GET', '/admin/users')).body;
    expect(users.find((user) => user.email === 'gast@example.org')).toMatchObject({
      external: true,
      groups: [],
    });
    const projects = (await gast.request<Array<{ key: string }>>('GET', '/projects')).body;
    expect(projects.map((project) => project.key)).toEqual(['WEB']);
    const spaceMembers = await admin.request<SpaceMember[]>('GET', '/spaces/WEBDOC/members');
    expect(spaceMembers.body.find((member) => member.user?.displayName === 'Gerd Gast')?.role).toBe(
      'editors',
    );
  });
});
