import type { Me, RecoveryCodes, SecuritySettings, TwoFactorSetup } from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { SetupService } from './setup.service.js';
import { currentStep, totpCode } from './totp.js';

let test: TestApp;
let admin: TestClient;
const ids: Record<string, string> = {};
let secret = '';
let codes: string[] = [];

async function signIn(email: string): Promise<{ client: TestClient; me: Me }> {
  const client = new TestClient(test.baseUrl);
  const me = (
    await client.request<Me>('POST', '/auth/login', { email, password: 'ein-langes-passwort' })
  ).body;
  return { client, me };
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
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('two-factor sign-in and sessions (TL-18)', () => {
  it('is set up with an app code and gives recovery codes once', async () => {
    const { client, me } = await signIn('mira@example.org');
    expect(me.twoFactor).toEqual({
      enabled: false,
      required: false,
      pending: null,
      recoveryCodesLeft: 0,
    });
    const setup = (await client.request<TwoFactorSetup>('POST', '/me/2fa/setup')).body;
    secret = setup.secret;
    expect(setup.uri).toContain('otpauth://totp/');
    expect((await client.request('POST', '/me/2fa/enable', { code: '000000' })).status).toBe(400);
    const enabled = await client.request<RecoveryCodes>('POST', '/me/2fa/enable', {
      code: totpCode(secret, currentStep()),
    });
    expect(enabled.status).toBe(200);
    codes = enabled.body.codes;
    expect(codes).toHaveLength(10);
  });

  it('asks for the second factor after the password', async () => {
    const { client, me } = await signIn('mira@example.org');
    expect(me.twoFactor.pending).toBe('verify');
    // Nothing else works before the code.
    expect((await client.request('GET', '/projects')).status).toBe(403);
    expect((await client.request('POST', '/auth/2fa', { code: '123456' })).status).toBe(401);
    const verified = await client.request<Me>('POST', '/auth/2fa', { code: codes[0] });
    expect(verified.status).toBe(200);
    expect(verified.body.twoFactor).toMatchObject({ pending: null, recoveryCodesLeft: 9 });
    expect((await client.request('GET', '/projects')).status).toBe(200);
    // A recovery code works only once.
    const again = await signIn('mira@example.org');
    expect((await again.client.request('POST', '/auth/2fa', { code: codes[0] })).status).toBe(401);
  });

  it('makes members of chosen groups set it up first', async () => {
    await admin.request('POST', '/admin/groups', {
      name: 'betrieb',
      description: '',
      globalPermissions: [],
    });
    await admin.request('POST', '/admin/groups/betrieb/members', {
      userId: ids['olaf@example.org'],
    });
    const settings = (await admin.request<SecuritySettings>('GET', '/admin/security-settings'))
      .body;
    const groups = (
      await admin.request<Array<{ id: string; name: string }>>('GET', '/admin/groups')
    ).body;
    const betrieb = groups.find((group) => group.name === 'betrieb')?.id ?? '';
    const saved = await admin.request<SecuritySettings>('PUT', '/admin/security-settings', {
      ...settings,
      twoFactorGroupIds: [betrieb],
    });
    expect(saved.status).toBe(200);

    const { client, me } = await signIn('olaf@example.org');
    expect(me.twoFactor).toMatchObject({ required: true, pending: 'setup' });
    expect((await client.request('GET', '/projects')).status).toBe(403);
    const setup = (await client.request<TwoFactorSetup>('POST', '/me/2fa/setup')).body;
    await client.request('POST', '/me/2fa/enable', { code: totpCode(setup.secret, currentStep()) });
    expect((await client.request('GET', '/projects')).status).toBe(200);
    // Required means it cannot be turned off.
    expect((await client.request('POST', '/me/2fa/disable', { code: '000000' })).status).toBe(409);
  });

  it('lets administrators reset two-factor sign-in and end sessions', async () => {
    expect(
      (await admin.request('DELETE', `/admin/users/${ids['mira@example.org']}/2fa`)).status,
    ).toBe(204);
    const { client, me } = await signIn('mira@example.org');
    expect(me.twoFactor).toMatchObject({ enabled: false, pending: null });
    const other = await signIn('mira@example.org');
    expect((await client.request('DELETE', '/me/sessions')).status).toBe(204);
    expect((await other.client.request('GET', '/me')).status).toBe(401);
    expect((await client.request('GET', '/me')).status).toBe(200);
    expect(
      (await admin.request('DELETE', `/admin/users/${ids['mira@example.org']}/sessions`)).status,
    ).toBe(204);
    expect((await client.request('GET', '/me')).status).toBe(401);
  });
});
