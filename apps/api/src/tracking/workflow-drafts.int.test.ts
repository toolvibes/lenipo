import type { ProjectWorkflow, PublishWorkflowRequest, WorkflowDraft } from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;

async function workflow(issueType?: string): Promise<ProjectWorkflow> {
  const query = issueType ? `?issueType=${issueType}` : '';
  return (await admin.request<ProjectWorkflow>('GET', `/projects/WEB/workflow${query}`)).body;
}

/** The workflow without its last status, every move allowed. */
function shorter(base: ProjectWorkflow, issueType?: string): PublishWorkflowRequest {
  return {
    baseVersionId: base.versionId,
    ...(issueType ? { issueType } : {}),
    statuses: base.statuses
      .slice(0, -2)
      .concat(base.statuses.slice(-1))
      .map(({ id, name, category }) => ({ id, name, category })),
    initial: 0,
    mode: 'free',
    transitions: [],
    migrate: {},
  } as PublishWorkflowRequest;
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
  const miraId = (
    await admin.request<{ id: string }>('POST', '/admin/users', {
      email: 'mira@example.org',
      displayName: 'Mira Kaya',
      password: 'ein-langes-passwort',
    })
  ).body.id;
  mira = new TestClient(test.baseUrl);
  await mira.request('POST', '/auth/login', {
    email: 'mira@example.org',
    password: 'ein-langes-passwort',
  });
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  await admin.request('POST', '/projects/WEB/members', { role: 'developers', userId: miraId });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('workflow drafts (TL-77)', () => {
  it('keep one shared draft per workflow until it is published', async () => {
    const standard = await workflow();
    expect(standard.draft).toBeNull();
    const edit = shorter(standard);
    expect((await mira.request('PUT', '/projects/WEB/workflow/draft', edit)).status).toBe(403);
    const saved = await admin.request<WorkflowDraft>('PUT', '/projects/WEB/workflow/draft', edit);
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ updatedBy: { displayName: 'Lena Vogt' }, stale: false });
    expect((await workflow()).draft?.request.statuses).toHaveLength(3);
    // A draft of the bug workflow is separate, and starts from the standard one it copies.
    const bugs = await workflow('bug');
    await admin.request('PUT', '/projects/WEB/workflow/draft', shorter(bugs, 'bug'));
    expect((await workflow('bug')).draft?.request.issueType).toBe('bug');

    const published = await admin.request<ProjectWorkflow>('POST', '/projects/WEB/workflow', edit);
    expect(published.status).toBe(200);
    expect(published.body.draft).toBeNull();
  });

  it('keep a draft whose version is outdated, but do not publish it', async () => {
    const stale = (await workflow('bug')).draft;
    expect(stale?.stale).toBe(true);
    const refused = await admin.request(
      'POST',
      '/projects/WEB/workflow',
      stale?.request as PublishWorkflowRequest,
    );
    expect(refused.status).toBe(409);
    expect(
      (await admin.request('DELETE', '/projects/WEB/workflow/draft?issueType=bug')).status,
    ).toBe(204);
    expect((await workflow('bug')).draft).toBeNull();
  });
});
