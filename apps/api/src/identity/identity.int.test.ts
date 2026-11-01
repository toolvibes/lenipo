import type {
  CreatedToken,
  GroupSummary,
  Me,
  Problem,
  SessionInfo,
  UserSummary,
} from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditLog } from '../db/schema/index.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { SESSION_COOKIE } from './secrets.js';
import { SessionService } from './session.service.js';
import { SetupService } from './setup.service.js';
import { UserService } from './user.service.js';

const ADMIN = {
  email: 'Lena.Vogt@example.org',
  displayName: 'Lena Vogt',
  password: 'korrekt-pferd-batterie',
};

let test: TestApp;
let admin: TestClient;
let setupCode: string;

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  if (!code) throw new Error('Expected a setup code on a fresh database');
  setupCode = code;
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('first-run setup', () => {
  it('reports that setup is required on a fresh installation', async () => {
    const response = await admin.request<{ required: boolean }>('GET', '/setup/status');
    expect(response.body).toEqual({ required: true });
  });

  it('rejects a wrong setup code', async () => {
    const response = await admin.request<Problem>('POST', '/setup', {
      token: 'AAAA-BBBB-CCCC-DDDD',
      instanceName: 'Test',
      admin: ADMIN,
    });
    expect(response.status).toBe(403);
    expect(response.body.type).toBe('urn:lenipo:problem:setup-code');
  });

  it('validates the request body', async () => {
    const response = await admin.request<Problem>('POST', '/setup', {
      token: setupCode,
      instanceName: 'Test',
      admin: { ...ADMIN, password: 'kurz' },
    });
    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(response.body.errors?.['admin.password']).toBeDefined();
  });

  it('creates the first administrator and signs them in', async () => {
    const response = await admin.request<Me>('POST', '/setup', {
      token: setupCode.toLowerCase().replaceAll('-', ' '),
      instanceName: 'Lenipo Test',
      admin: ADMIN,
    });
    expect(response.status).toBe(201);
    expect(response.body.email).toBe('lena.vogt@example.org');
    expect(response.body.globalPermissions).toContain('system-admin');
    expect(admin.cookie).toMatch(/^lp_session=/);
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/i);
  });

  it('cannot run a second time', async () => {
    const status = await admin.request<{ required: boolean }>('GET', '/setup/status');
    expect(status.body.required).toBe(false);
    const response = await admin.request('POST', '/setup', {
      token: setupCode,
      instanceName: 'Again',
      admin: { ...ADMIN, email: 'other@example.org' },
    });
    expect(response.status).toBe(409);
  });
});

describe('sessions', () => {
  it('returns the signed-in user', async () => {
    const response = await admin.request<Me>('GET', '/me');
    expect(response.status).toBe(200);
    expect(response.body.authenticatedVia).toBe('session');
  });

  it('requires authentication', async () => {
    const response = await new TestClient(test.baseUrl).request<Problem>('GET', '/me');
    expect(response.status).toBe(401);
  });

  it('rejects a wrong password without revealing whether the email exists', async () => {
    const client = new TestClient(test.baseUrl);
    const wrongPassword = await client.request<Problem>('POST', '/auth/login', {
      email: ADMIN.email,
      password: 'falsch-falsch-falsch',
    });
    const unknownEmail = await client.request<Problem>('POST', '/auth/login', {
      email: 'niemand@example.org',
      password: 'falsch-falsch-falsch',
    });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.detail).toBe(unknownEmail.body.detail);
  });

  it('signs in with email in any case, lists and ends sessions', async () => {
    const second = new TestClient(test.baseUrl);
    const login = await second.request<Me>('POST', '/auth/login', {
      email: 'LENA.VOGT@example.org',
      password: ADMIN.password,
    });
    expect(login.status).toBe(200);

    const sessions = await admin.request<SessionInfo[]>('GET', '/me/sessions');
    expect(sessions.body).toHaveLength(2);
    const other = sessions.body.find((session) => !session.current);
    if (!other) throw new Error('Expected a second session');

    expect((await admin.request('DELETE', `/me/sessions/${other.id}`)).status).toBe(204);
    expect((await second.request('GET', '/me')).status).toBe(401);
  });

  it('ends the session on logout', async () => {
    const client = new TestClient(test.baseUrl);
    await client.request('POST', '/auth/login', { email: ADMIN.email, password: ADMIN.password });
    const sessionCookie = client.cookie;
    expect((await client.request('POST', '/auth/logout')).status).toBe(204);
    expect(
      (await client.request('GET', '/me', undefined, { cookie: sessionCookie ?? '' })).status,
    ).toBe(401);
  });

  it('rejects cross-site writes that carry the session cookie', async () => {
    const response = await admin.request<Problem>(
      'POST',
      '/me/tokens',
      { name: 'csrf', scopes: ['issues:read'], expiresInDays: 1 },
      { 'sec-fetch-site': 'cross-site' },
    );
    expect(response.status).toBe(403);
    const foreignOrigin = await admin.request('POST', '/auth/logout', undefined, {
      origin: 'https://evil.example',
    });
    expect(foreignOrigin.status).toBe(403);
  });
});

describe('personal access tokens', () => {
  let token: CreatedToken;

  it('creates a token and shows the secret once', async () => {
    const response = await admin.request<CreatedToken>('POST', '/me/tokens', {
      name: 'CLI auf dem Laptop',
      scopes: ['issues:read', 'issues:write'],
      expiresInDays: 30,
    });
    expect(response.status).toBe(201);
    token = response.body;
    expect(token.secret).toMatch(/^lp_pat_[A-Za-z0-9_-]{43}$/);
    expect(token.prefix).toBe(token.secret.slice(0, 11));

    const list = await admin.request<Array<Record<string, unknown>>>('GET', '/me/tokens');
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).not.toHaveProperty('secret');
  });

  it('authenticates API calls with the token', async () => {
    const client = new TestClient(test.baseUrl, { authorization: `Bearer ${token.secret}` });
    const me = await client.request<Me>('GET', '/me');
    expect(me.status).toBe(200);
    expect(me.body.authenticatedVia).toBe('token');
  });

  it('does not let a token mint further tokens or reach admin routes without the admin scope', async () => {
    const client = new TestClient(test.baseUrl, { authorization: `Bearer ${token.secret}` });
    expect(
      (
        await client.request('POST', '/me/tokens', {
          name: 'x',
          scopes: ['admin'],
          expiresInDays: 1,
        })
      ).status,
    ).toBe(403);
    expect((await client.request('GET', '/admin/users')).status).toBe(403);
  });

  it('stops working once revoked', async () => {
    expect((await admin.request('DELETE', `/me/tokens/${token.id}`)).status).toBe(204);
    const client = new TestClient(test.baseUrl, { authorization: `Bearer ${token.secret}` });
    expect((await client.request('GET', '/me')).status).toBe(401);
  });

  it('rejects unknown tokens', async () => {
    const client = new TestClient(test.baseUrl, { authorization: 'Bearer tl_pat_unknown' });
    expect((await client.request('GET', '/me')).status).toBe(401);
  });
});

describe('administration', () => {
  let member: TestClient;
  let memberId: string;

  it('lets an administrator create users and groups', async () => {
    const created = await admin.request<UserSummary>('POST', '/admin/users', {
      email: 'jonas.schulz@example.org',
      displayName: 'Jonas Schulz',
      password: 'noch-ein-langes-passwort',
    });
    expect(created.status).toBe(201);
    expect(created.body.groups).toEqual(['users']);
    memberId = created.body.id;

    const duplicate = await admin.request('POST', '/admin/users', {
      email: 'Jonas.Schulz@example.org',
      displayName: 'Doppelt',
      password: 'noch-ein-langes-passwort',
    });
    expect(duplicate.status).toBe(409);

    const group = await admin.request<GroupSummary>('POST', '/admin/groups', {
      name: 'team-plattform',
      description: 'Team Plattform',
      globalPermissions: ['create-projects'],
    });
    expect(group.status).toBe(201);
    expect(
      (await admin.request('POST', '/admin/groups/team-plattform/members', { userId: memberId }))
        .status,
    ).toBe(204);

    const groups = await admin.request<GroupSummary[]>('GET', '/admin/groups');
    expect(groups.body.find((entry) => entry.name === 'team-plattform')?.memberCount).toBe(1);
  });

  it('gives members the permissions of their groups, and nothing more', async () => {
    member = new TestClient(test.baseUrl);
    await member.request('POST', '/auth/login', {
      email: 'jonas.schulz@example.org',
      password: 'noch-ein-langes-passwort',
    });
    const me = await member.request<Me>('GET', '/me');
    expect(me.body.globalPermissions).toEqual(['browse-users', 'create-projects', 'share-filters']);
    expect((await member.request('GET', '/admin/users')).status).toBe(403);
  });

  it('shows system information to administrators only', async () => {
    const info = await admin.request<{ version: string; migrationsApplied: number; users: number }>(
      'GET',
      '/admin/system',
    );
    expect(info.status).toBe(200);
    expect(info.body.migrationsApplied).toBeGreaterThanOrEqual(3);
    expect(info.body.users).toBe(2);
    expect((await member.request('GET', '/admin/system')).status).toBe(403);
  });

  it('writes security events to the audit log', async () => {
    const rows = await test.database.db.select({ action: auditLog.action }).from(auditLog);
    const actions = rows.map((row) => row.action);
    for (const action of [
      'setup.completed',
      'auth.login',
      'auth.login_failed',
      'auth.logout',
      'token.created',
      'token.revoked',
      'user.created',
      'group.created',
      'group.member_added',
      'session.revoked',
    ]) {
      expect(actions).toContain(action);
    }
  });
});

describe('password change and attempt limits (TL-59)', () => {
  const signIn = async (email: string, password: string) => {
    const client = new TestClient(test.baseUrl);
    const response = await client.request('POST', '/auth/login', { email, password });
    return { client, status: response.status };
  };

  it('changes the password with the current one and ends the other sessions', async () => {
    await admin.request('POST', '/admin/users', {
      email: 'ayse@example.org',
      displayName: 'Ayşe Demir',
      password: 'erstes-langes-passwort',
    });
    const here = (await signIn('ayse@example.org', 'erstes-langes-passwort')).client;
    const elsewhere = (await signIn('ayse@example.org', 'erstes-langes-passwort')).client;
    const token = await here.request<CreatedToken>('POST', '/me/tokens', {
      name: 'Skript',
      scopes: ['issues:read'],
      expiresInDays: 30,
    });
    expect((await here.request<Me>('GET', '/me')).body.hasPassword).toBe(true);

    const wrong = await here.request<Problem>('POST', '/me/password', {
      currentPassword: 'falsch',
      newPassword: 'zweites-langes-passwort',
    });
    expect(wrong.status).toBe(403);
    expect(
      (
        await here.request('POST', '/me/password', {
          currentPassword: 'erstes-langes-passwort',
          newPassword: 'kurz',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await here.request('POST', '/me/password', {
          currentPassword: 'erstes-langes-passwort',
          newPassword: 'erstes-langes-passwort',
        })
      ).status,
    ).toBe(409);

    const changed = await here.request<{ endedSessions: number }>('POST', '/me/password', {
      currentPassword: 'erstes-langes-passwort',
      newPassword: 'zweites-langes-passwort',
    });
    expect(changed.status).toBe(200);
    expect(changed.body.endedSessions).toBe(1);
    expect((await here.request('GET', '/me')).status).toBe(200);
    expect((await elsewhere.request('GET', '/me')).status).toBe(401);
    // Access tokens are separate credentials and keep working.
    const viaToken = await fetch(`${test.baseUrl}/me`, {
      headers: { authorization: `Bearer ${token.body.secret}` },
    });
    expect(viaToken.status).toBe(200);
    expect((await signIn('ayse@example.org', 'erstes-langes-passwort')).status).toBe(401);
    expect((await signIn('ayse@example.org', 'zweites-langes-passwort')).status).toBe(200);
    // Not with a token, even one of the person.
    const tokenChange = await fetch(`${test.baseUrl}/me/password`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token.body.secret}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'zweites-langes-passwort',
        newPassword: 'drittes-langes-passwort',
      }),
    });
    expect(tokenChange.status).toBe(403);
  });

  it('stops guessing after ten failures, at the login and at the password change', async () => {
    await admin.request('POST', '/admin/users', {
      email: 'gast@example.org',
      displayName: 'Gast',
      password: 'richtiges-langes-passwort',
    });
    const inside = (await signIn('gast@example.org', 'richtiges-langes-passwort')).client;
    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await signIn('gast@example.org', `falsch-${attempt}`)).status).toBe(401);
      expect(
        (
          await inside.request('POST', '/me/password', {
            currentPassword: `falsch-${attempt}`,
            newPassword: 'neues-langes-passwort',
          })
        ).status,
      ).toBe(403);
    }
    // Ten failures in all: now even the right password is refused for a while.
    const blocked = await signIn('gast@example.org', 'richtiges-langes-passwort');
    expect(blocked.status).toBe(429);
    const change = await inside.request<Problem>('POST', '/me/password', {
      currentPassword: 'richtiges-langes-passwort',
      newPassword: 'neues-langes-passwort',
    });
    expect(change.status).toBe(429);
    expect(change.body.type).toBe('urn:lenipo:problem:too-many-attempts');
    // Other people are not affected.
    expect((await signIn('ayse@example.org', 'zweites-langes-passwort')).status).toBe(200);
  });

  it('refuses accounts that only sign in through OIDC', async () => {
    const id = await test.app.get(UserService).create({
      email: 'nur-oidc@example.org',
      displayName: 'Nur OIDC',
      passwordHash: null,
      groupNames: [],
    });
    const session = await test.app.get(SessionService).create(id, 'oidc', {});
    const client = new TestClient(test.baseUrl);
    client.cookie = `${SESSION_COOKIE}=${session.secret}`;
    expect((await client.request<Me>('GET', '/me')).body.hasPassword).toBe(false);
    const change = await client.request('POST', '/me/password', {
      currentPassword: 'irgendwas',
      newPassword: 'neues-langes-passwort',
    });
    expect(change.status).toBe(409);
  });
});
