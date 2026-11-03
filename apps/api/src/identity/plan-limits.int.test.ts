import type { Agent, FeatureFlags, ProviderUsage } from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

const SETUP_TOKEN = 'bereitstellung-0123456789abcdefghijklmnop';
const provider = { authorization: `Bearer ${SETUP_TOKEN}` };
let test: TestApp;
let admin: TestClient;
let anonymous: TestClient;

beforeAll(async () => {
  test = await startTestApp({ SETUP_TOKEN });
  admin = new TestClient(test.baseUrl);
  anonymous = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Acme',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

const person = (email: string, external = false) =>
  admin.request('POST', '/admin/users', {
    email,
    displayName: email.split('@')[0],
    password: 'ein-langes-passwort',
    external,
  });

describe('plan limits of a provider (TL-103)', () => {
  it('limits nothing without a provider and needs its token', async () => {
    expect((await admin.request<ProviderUsage>('GET', '/admin/plan')).body).toMatchObject({
      persons: 1,
      agents: 0,
      limits: null,
    });
    expect((await anonymous.request('GET', '/provider/usage')).status).toBe(403);
    expect((await admin.request('PUT', '/provider/limits', { persons: 2 })).status).toBe(403);
  });

  it('keeps seats, agents, modules and service desks within the plan', async () => {
    const set = await anonymous.request<ProviderUsage>(
      'PUT',
      '/provider/limits',
      { plan: 'Team', persons: 2, agents: 0, modules: ['boards', 'wiki'], serviceDesk: false },
      provider,
    );
    expect(set.status).toBe(200);
    expect(set.body).toMatchObject({
      persons: 1,
      modules: ['wiki', 'boards'],
      limits: { plan: 'Team', persons: 2, agents: 0, storageMb: null },
    });
    expect((await person('mia@example.org')).status).toBe(201);
    const full = await person('max@example.org');
    expect(full.status).toBe(403);
    expect(full.body).toMatchObject({
      type: 'urn:lenipo:problem:plan-limit',
      detail: 'All 2 seats of the plan are taken',
    });
    // Guests take no seat; inviting a regular person says at once that the seats are taken.
    expect((await person('gast@partner.example', true)).status).toBe(201);
    expect((await admin.request('POST', '/invitations', { email: 'neu@example.org' })).status).toBe(
      403,
    );
    expect(
      (
        await admin.request<Agent>('POST', '/agents', {
          displayName: 'Claude',
          vendor: 'Claude Code',
        })
      ).status,
    ).toBe(403);
    // Modules outside the plan were switched off and stay off.
    const flags = (await admin.request<FeatureFlags>('GET', '/admin/feature-flags')).body;
    expect(flags).toMatchObject({ wiki: true, boards: true, automation: false, dashboards: false });
    expect(
      (await admin.request('PUT', '/admin/feature-flags', { ...flags, automation: true })).status,
    ).toBe(403);
    expect(
      (
        await admin.request('PUT', '/projects/WEB/service-desk', {
          customerAccess: 'everyone',
          intro: '',
          firstResponseHours: {},
          resolutionHours: {},
          pauseStatusIds: [],
          timeZone: 'Europe/Berlin',
        dayStartHour: 8,
        })
      ).status,
    ).toBe(403);
  });

  it('lets more in once the plan grows, and reports the use', async () => {
    await anonymous.request(
      'PUT',
      '/provider/limits',
      { plan: 'Business', persons: 5, agents: 2, storageMb: 1 },
      provider,
    );
    expect((await person('max@example.org')).status).toBe(201);
    expect(
      (await admin.request('POST', '/agents', { displayName: 'Claude', vendor: 'Claude Code' }))
        .status,
    ).toBe(201);
    const usage = await anonymous.request<ProviderUsage>(
      'GET',
      '/provider/usage',
      undefined,
      provider,
    );
    expect(usage.body).toMatchObject({ persons: 3, agents: 1, serviceDesks: 0, storageMb: 0 });
    expect(
      (await anonymous.request('DELETE', '/provider/limits', undefined, provider)).status,
    ).toBe(204);
    expect((await admin.request<ProviderUsage>('GET', '/admin/plan')).body.limits).toBeNull();
  });
});
