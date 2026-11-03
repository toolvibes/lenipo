import type { InvitationPreview, Me, ProvisionResult } from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

const SETUP_TOKEN = 'bereitstellung-0123456789abcdefghijklmnop';
let test: TestApp;
let provider: TestClient;

beforeAll(async () => {
  test = await startTestApp({ SETUP_TOKEN, PUBLIC_URL: 'https://acme.lenipo.example' });
  provider = new TestClient(test.baseUrl);
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('setup by a provider (TL-102)', () => {
  const body = { instanceName: 'Acme', admin: { email: 'Chefin@Acme.example' } };
  let link = '';

  it('needs the SETUP_TOKEN of the instance', async () => {
    expect((await provider.request('POST', '/setup/provision', body)).status).toBe(403);
    expect(
      (
        await provider.request('POST', '/setup/provision', body, {
          authorization: 'Bearer falsches-token-0123456789abcdefghijkl',
        })
      ).status,
    ).toBe(403);
  });

  it('names the instance and invites the first administrator', async () => {
    const first = await provider.request<ProvisionResult>('POST', '/setup/provision', body, {
      authorization: `Bearer ${SETUP_TOKEN}`,
    });
    expect(first.status).toBe(201);
    // Asking again replaces the open invitation.
    const again = await provider.request<ProvisionResult>('POST', '/setup/provision', body, {
      authorization: `Bearer ${SETUP_TOKEN}`,
    });
    link = again.body.link;
    expect(link).toMatch(/^https:\/\/acme\.lenipo\.example\/invite\?token=/);
    const oldToken = new URL(first.body.link).searchParams.get('token') ?? '';
    expect(
      (await provider.request('GET', `/invitations/preview?token=${encodeURIComponent(oldToken)}`))
        .status,
    ).toBe(410);
    const token = new URL(link).searchParams.get('token') ?? '';
    const preview = await provider.request<InvitationPreview>(
      'GET',
      `/invitations/preview?token=${encodeURIComponent(token)}`,
    );
    expect(preview.body).toMatchObject({
      email: 'chefin@acme.example',
      instanceName: 'Acme',
      setup: true,
    });
  });

  it('makes the person who accepts the administrator and ends setup', async () => {
    const person = new TestClient(test.baseUrl);
    const token = new URL(link).searchParams.get('token') ?? '';
    const accepted = await person.request('POST', '/invitations/accept', {
      token,
      displayName: 'Clara Chefin',
      password: 'ein-langes-passwort',
    });
    expect(accepted.status).toBeLessThan(300);
    const me = (await person.request<Me>('GET', '/me')).body;
    expect(me.globalPermissions).toContain('admin');
    expect((await person.request<{ required: boolean }>('GET', '/setup/status')).body).toEqual({
      required: false,
    });
    expect(
      (
        await provider.request('POST', '/setup/provision', body, {
          authorization: `Bearer ${SETUP_TOKEN}`,
        })
      ).status,
    ).toBe(409);
  });
});
