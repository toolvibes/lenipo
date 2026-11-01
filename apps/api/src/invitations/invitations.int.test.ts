import type { Invitation, InvitationPreview, Me, ProjectMember } from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { Mailer, type MailMessage } from '../notifications/mailer.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
const sent: MailMessage[] = [];
const tokenIn = (mail: MailMessage | undefined) =>
  /token=([A-Za-z0-9_-]+)/.exec(mail?.text ?? '')?.[1] ?? '';

beforeAll(async () => {
  test = await startTestApp({
    SMTP_URL: 'smtp://127.0.0.1:1',
    PUBLIC_URL: 'https://lenipo.example.org',
  });
  test.app.get(Mailer).transport = {
    sendMail: async (message) => {
      sent.push(message);
    },
  };
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Team-Lenipo',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
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

describe('invitations (P-USR-15, TL-67)', () => {
  it('invites into a project; the person sets name and password and lands there', async () => {
    const invited = await admin.request<Invitation>('POST', '/invitations', {
      email: 'Jonas@Example.org',
      projectKey: 'web',
      role: 'developers',
    });
    expect(invited.body).toMatchObject({
      email: 'jonas@example.org',
      project: { key: 'WEB' },
      role: 'developers',
    });
    const mail = sent.at(-1);
    expect(mail?.subject).toBe('Einladung zu Team-Lenipo');
    const token = tokenIn(mail);
    const preview = await new TestClient(test.baseUrl).request<InvitationPreview>(
      'GET',
      `/invitations/preview?token=${token}`,
    );
    expect(preview.body).toMatchObject({
      email: 'jonas@example.org',
      invitedBy: 'Lena Vogt',
      project: { name: 'Web' },
    });

    const jonas = new TestClient(test.baseUrl);
    const accepted = await jonas.request<{ projectKey: string }>('POST', '/invitations/accept', {
      token,
      displayName: 'Jonas Berg',
      password: 'ein-langes-passwort',
    });
    expect(accepted.body).toEqual({ projectKey: 'WEB' });
    expect((await jonas.request<Me>('GET', '/me')).body.displayName).toBe('Jonas Berg');
    const members = (await admin.request<ProjectMember[]>('GET', '/projects/WEB/members')).body;
    expect(JSON.stringify(members)).toContain('Jonas Berg');
    // A link works once.
    expect(
      (
        await new TestClient(test.baseUrl).request('POST', '/invitations/accept', {
          token,
          displayName: 'X',
          password: 'ein-langes-passwort',
        })
      ).status,
    ).toBe(410);
  });

  it('lets only administrators invite, and can be withdrawn', async () => {
    expect(
      (await mira.request('POST', '/invitations', { email: 'x@example.org', projectKey: 'WEB' }))
        .status,
    ).toBe(403);
    expect((await mira.request('POST', '/invitations', { email: 'x@example.org' })).status).toBe(
      403,
    );
    const invited = (
      await admin.request<Invitation>('POST', '/invitations', { email: 'olaf@example.org' })
    ).body;
    const token = tokenIn(sent.at(-1));
    expect((await admin.request('DELETE', `/invitations/${invited.id}`)).status).toBe(204);
    expect(
      (await new TestClient(test.baseUrl).request('GET', `/invitations/preview?token=${token}`))
        .status,
    ).toBe(410);
    const list = (await admin.request<Invitation[]>('GET', '/admin/invitations')).body;
    expect(list.find((entry) => entry.id === invited.id)?.revokedAt).not.toBeNull();
    expect(
      (await admin.request<Invitation[]>('GET', '/projects/WEB/invitations')).body,
    ).toHaveLength(1);
  });

  it('adds existing accounts to the project at once', async () => {
    await admin.request('POST', '/invitations', {
      email: 'mira@example.org',
      projectKey: 'WEB',
      role: 'users',
    });
    expect(sent.at(-1)?.subject).toBe('[Team-Lenipo] Neu im Projekt Web');
    const members = (await admin.request<ProjectMember[]>('GET', '/projects/WEB/members')).body;
    expect(JSON.stringify(members)).toContain('Mira Kaya');
  });
});

describe('self-registration (P-USR-15)', () => {
  it('is off by default and then open only to listed domains', async () => {
    const anonymous = new TestClient(test.baseUrl);
    expect(
      (await anonymous.request('POST', '/auth/register', { email: 'neu@firma.example' })).status,
    ).toBe(400);
    await admin.request('PUT', '/admin/registration-settings', {
      enabled: true,
      domains: ['firma.example'],
    });
    expect(
      (await anonymous.request('POST', '/auth/register', { email: 'neu@andere.example' })).status,
    ).toBe(400);
    expect(
      (await anonymous.request('POST', '/auth/register', { email: 'neu@firma.example' })).status,
    ).toBe(202);
    const mail = sent.at(-1);
    expect(mail?.subject).toBe('Registrierung bei Team-Lenipo');
    const preview = (
      await anonymous.request<InvitationPreview>(
        'GET',
        `/invitations/preview?token=${tokenIn(mail)}`,
      )
    ).body;
    expect(preview.registration).toBe(true);
    const accepted = await anonymous.request('POST', '/invitations/accept', {
      token: tokenIn(mail),
      displayName: 'Neu Person',
      password: 'ein-langes-passwort',
    });
    expect(accepted.status).toBe(200);
    expect((await anonymous.request<Me>('GET', '/me')).body.email).toBe('neu@firma.example');
  });
});
