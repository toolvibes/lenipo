import type {
  ChangeGroup,
  Issue,
  ProjectDetails,
  ProjectWorkflow,
  PublishWorkflowRequest,
  StatusInfo,
  Transition,
} from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let standard: ProjectWorkflow;

const byName = (workflow: ProjectWorkflow, name: string): StatusInfo => {
  const found = workflow.available.find((entry) => entry.name === name);
  if (!found) throw new Error(`No status ${name}`);
  return found;
};

async function offered(key: string): Promise<string[]> {
  return (await admin.request<Transition[]>('GET', `/issues/${key}/transitions`)).body.map(
    (transition) => transition.to.name,
  );
}

async function issue(key: string): Promise<Issue> {
  return (await admin.request<Issue>('GET', `/issues/${key}`)).body;
}

async function create(issueType: string, summary: string): Promise<string> {
  return (await admin.request<Issue>('POST', '/issues', { projectKey: 'WEB', issueType, summary }))
    .body.key;
}

/** A workflow of these statuses, every move allowed. */
function request(
  base: ProjectWorkflow,
  names: string[],
  extra: Partial<PublishWorkflowRequest> = {},
): PublishWorkflowRequest {
  return {
    baseVersionId: base.versionId,
    statuses: names.map((name) => {
      const status = byName(base, name);
      return { id: status.id, name: status.name, category: status.category };
    }),
    initial: 0,
    mode: 'free',
    transitions: [],
    migrate: {},
    ...extra,
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
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  standard = (await admin.request<ProjectWorkflow>('GET', '/projects/WEB/workflow')).body;
  for (const [type, summary] of [
    ['bug', 'Absturz'],
    ['story', 'Anmelden'],
  ] as const) {
    const key = await create(type, summary);
    await admin.request('POST', `/issues/${key}/transitions`, { transitionId: 'to-review' });
  }
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('workflows per issue type (TL-76)', () => {
  let bugs: ProjectWorkflow;

  it('give an issue type a workflow of its own', async () => {
    const inherited = (
      await admin.request<ProjectWorkflow>('GET', '/projects/WEB/workflow?issueType=bug')
    ).body;
    expect(inherited).toMatchObject({
      issueType: 'bug',
      inherited: true,
      versionId: standard.versionId,
      ownTypes: [],
    });
    expect((await admin.request('GET', '/projects/WEB/workflow?issueType=nope')).status).toBe(400);

    const names = ['Offen', 'In Prüfung', 'In Arbeit', 'Erledigt'];
    const review = byName(standard, 'Review').id;
    // The bug in Review needs a new home; the story in Review is not affected.
    const missing = await admin.request(
      'POST',
      '/projects/WEB/workflow',
      request(inherited, names, { issueType: 'bug' }),
    );
    expect(missing.status).toBe(400);
    expect(JSON.stringify(missing.body)).toContain('Review');
    const published = await admin.request<ProjectWorkflow>(
      'POST',
      '/projects/WEB/workflow',
      request(inherited, names, { issueType: 'bug', migrate: { [review]: 2 } }),
    );
    expect(published.status).toBe(200);
    bugs = published.body;
    expect(bugs).toMatchObject({ issueType: 'bug', inherited: false, ownTypes: ['bug'] });
    expect(bugs.statuses.map((status) => status.name)).toEqual(names);
    expect(bugs.versionId).not.toBe(standard.versionId);

    expect((await issue('WEB-1')).status.name).toBe('In Arbeit');
    expect((await issue('WEB-2')).status.name).toBe('Review');
    const again = (await admin.request<ProjectWorkflow>('GET', '/projects/WEB/workflow')).body;
    expect(again).toMatchObject({ versionId: standard.versionId, ownTypes: ['bug'] });
    // The standard workflow counts only the issues it applies to.
    expect(again.usage[byName(standard, 'In Arbeit').id]).toBeUndefined();
    const project = (await admin.request<ProjectDetails>('GET', '/projects/WEB')).body;
    expect(project.statuses.map((status) => status.name)).toContain('In Prüfung');
  });

  it('use the workflow of the type for new issues and transitions', async () => {
    const bug = await create('bug', 'Fehler');
    const story = await create('story', 'Profil');
    expect(await offered(bug)).toContain('In Prüfung');
    expect(await offered(bug)).not.toContain('Review');
    expect(await offered(story)).toContain('Review');
    expect(await offered(story)).not.toContain('In Prüfung');
  });

  it('move an issue into a status of the same category when its type changes', async () => {
    const changed = await admin.request<Issue>('PATCH', '/issues/WEB-2', { issueType: 'bug' });
    expect(changed.status).toBe(200);
    expect(changed.body.status.name).toBe('In Prüfung');
    const history = (await admin.request<ChangeGroup[]>('GET', '/issues/WEB-2/history')).body;
    expect(history[0]?.items.map((item) => item.field).sort()).toEqual(['issuetype', 'status']);
    expect(await offered('WEB-2')).toContain('Erledigt');
  });

  it('keep the type workflows apart when the standard one changes', async () => {
    const stale = await admin.request(
      'POST',
      '/projects/WEB/workflow',
      request(standard, ['Offen', 'In Arbeit', 'Erledigt'], { issueType: 'bug' }),
    );
    expect(stale.status).toBe(409);
    const next = await admin.request<ProjectWorkflow>(
      'POST',
      '/projects/WEB/workflow',
      request(standard, ['Offen', 'In Arbeit', 'Review', 'Erledigt'], { mode: 'defined' }),
    );
    expect(next.status).toBe(200);
    standard = next.body;
    expect(await offered('WEB-1')).toContain('In Prüfung');
  });

  it('let the type use the standard workflow again', async () => {
    const back = await admin.request<ProjectWorkflow>('DELETE', '/projects/WEB/workflow/types/bug');
    expect(back.status).toBe(200);
    expect(back.body).toMatchObject({
      issueType: 'bug',
      inherited: true,
      versionId: standard.versionId,
      ownTypes: [],
    });
    // "In Prüfung" is not in the standard workflow: the first status in progress takes over.
    expect((await issue('WEB-2')).status.name).toBe('In Arbeit');
    const history = (await admin.request<ChangeGroup[]>('GET', '/issues/WEB-2/history')).body;
    expect(history[0]?.items.map((item) => item.field)).toEqual(['status']);
    expect(await offered('WEB-2')).not.toContain('In Prüfung');
    expect((await admin.request('DELETE', '/projects/WEB/workflow/types/bug')).status).toBe(400);
    const project = (await admin.request<ProjectDetails>('GET', '/projects/WEB')).body;
    expect(project.statuses.map((status) => status.name)).not.toContain('In Prüfung');
  });
});
