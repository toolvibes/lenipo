import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { UpdateStatus } from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkUpgradePath } from '../db/migrate.js';
import { compareVersions } from '../db/release.js';
import { SetupService } from '../identity/setup.service.js';
import { API_VERSION } from '../openapi/version.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let releases: Server;
let calls = 0;

beforeAll(async () => {
  // Stands in for the public list of releases on GitHub.
  releases = createServer((_request, response) => {
    calls += 1;
    response
      .writeHead(200, { 'content-type': 'application/json' })
      .end(
        JSON.stringify({ tag_name: 'v99.1.0', html_url: 'https://example.org/releases/v99.1.0' }),
      );
  });
  await new Promise<void>((resolve) => releases.listen(0, '127.0.0.1', resolve));
  const port = (releases.address() as AddressInfo).port;
  test = await startTestApp({ UPDATE_CHECK_URL: `http://127.0.0.1:${port}/latest` });
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Acme',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
  releases?.close();
});

describe('versions and updates (TL-110)', () => {
  it('compares versions by number', () => {
    expect(compareVersions('1.10.0', '1.9.3')).toBe(1);
    expect(compareVersions('v2.0.0', '2.0.0')).toBe(0);
    expect(compareVersions('1.2.3-rc.1', '1.2.4')).toBe(-1);
  });

  it('asks nobody until an administrator turns the check on', async () => {
    const before = await admin.request<UpdateStatus>('GET', '/admin/updates');
    expect(before.body).toMatchObject({
      current: API_VERSION,
      enabled: false,
      latest: null,
      available: false,
    });
    expect(calls).toBe(0);
    const on = await admin.request<UpdateStatus>('PUT', '/admin/updates', { enabled: true });
    expect(on.body).toMatchObject({
      enabled: true,
      latest: '99.1.0',
      url: 'https://example.org/releases/v99.1.0',
      available: true,
      error: null,
    });
    expect(calls).toBe(1);
  });

  it('refuses a database too old for the release', async () => {
    await test.database.sql`
      insert into system_settings (key, value) values ('schema-version', ${JSON.stringify({ version: '1.0.0' })}::jsonb)
      on conflict (key) do update set value = excluded.value`;
    await expect(checkUpgradePath(test.database.sql, '1.4.0', '1.2.0')).rejects.toThrow(
      'update to 1.2.0 first, then to 1.4.0',
    );
    await expect(checkUpgradePath(test.database.sql, '1.4.0', '1.0.0')).resolves.toBeUndefined();
    await expect(checkUpgradePath(test.database.sql, '1.4.0', null)).resolves.toBeUndefined();
  });
});
