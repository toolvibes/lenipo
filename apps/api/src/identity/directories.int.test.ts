import type { Directory, DirectorySyncResult, GroupSummary } from '@tasklore/shared';
import ldap from 'ldapjs';

// biome-ignore lint/suspicious/noExplicitAny: the ldapjs typings do not describe its server API
type Loose = any;

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { SetupService } from './setup.service.js';

let test: TestApp;
let admin: TestClient;
let server: ldap.Server;
let url = '';
let directoryId = '';

const BASE = 'dc=example,dc=org';
const people: Record<string, { attributes: Record<string, string | string[]>; password: string }> =
  {
    [`uid=jonas,ou=people,${BASE}`]: {
      attributes: {
        uid: 'jonas',
        mail: 'jonas@example.org',
        cn: 'Jonas Berg',
        objectclass: ['person'],
      },
      password: 'jonas-ldap-geheim',
    },
    [`uid=mira,ou=people,${BASE}`]: {
      attributes: {
        uid: 'mira',
        mail: 'mira@example.org',
        cn: 'Mira Kaya',
        objectclass: ['person'],
      },
      password: 'mira-ldap-geheim',
    },
  };
const groupEntry = {
  dn: `cn=ldap-team,ou=groups,${BASE}`,
  attributes: {
    cn: 'ldap-team',
    objectclass: ['groupOfNames'],
    member: [`uid=jonas,ou=people,${BASE}`, `uid=mira,ou=people,${BASE}`],
  },
};

const config = () => ({
  url,
  bindDn: `cn=admin,${BASE}`,
  bindPassword: 'admin-geheim',
  userBase: `ou=people,${BASE}`,
  groupBase: `ou=groups,${BASE}`,
});

beforeAll(async () => {
  server = ldap.createServer();
  server.bind(BASE, (request: Loose, response: Loose, next: Loose) => {
    const dn = request.dn.toString().replace(/\s/g, '');
    const password = request.credentials;
    const ok =
      (dn === `cn=admin,${BASE}` && password === 'admin-geheim') ||
      people[dn]?.password === password;
    if (!ok) return next(new ldap.InvalidCredentialsError());
    response.end();
    return next();
  });
  server.search(BASE, (request: Loose, response: Loose, next: Loose) => {
    const base = request.dn.toString().replace(/\s/g, '');
    const entries = [
      ...Object.entries(people).map(([dn, person]) => ({ dn, attributes: person.attributes })),
      groupEntry,
    ];
    for (const entry of entries) {
      if (entry.dn.endsWith(base) && request.filter.matches(entry.attributes)) response.send(entry);
    }
    response.end();
    return next();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  url = `ldap://127.0.0.1:${((server as Loose).address() as { port: number }).port}`;

  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
  (server as Loose)?.close();
});

describe('LDAP directories (P-USR-04/07)', () => {
  it('tests settings and adds a directory after the internal one', async () => {
    const tried = await admin.request<{ ok: boolean; message: string }>(
      'POST',
      '/admin/directories/test',
      config(),
    );
    expect(tried.body).toEqual({ ok: true, message: '2 Personen gefunden' });
    const list = (
      await admin.request<Directory[]>('POST', '/admin/directories', {
        name: 'Firmen-LDAP',
        config: config(),
      })
    ).body;
    expect(list.map((entry) => [entry.type, entry.name])).toEqual([
      ['internal', 'Tasklore (intern)'],
      ['ldap', 'Firmen-LDAP'],
    ]);
    expect(list[1]?.config).toMatchObject({ hasPassword: true });
    expect(JSON.stringify(list)).not.toContain('admin-geheim');
    directoryId = list[1]?.id ?? '';
  });

  it('signs people in with their LDAP password', async () => {
    const jonas = new TestClient(test.baseUrl);
    expect(
      (
        await jonas.request('POST', '/auth/login', {
          email: 'jonas@example.org',
          password: 'falsch-falsch-falsch',
        })
      ).status,
    ).toBe(401);
    const ok = await jonas.request<{ displayName: string }>('POST', '/auth/login', {
      email: 'jonas@example.org',
      password: 'jonas-ldap-geheim',
    });
    expect(ok.status).toBe(200);
    expect(ok.body.displayName).toBe('Jonas Berg');
    // Local accounts still sign in as before.
    expect(
      (
        await new TestClient(test.baseUrl).request('POST', '/auth/login', {
          email: 'lena@example.org',
          password: 'ein-langes-passwort',
        })
      ).status,
    ).toBe(200);
  });

  it('mirrors people and groups, and deactivates people gone from LDAP', async () => {
    const result = (
      await admin.request<DirectorySyncResult>('POST', `/admin/directories/${directoryId}/sync`, {})
    ).body;
    expect(result).toMatchObject({ created: 1, updated: 1, deactivated: 0, groups: 1 });
    const groups = (await admin.request<GroupSummary[]>('GET', '/admin/groups')).body;
    expect(groups.find((group) => group.name === 'ldap-team')).toMatchObject({ memberCount: 2 });
    delete people[`uid=jonas,ou=people,${BASE}`];
    expect(
      (
        await admin.request<DirectorySyncResult>(
          'POST',
          `/admin/directories/${directoryId}/sync`,
          {},
        )
      ).body.deactivated,
    ).toBe(1);
    expect(
      (
        await new TestClient(test.baseUrl).request('POST', '/auth/login', {
          email: 'jonas@example.org',
          password: 'jonas-ldap-geheim',
        })
      ).status,
    ).toBe(401);
  });

  it('changes the order of the directories', async () => {
    const list = (await admin.request<Directory[]>('GET', '/admin/directories')).body;
    const reordered = await admin.request<Directory[]>('PUT', '/admin/directories/order', {
      ids: [list[1]?.id, list[0]?.id],
    });
    expect(reordered.body.map((entry) => entry.type)).toEqual(['ldap', 'internal']);
    // The internal directory still decides for local accounts further down the list.
    expect(
      (
        await new TestClient(test.baseUrl).request('POST', '/auth/login', {
          email: 'lena@example.org',
          password: 'ein-langes-passwort',
        })
      ).status,
    ).toBe(200);
  });
});
