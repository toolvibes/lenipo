import type { AdminToken, CreatedToken, InstanceNotice } from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { MemoryCounter, ValkeyCounter } from './counter.js';

let test: TestApp;
let admin: TestClient;

const DEFAULTS = { people: 600, tokens: 300, anonymous: 60 };

async function signIn(email: string) {
  const client = new TestClient(test.baseUrl);
  const response = await client.request('POST', '/auth/login', {
    email,
    password: 'ein-langes-passwort',
  });
  return { client, status: response.status };
}

beforeAll(async () => {
  test = await startTestApp({ RATE_LIMITS: 'true', IMPRINT_URL: 'https://example.org/impressum' });
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('POST', '/admin/users', {
    email: 'jonas@example.org',
    displayName: 'Jonas Schulz',
    password: 'ein-langes-passwort',
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('request limits (TL-40)', () => {
  it('limits anonymous requests per IP and says so in headers', async () => {
    await admin.request('PUT', '/admin/rate-limits', { ...DEFAULTS, anonymous: 3 });
    const anonymous = new TestClient(test.baseUrl);
    // Earlier anonymous requests of this run (setup) count in the same window.
    const answers = [];
    for (let n = 0; n < 5; n += 1) answers.push(await anonymous.request('GET', '/instance/notice'));
    const refused = answers.find((answer) => answer.status === 429);
    expect(answers.at(-1)?.status).toBe(429);
    expect(answers.filter((answer) => answer.status === 200).length).toBeLessThanOrEqual(3);
    expect(refused?.headers.get('ratelimit-limit')).toBe('3');
    expect(refused?.headers.get('ratelimit-remaining')).toBe('0');
    expect(Number(refused?.headers.get('retry-after'))).toBeGreaterThan(0);
    // Health checks are not counted.
    const origin = test.baseUrl.replace(/\/api\/v1$/, '');
    expect((await fetch(`${origin}/health/live`)).status).not.toBe(429);
    await admin.request('PUT', '/admin/rate-limits', DEFAULTS);
  });

  it('applies per-token limits and a daily quota', async () => {
    const token = (
      await admin.request<CreatedToken>('POST', '/me/tokens', {
        name: 'Skript',
        scopes: ['issues:read'],
        expiresInDays: 1,
      })
    ).body;
    const list = (await admin.request<AdminToken[]>('GET', '/admin/tokens')).body;
    const id = list.find((entry) => entry.name === 'Skript')?.id as string;
    expect(
      (await admin.request('PUT', `/admin/tokens/${id}/limits`, { perMinute: null, perDay: 2 }))
        .status,
    ).toBe(200);
    const bot = new TestClient(test.baseUrl, { authorization: `Bearer ${token.secret}` });
    const statuses = [];
    for (let n = 0; n < 3; n += 1) statuses.push((await bot.request('GET', '/projects')).status);
    expect(statuses).toEqual([200, 200, 429]);
    const after = (await admin.request<AdminToken[]>('GET', '/admin/tokens')).body;
    expect(after.find((entry) => entry.id === id)).toMatchObject({
      limits: { perMinute: null, perDay: 2 },
      usedToday: 3,
    });
    await admin.request('PUT', `/admin/tokens/${id}/limits`, { perMinute: 1, perDay: null });
    const minute = await bot.request<{ type: string }>('GET', '/projects');
    expect(minute.status).toBe(429);
    expect(minute.body.type).toBe('urn:lenipo:problem:rate-limit');
  });

  it('counts in memory and, when configured, in Valkey', async () => {
    const memory = new MemoryCounter();
    expect([
      await memory.hit('a', 60),
      await memory.hit('a', 60),
      await memory.hit('b', 60),
    ]).toEqual([1, 2, 1]);
    await memory.close();
    const url = process.env.TEST_REDIS_URL;
    if (!url) return;
    const valkey = new ValkeyCounter(url);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const key = `test-${Date.now()}`;
    expect([await valkey.hit(key, 60), await valkey.hit(key, 60)]).toEqual([1, 2]);
    await valkey.close();
  });
});

describe('modules (TL-40)', () => {
  it('switches the wiki off and on without losing data', async () => {
    await admin.request('POST', '/spaces', { key: 'DOCS', name: 'Doku' });
    const off = await admin.request('PUT', '/admin/feature-flags', {
      wiki: false,
      boards: true,
      'time-tracking': true,
      automation: true,
      dashboards: true,
    });
    expect(off.status).toBe(200);
    const blocked = await admin.request<{ type: string }>('GET', '/spaces/DOCS');
    expect(blocked.status).toBe(404);
    expect(blocked.body.type).toBe('urn:lenipo:problem:module-disabled');
    expect((await admin.request<InstanceNotice>('GET', '/instance/notice')).body.modules.wiki).toBe(
      false,
    );
    await admin.request('PUT', '/admin/feature-flags', { wiki: true });
    expect((await admin.request('GET', '/spaces/DOCS')).status).toBe(200);
  });
});

describe('maintenance mode and announcement (TL-40)', () => {
  it('lets only administrators in while maintenance is on', async () => {
    const jonas = await signIn('jonas@example.org');
    expect(jonas.status).toBe(200);
    await admin.request('PUT', '/admin/maintenance-mode', {
      enabled: true,
      message: 'Update bis 18 Uhr',
    });
    const refused = await jonas.client.request<{ detail: string }>('GET', '/me');
    expect(refused.status).toBe(503);
    expect(JSON.stringify(refused.body)).toContain('Update bis 18 Uhr');
    expect((await signIn('jonas@example.org')).status).toBe(503);
    expect((await admin.request('GET', '/me')).status).toBe(200);
    expect((await signIn('lena@example.org')).status).toBe(200);
    const notice = (await jonas.client.request<InstanceNotice>('GET', '/instance/notice')).body;
    expect(notice.maintenance).toEqual({ enabled: true, message: 'Update bis 18 Uhr' });
    await admin.request('PUT', '/admin/maintenance-mode', { enabled: false, message: '' });
    expect((await jonas.client.request('GET', '/me')).status).toBe(200);
  });

  it('shows the banner only within its time', async () => {
    const hour = 3_600_000;
    await admin.request('PUT', '/admin/announcement', {
      text: 'Wartung am **Samstag**',
      level: 'warning',
      startsAt: new Date(Date.now() - hour).toISOString(),
      endsAt: new Date(Date.now() + hour).toISOString(),
    });
    const shown = (await admin.request<InstanceNotice>('GET', '/instance/notice')).body;
    expect(shown.announcement).toMatchObject({ text: 'Wartung am **Samstag**', level: 'warning' });
    expect(shown.announcement?.version).toBeTruthy();
    await admin.request('PUT', '/admin/announcement', {
      text: 'Vorbei',
      endsAt: new Date(Date.now() - hour).toISOString(),
    });
    expect((await admin.request<InstanceNotice>('GET', '/instance/notice')).body.announcement).toBe(
      null,
    );
  });
});

describe('legal links (TL-105)', () => {
  it('shows the defaults from the environment until administrators set their own', async () => {
    const anonymous = new TestClient(test.baseUrl);
    const before = (await anonymous.request<InstanceNotice>('GET', '/instance/notice')).body;
    expect(before.legal).toEqual({
      imprintUrl: 'https://example.org/impressum',
      privacyUrl: null,
    });
    const jonas = await signIn('jonas@example.org');
    expect(
      (
        await jonas.client.request('PUT', '/admin/legal-links', {
          imprintUrl: null,
          privacyUrl: 'https://evil.example',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await admin.request('PUT', '/admin/legal-links', {
          imprintUrl: 'javascript:alert(1)',
          privacyUrl: null,
        })
      ).status,
    ).toBe(400);
    const saved = await admin.request('PUT', '/admin/legal-links', {
      imprintUrl: null,
      privacyUrl: 'https://example.org/datenschutz',
    });
    expect(saved.body).toEqual({
      imprintUrl: 'https://example.org/impressum',
      privacyUrl: 'https://example.org/datenschutz',
    });
    const after = (await anonymous.request<InstanceNotice>('GET', '/instance/notice')).body;
    expect(after.legal.privacyUrl).toBe('https://example.org/datenschutz');
  });
});
