import type {
  ChangeGroup,
  CustomField,
  Issue,
  ProjectDetails,
  SearchResult,
  TrackingMeta,
} from '@tasklore/shared';
import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { projectRoleMembers, users } from '../db/schema/index.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let miraId: string;
let outsiderId: string;
const field: Record<string, CustomField> = {};

async function signIn(email: string): Promise<TestClient> {
  const client = new TestClient(test.baseUrl);
  await client.request('POST', '/auth/login', { email, password: 'ein-langes-passwort' });
  return client;
}

async function search(query: string): Promise<string[] | number> {
  const result = await admin.request<SearchResult>('POST', '/search', { query });
  return result.status === 200 ? result.body.issues.map((issue) => issue.key) : result.status;
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
  const create = async (email: string, displayName: string) =>
    (
      await admin.request<{ id: string }>('POST', '/admin/users', {
        email,
        displayName,
        password: 'ein-langes-passwort',
      })
    ).body.id;
  miraId = await create('mira@example.org', 'Mira Kaya');
  mira = await signIn('mira@example.org');
  const web = await admin.request<ProjectDetails>('POST', '/projects', {
    key: 'WEB',
    name: 'Web-Relaunch',
    template: 'scrum',
  });
  await admin.request('POST', '/projects', { key: 'OPS', name: 'Betrieb', template: 'basic' });
  await test.database.db
    .insert(projectRoleMembers)
    .values({ id: uuidv7(), projectId: web.body.id, role: 'developers', userId: miraId });
  // Someone deactivated who cannot be picked as a person.
  outsiderId = await create('olaf@example.org', 'Olaf Alt');
  await test.database.db
    .update(users)
    .set({ status: 'deactivated' })
    .where(eq(users.id, outsiderId));
  for (const summary of ['Login', 'Logout', 'Profil']) {
    await admin.request('POST', '/issues', { projectKey: 'WEB', issueType: 'task', summary });
  }
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('definitions', () => {
  it('lets administrators create fields of every basic type', async () => {
    const definitions = [
      { name: 'Kunde', type: 'select', options: ['ACME', 'Muster AG'] },
      { name: 'Kanäle', type: 'multiselect', options: ['Web', 'App', 'Mail'] },
      { name: 'Aufwand in PT', type: 'number' },
      { name: 'Freigabe', type: 'date' },
      { name: 'Geprüft', type: 'checkbox' },
      { name: 'Fachlich verantwortlich', type: 'user' },
      { name: 'Ticket-Link', type: 'url' },
      { name: 'Notizen', type: 'textarea' },
    ];
    for (const definition of definitions) {
      const created = await admin.request<CustomField>('POST', '/admin/custom-fields', definition);
      expect(created.status).toBe(201);
      field[definition.name] = created.body;
    }
    expect(field.Kunde).toMatchObject({ number: 1, type: 'select', archived: false });
    expect(field.Kunde?.options.map((option) => option.value)).toEqual(['ACME', 'Muster AG']);
    const meta = await mira.request<TrackingMeta>('GET', '/tracking/meta');
    expect(meta.body.customFields).toHaveLength(definitions.length);
  });

  it('refuses clashing, duplicate or misplaced definitions', async () => {
    const post = (body: object) => admin.request('POST', '/admin/custom-fields', body);
    expect((await post({ name: 'Status', type: 'text' })).status).toBe(400);
    expect((await post({ name: 'now', type: 'text' })).status).toBe(400);
    expect((await post({ name: 'cf[9]', type: 'text' })).status).toBe(400);
    expect((await post({ name: 'kunde', type: 'text' })).status).toBe(409);
    expect((await post({ name: 'Farbe', type: 'text', options: ['rot'] })).status).toBe(400);
    expect(
      (await mira.request('POST', '/admin/custom-fields', { name: 'X', type: 'text' })).status,
    ).toBe(403);
  });
});

describe('projects', () => {
  it('switches fields on per project, by project administrators only', async () => {
    const ids = Object.values(field).map((entry) => entry.id);
    expect(
      (await mira.request('PUT', '/projects/WEB/custom-fields', { fieldIds: ids })).status,
    ).toBe(403);
    const project = await admin.request<ProjectDetails>('PUT', '/projects/WEB/custom-fields', {
      fieldIds: ids,
    });
    expect(project.body.customFieldIds).toEqual(ids);
    expect(
      (await admin.request<ProjectDetails>('GET', '/projects/OPS')).body.customFieldIds,
    ).toEqual([]);
  });
});

describe('values', () => {
  it('stores, shows and records values', async () => {
    const kunde = field.Kunde as CustomField;
    const kanaele = field.Kanäle as CustomField;
    const updated = await mira.request<Issue>('PATCH', '/issues/WEB-1', {
      customFields: {
        [kunde.id]: kunde.options[0]?.id,
        [kanaele.id]: [kanaele.options[2]?.id, kanaele.options[0]?.id],
        [field['Aufwand in PT']?.id as string]: 3.5,
        [field.Freigabe?.id as string]: '2026-11-15',
        [field.Geprüft?.id as string]: true,
        [field['Fachlich verantwortlich']?.id as string]: miraId,
        [field['Ticket-Link']?.id as string]: 'https://example.org/t/1',
      },
    });
    expect(updated.status).toBe(200);
    expect(updated.body.customFields).toEqual({
      [kunde.id]: { id: kunde.options[0]?.id, value: 'ACME' },
      // Stored in the order of the options.
      [kanaele.id]: [
        { id: kanaele.options[0]?.id, value: 'Web' },
        { id: kanaele.options[2]?.id, value: 'Mail' },
      ],
      [field['Aufwand in PT']?.id as string]: 3.5,
      [field.Freigabe?.id as string]: '2026-11-15',
      [field.Geprüft?.id as string]: true,
      [field['Fachlich verantwortlich']?.id as string]: { id: miraId, displayName: 'Mira Kaya' },
      [field['Ticket-Link']?.id as string]: 'https://example.org/t/1',
    });
    const history = await admin.request<ChangeGroup[]>('GET', '/issues/WEB-1/history');
    const items = history.body.flatMap((group) => group.items);
    expect(items).toContainEqual(
      expect.objectContaining({ field: `cf:${kunde.id}`, from: null, to: 'ACME' }),
    );
    expect(items).toContainEqual(
      expect.objectContaining({ field: `cf:${kanaele.id}`, to: 'Web, Mail' }),
    );
  });

  it('checks values by type and project', async () => {
    const patch = (customFields: object) =>
      admin.request('PATCH', '/issues/WEB-2', { customFields });
    expect((await patch({ [field.Kunde?.id as string]: uuidv7() })).status).toBe(400);
    expect((await patch({ [field['Aufwand in PT']?.id as string]: 'viel' })).status).toBe(400);
    expect((await patch({ [field.Freigabe?.id as string]: '15.11.2026' })).status).toBe(400);
    expect(
      (await patch({ [field['Ticket-Link']?.id as string]: 'javascript:alert(1)' })).status,
    ).toBe(400);
    expect(
      (await patch({ [field['Fachlich verantwortlich']?.id as string]: outsiderId })).status,
    ).toBe(400);
    const ops = await admin.request<Issue>('POST', '/issues', {
      projectKey: 'OPS',
      issueType: 'task',
      summary: 'Backup',
      customFields: { [field.Kunde?.id as string]: field.Kunde?.options[0]?.id },
    });
    expect(ops.status).toBe(400);
  });

  it('accepts values when creating and clears them with null', async () => {
    const created = await admin.request<Issue>('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Suche',
      customFields: {
        [field['Aufwand in PT']?.id as string]: 8,
        [field.Notizen?.id as string]: 'Zeile 1\nZeile 2',
      },
    });
    expect(created.body.customFields[field['Aufwand in PT']?.id as string]).toBe(8);
    const cleared = await admin.request<Issue>('PATCH', `/issues/${created.body.key}`, {
      customFields: { [field.Notizen?.id as string]: null },
    });
    expect(cleared.body.customFields[field.Notizen?.id as string]).toBeUndefined();
  });
});

describe('TQL', () => {
  it('finds issues by name or cf[n] for every type', async () => {
    expect(await search('Kunde = acme')).toEqual(['WEB-1']);
    expect(await search('cf[1] in ("Muster AG", ACME)')).toEqual(['WEB-1']);
    expect(await search('Kanäle = Mail')).toEqual(['WEB-1']);
    expect(await search('"Aufwand in PT" > 3 ORDER BY "Aufwand in PT" DESC')).toEqual([
      'WEB-4',
      'WEB-1',
    ]);
    expect(await search('Freigabe >= 2026-11-01')).toEqual(['WEB-1']);
    expect(await search('Geprüft = true')).toEqual(['WEB-1']);
    expect(await search('project = WEB AND Geprüft = false ORDER BY key')).toEqual([
      'WEB-2',
      'WEB-3',
      'WEB-4',
    ]);
    expect(await search('"Fachlich verantwortlich" = mira@example.org')).toEqual(['WEB-1']);
    expect(await search('"Ticket-Link" ~ example.org')).toEqual(['WEB-1']);
    expect(await search('project = WEB AND Kunde is EMPTY ORDER BY key')).toEqual([
      'WEB-2',
      'WEB-3',
      'WEB-4',
    ]);
    expect(await search('Kunde != ACME')).toEqual([]);
    expect(await search('Kunde = Unbekannt')).toBe(400);
  });

  it('follows renames of fields and options', async () => {
    const kunde = field.Kunde as CustomField;
    const renamed = await admin.request<CustomField>('PATCH', `/admin/custom-fields/${kunde.id}`, {
      name: 'Auftraggeber',
      options: [
        { id: kunde.options[0]?.id, value: 'ACME GmbH' },
        { id: kunde.options[1]?.id, value: 'Muster AG', archived: true },
        { value: 'Beispiel KG' },
      ],
    });
    expect(renamed.status).toBe(200);
    expect(renamed.body.options.map((option) => [option.value, option.archived])).toEqual([
      ['ACME GmbH', false],
      ['Muster AG', true],
      ['Beispiel KG', false],
    ]);
    expect(await search('Auftraggeber = "ACME GmbH"')).toEqual(['WEB-1']);
    expect(await search('Kunde = ACME')).toBe(400);
    const issue = await admin.request<Issue>('GET', '/issues/WEB-1');
    expect(issue.body.customFields[kunde.id]).toEqual({
      id: kunde.options[0]?.id,
      value: 'ACME GmbH',
    });
    // An archived option cannot be chosen anew.
    expect(
      (
        await admin.request('PATCH', '/issues/WEB-2', {
          customFields: { [kunde.id]: kunde.options[1]?.id },
        })
      ).status,
    ).toBe(400);
  });

  it('hides archived fields and fields a project switched off', async () => {
    const pt = field['Aufwand in PT'] as CustomField;
    await admin.request('PATCH', `/admin/custom-fields/${pt.id}`, { archived: true });
    expect(await search('"Aufwand in PT" > 1')).toBe(400);
    expect(
      (await admin.request<Issue>('GET', '/issues/WEB-1')).body.customFields[pt.id],
    ).toBeUndefined();
    await admin.request('PATCH', `/admin/custom-fields/${pt.id}`, { archived: false });
    await admin.request('PUT', '/projects/WEB/custom-fields', { fieldIds: [field.Geprüft?.id] });
    const issue = await admin.request<Issue>('GET', '/issues/WEB-1');
    expect(Object.keys(issue.body.customFields)).toEqual([field.Geprüft?.id]);
  });
});
