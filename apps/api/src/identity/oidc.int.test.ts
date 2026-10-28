import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditLog, users } from '../db/schema/index.js';
import { startTestApp, type TestApp } from '../test/harness.js';
import { GroupService } from './group.service.js';
import { OidcService } from './oidc.service.js';
import { PasswordService } from './password.service.js';
import { UserService } from './user.service.js';

const ISSUER = 'https://login.example.org/realms/tasklore';

let test: TestApp;
let oidc: OidcService;
let userService: UserService;

beforeAll(async () => {
  test = await startTestApp({ OIDC_GROUPS_CLAIM: 'groups' });
  oidc = test.app.get(OidcService);
  userService = test.app.get(UserService);
  const groups = test.app.get(GroupService);
  await groups.ensureBuiltIns();
  await groups.create({
    name: 'team-plattform',
    description: '',
    globalPermissions: ['create-projects'],
  });
  await userService.create({
    email: 'lena.vogt@example.org',
    displayName: 'Lena Vogt',
    passwordHash: await test.app.get(PasswordService).hash('ein-langes-passwort'),
    groupNames: ['users'],
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

async function groupsOf(userId: string): Promise<string[]> {
  return (await userService.list()).find((user) => user.id === userId)?.groups ?? [];
}

describe('OIDC account resolution', () => {
  it('creates an account for an unknown person and grants groups from the claim', async () => {
    const userId = await oidc.resolveUser(
      ISSUER,
      {
        sub: 'kc-1',
        email: 'Mira.Kaya@example.org',
        email_verified: true,
        name: 'Mira Kaya',
        groups: ['/team-plattform', '/unknown'],
      },
      null,
    );
    const [user] = await test.database.db.select().from(users).where(eq(users.id, userId));
    expect(user?.email).toBe('mira.kaya@example.org');
    expect(user?.passwordHash).toBeNull();
    expect(await groupsOf(userId)).toEqual(['team-plattform', 'users']);
  });

  it('recognises the same identity on the next sign-in', async () => {
    const first = await oidc.resolveUser(
      ISSUER,
      { sub: 'kc-1', email: 'mira.kaya@example.org', email_verified: true },
      null,
    );
    const second = await oidc.resolveUser(
      ISSUER,
      { sub: 'kc-1', email: 'mira.kaya@example.org', email_verified: true },
      null,
    );
    expect(second).toBe(first);
  });

  it('links an existing account when the provider verified the email', async () => {
    const [lena] = await test.database.db
      .select()
      .from(users)
      .where(eq(users.email, 'lena.vogt@example.org'));
    const userId = await oidc.resolveUser(
      ISSUER,
      { sub: 'kc-2', email: 'lena.vogt@example.org', email_verified: true },
      null,
    );
    expect(userId).toBe(lena?.id);
  });

  it('refuses to take over an account through an unverified email', async () => {
    await expect(
      oidc.resolveUser(
        ISSUER,
        { sub: 'kc-3', email: 'lena.vogt@example.org', email_verified: false },
        null,
      ),
    ).rejects.toThrow(/did not verify/);
  });

  it('treats the same subject from another issuer as a different identity', async () => {
    const other = await oidc.resolveUser(
      'https://other.example.org',
      { sub: 'kc-1', email: 'mira@other.example.org', email_verified: true },
      null,
    );
    const [mira] = await test.database.db
      .select()
      .from(users)
      .where(eq(users.email, 'mira.kaya@example.org'));
    expect(other).not.toBe(mira?.id);
  });

  it('rejects deactivated accounts', async () => {
    await test.database.db
      .update(users)
      .set({ status: 'deactivated' })
      .where(eq(users.email, 'mira.kaya@example.org'));
    await expect(
      oidc.resolveUser(
        ISSUER,
        { sub: 'kc-1', email: 'mira.kaya@example.org', email_verified: true },
        null,
      ),
    ).rejects.toThrow(/deactivated/);
  });

  it('records account creation and linking in the audit log', async () => {
    const actions = (
      await test.database.db.select({ action: auditLog.action, via: auditLog.via }).from(auditLog)
    ).filter((row) => row.via === 'oidc');
    expect(actions.map((row) => row.action)).toEqual(
      expect.arrayContaining(['user.created', 'user.identity_linked']),
    );
  });
});
