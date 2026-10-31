import type { CustomField, Issue, ProjectDetails } from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let kunde: CustomField;
let intern: CustomField;

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
  kunde = (
    await admin.request<CustomField>('POST', '/admin/custom-fields', {
      name: 'Kunde',
      type: 'text',
    })
  ).body;
  intern = (
    await admin.request<CustomField>('POST', '/admin/custom-fields', {
      name: 'Intern',
      type: 'text',
    })
  ).body;
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('field configuration per project (TL-12)', () => {
  it('makes fields required, hidden or explained', async () => {
    await admin.request('PUT', '/projects/WEB/custom-fields', { fieldIds: [intern.id] });
    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Vorher',
      customFields: { [intern.id]: 'geheim' },
    });
    const both = await admin.request('PUT', '/projects/WEB/custom-fields', {
      fieldIds: [kunde.id],
      settings: { [kunde.id]: { required: true, hidden: true } },
    });
    expect(both.status).toBe(400);
    const project = await admin.request<ProjectDetails>('PUT', '/projects/WEB/custom-fields', {
      fieldIds: [kunde.id, intern.id],
      settings: {
        [kunde.id]: { required: true, description: 'Für wen ist das?', tab: 'Vertrieb' },
        [intern.id]: { hidden: true },
      },
    });
    expect(project.status).toBe(200);
    // Forms show only the visible fields; the settings list all of them.
    expect(project.body.customFieldIds).toEqual([kunde.id]);
    expect(project.body.customFieldSettings).toMatchObject([
      {
        fieldId: kunde.id,
        required: true,
        hidden: false,
        description: 'Für wen ist das?',
        tab: 'Vertrieb',
      },
      { fieldId: intern.id, required: false, hidden: true, description: null, tab: null },
    ]);
  });

  it('insists on required fields when creating and editing', async () => {
    const missing = await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Ohne Kunde',
    });
    expect(missing.status).toBe(400);
    expect(JSON.stringify(missing.body)).toContain('Kunde');
    const created = await admin.request<Issue>('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Mit Kunde',
      customFields: { [kunde.id]: 'ACME' },
    });
    expect(created.status).toBe(201);
    const key = created.body.key;
    expect(
      (await admin.request('PATCH', `/issues/${key}`, { customFields: { [kunde.id]: null } }))
        .status,
    ).toBe(400);
    // An issue from before the rule can still be edited otherwise.
    expect((await admin.request('PATCH', '/issues/WEB-1', { summary: 'Vorher, neu' })).status).toBe(
      200,
    );
  });

  it('keeps the values of hidden fields', async () => {
    const issue = (await admin.request<Issue>('GET', '/issues/WEB-1')).body;
    expect(issue.customFields[intern.id]).toBe('geheim');
  });
});
