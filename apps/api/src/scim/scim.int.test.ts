import type { CreatedScimToken, CreatedToken } from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let scimUrl: string;
let secret: string;

// biome-ignore lint/suspicious/noExplicitAny: SCIM answers are checked loosely
type Json = any;

async function scim(method: string, path: string, body?: unknown, token = secret) {
  const response = await fetch(`${scimUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/scim+json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return {
    status: response.status,
    type: response.headers.get('content-type') ?? '',
    body: (text ? JSON.parse(text) : undefined) as Json,
  };
}

beforeAll(async () => {
  test = await startTestApp();
  scimUrl = test.baseUrl.replace(/\/api\/v1$/, '/scim/v2');
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  const setup = await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  if (setup.status >= 300) throw new Error(`setup ${setup.status} ${JSON.stringify(setup.body)}`);
  const token = await admin.request<CreatedScimToken>('POST', '/admin/scim-tokens', {
    name: 'Entra ID',
  });
  if (token.status !== 201) throw new Error(JSON.stringify(token.body));
  secret = token.body.secret;
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('SCIM 2.0 (TL-52)', () => {
  it('accepts only SCIM tokens', async () => {
    expect(secret).toMatch(/^lpscim_/);
    const config = await scim('GET', '/ServiceProviderConfig');
    expect(config.status).toBe(200);
    expect(config.type).toContain('application/scim+json');
    expect(config.body.patch.supported).toBe(true);
    const pat = await admin.request<CreatedToken>('POST', '/me/tokens', {
      name: 'Admin',
      scopes: ['admin'],
      expiresInDays: 1,
    });
    const denied = await scim('GET', '/Users', undefined, pat.body.secret);
    expect(denied.status).toBe(401);
    expect(denied.body.schemas).toEqual(['urn:ietf:params:scim:api:messages:2.0:Error']);
  });

  it('provisions, finds, changes and deactivates users', async () => {
    const created = await scim('POST', '/Users', {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      userName: 'Max.Muster@Example.org',
      externalId: 'entra-42',
      name: { givenName: 'Max', familyName: 'Muster' },
      emails: [{ value: 'max.muster@example.org', type: 'work', primary: true }],
      active: true,
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      userName: 'max.muster@example.org',
      displayName: 'Max Muster',
      externalId: 'entra-42',
      active: true,
    });
    const id = created.body.id;
    expect((await scim('POST', '/Users', { userName: 'max.muster@example.org' })).status).toBe(409);

    const found = await scim(
      'GET',
      `/Users?filter=${encodeURIComponent('userName eq "max.muster@example.org"')}`,
    );
    expect(found.body.totalResults).toBe(1);
    expect(found.body.Resources[0].id).toBe(id);
    const byExternal = await scim(
      'GET',
      `/Users?filter=${encodeURIComponent('externalId eq "entra-42"')}`,
    );
    expect(byExternal.body.totalResults).toBe(1);

    // Entra writes paths and strings, Okta a value object.
    const renamed = await scim('PATCH', `/Users/${id}`, {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: [{ op: 'Replace', path: 'displayName', value: 'Max M. Muster' }],
    });
    expect(renamed.body.displayName).toBe('Max M. Muster');
    const off = await scim('PATCH', `/Users/${id}`, {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: [{ op: 'Replace', path: 'active', value: 'False' }],
    });
    expect(off.body.active).toBe(false);
    const on = await scim('PATCH', `/Users/${id}`, {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: [{ op: 'replace', value: { active: true } }],
    });
    expect(on.body.active).toBe(true);

    expect((await scim('DELETE', `/Users/${id}`)).status).toBe(204);
    expect((await scim('GET', `/Users/${id}`)).body.active).toBe(false);
    expect((await scim('GET', '/Users/kein-id')).status).toBe(404);
  });

  it('takes over an existing account by its e-mail address', async () => {
    const linked = await scim('POST', '/Users', { userName: 'lena@example.org', active: true });
    expect(linked.status).toBe(201);
    expect(linked.body.displayName).toBe('Lena Vogt');
  });

  it('manages groups and their members, but not groups of Lenipo', async () => {
    const person = await scim('POST', '/Users', {
      userName: 'ana@example.org',
      displayName: 'Ana',
    });
    const group = await scim('POST', '/Groups', {
      displayName: 'Entwicklung',
      externalId: 'g-1',
      members: [{ value: person.body.id }],
    });
    expect(group.status).toBe(201);
    expect(group.body.members.map((member: Json) => member.display)).toEqual(['Ana']);

    const lena = (
      await scim('GET', `/Users?filter=${encodeURIComponent('userName eq "lena@example.org"')}`)
    ).body.Resources[0].id;
    const added = await scim('PATCH', `/Groups/${group.body.id}`, {
      Operations: [{ op: 'add', path: 'members', value: [{ value: lena }] }],
    });
    expect(added.body.members).toHaveLength(2);
    const removed = await scim('PATCH', `/Groups/${group.body.id}`, {
      Operations: [{ op: 'remove', path: `members[value eq "${person.body.id}"]` }],
    });
    expect(removed.body.members.map((member: Json) => member.display)).toEqual(['Lena Vogt']);
    const user = await scim('GET', `/Users/${lena}`);
    expect(user.body.groups.map((entry: Json) => entry.display)).toContain('Entwicklung');

    const builtIn = (
      await scim('GET', `/Groups?filter=${encodeURIComponent('displayName eq "users"')}`)
    ).body.Resources[0];
    expect(
      (
        await scim('PATCH', `/Groups/${builtIn.id}`, {
          Operations: [{ op: 'add', path: 'members', value: [] }],
        })
      ).status,
    ).toBe(403);
    expect((await scim('DELETE', `/Groups/${group.body.id}`)).status).toBe(204);
    expect((await scim('GET', `/Groups/${group.body.id}`)).status).toBe(404);
  });
});
