import type { CustomField, Issue, ProjectDetails } from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let schwere: CustomField;
let project: ProjectDetails;

const option = (value: string) => schwere.options.find((entry) => entry.value === value)?.id ?? '';
const typeId = (key: string) => project.issueTypes.find((type) => type.key === key)?.id ?? '';

async function create(issueType: string, customFields: object = {}) {
  return admin.request<Issue>('POST', '/issues', {
    projectKey: 'WEB',
    issueType,
    summary: issueType,
    customFields,
  });
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
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  schwere = (
    await admin.request<CustomField>('POST', '/admin/custom-fields', {
      name: 'Schwere',
      type: 'select',
      options: ['Kritisch', 'Hoch', 'Niedrig', 'Kosmetisch'],
    })
  ).body;
  project = (await admin.request<ProjectDetails>('GET', '/projects/WEB')).body;
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('field contexts (TL-80)', () => {
  it('limit a field to issue types and options, with a default', async () => {
    const setting = {
      issueTypeIds: [typeId('bug')],
      optionIds: [option('Kritisch'), option('Hoch'), option('Niedrig')],
    };
    const badDefault = await admin.request('PUT', '/projects/WEB/custom-fields', {
      fieldIds: [schwere.id],
      settings: { [schwere.id]: { ...setting, defaultValue: option('Kosmetisch') } },
    });
    expect(badDefault.status).toBe(400);
    const saved = await admin.request<ProjectDetails>('PUT', '/projects/WEB/custom-fields', {
      fieldIds: [schwere.id],
      settings: { [schwere.id]: { ...setting, defaultValue: option('Niedrig') } },
    });
    expect(saved.status).toBe(200);
    expect(saved.body.customFieldSettings[0]).toMatchObject({
      ...setting,
      defaultValue: option('Niedrig'),
    });
  });

  it('apply the default and the limits when issues are written', async () => {
    const bug = await create('bug');
    expect(bug.status).toBe(201);
    expect(bug.body.customFields[schwere.id]).toEqual({ id: option('Niedrig'), value: 'Niedrig' });
    // Tasks do not get the field: no default, and no value either.
    const task = await create('task');
    expect(task.body.customFields[schwere.id]).toBeUndefined();
    expect((await create('task', { [schwere.id]: option('Hoch') })).status).toBe(400);
    // Options outside the context cannot be chosen.
    expect((await create('bug', { [schwere.id]: option('Kosmetisch') })).status).toBe(400);
    expect(
      (
        await admin.request('PATCH', `/issues/${bug.body.key}`, {
          customFields: { [schwere.id]: option('Kritisch') },
        })
      ).status,
    ).toBe(200);
  });
});
