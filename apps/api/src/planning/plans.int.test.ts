import type {
  ApplyScenarioResult,
  Issue,
  Plan,
  PlanScenario,
  PlanSummary,
  PlanView,
} from '@toolvibes/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { groups, projectRoleMembers, projects } from '../db/schema/index.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let plan: Plan;
const keys: Record<string, string> = {};

async function issue(body: Record<string, unknown>): Promise<Issue> {
  const response = await admin.request<Issue>('POST', '/issues', body);
  if (response.status !== 201) throw new Error(JSON.stringify(response.body));
  return response.body;
}

const pointsIn = (view: PlanView, projectKey: string, month: string) =>
  view.capacity.find((entry) => entry.projectKey === projectKey && entry.month === month);

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('POST', '/admin/users', {
    email: 'mira@example.org',
    displayName: 'Mira Kaya',
    password: 'ein-langes-passwort',
  });
  mira = new TestClient(test.baseUrl);
  await mira.request('POST', '/auth/login', {
    email: 'mira@example.org',
    password: 'ein-langes-passwort',
  });
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  await admin.request('POST', '/projects', { key: 'OPS', name: 'Betrieb', template: 'scrum' });
  // Only Lena works in OPS.
  const [ops] = await test.database.db.select().from(projects).where(eq(projects.key, 'OPS'));
  const [everyone] = await test.database.db.select().from(groups).where(eq(groups.name, 'users'));
  await test.database.db
    .delete(projectRoleMembers)
    .where(
      and(
        eq(projectRoleMembers.projectId, ops?.id ?? ''),
        eq(projectRoleMembers.groupId, everyone?.id ?? ''),
      ),
    );
  for (const [projectKey, points, dueDate] of [
    ['WEB', 5, '2026-12-10'],
    ['OPS', 3, '2026-12-20'],
  ] as const) {
    const epic = await issue({ projectKey, issueType: 'epic', summary: `Epic ${projectKey}` });
    const story = await issue({
      projectKey,
      issueType: 'story',
      summary: `Story ${projectKey}`,
      parentKey: epic.key,
      storyPoints: points,
      dueDate,
      labels: ['plan'],
    });
    await issue({ projectKey, issueType: 'story', summary: 'Ohne Label', parentKey: epic.key });
    keys[projectKey] = story.key;
  }
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('cross-project plans (TL-46)', () => {
  it('shows the epics of several projects, narrowed by TQL, with capacity', async () => {
    const created = await admin.request<Plan>('POST', '/plans', {
      name: 'Release 2027',
      projectKeys: ['WEB', 'OPS'],
      tql: 'labels = plan',
    });
    expect(created.status).toBe(201);
    plan = created.body;
    expect(
      (await admin.request('POST', '/plans', { name: 'X', projectKeys: ['WEB'], tql: 'nope ~' }))
        .status,
    ).toBe(400);

    await admin.request('PUT', `/plans/${plan.id}/capacity`, {
      projectKey: 'WEB',
      month: '2026-12-01',
      points: 3,
    });
    const view = (await admin.request<PlanView>('GET', `/plans/${plan.id}/view`)).body;
    expect(view.projects.map((project) => project.key)).toEqual(['WEB', 'OPS']);
    const web = view.projects[0];
    expect(web?.epics[0]?.children.map((child) => child.issue.summary)).toEqual(['Story WEB']);
    expect(pointsIn(view, 'WEB', '2026-12-01')).toEqual({
      projectKey: 'WEB',
      month: '2026-12-01',
      capacity: 3,
      planned: 5,
    });

    // Mira sees the plan, but only the project she may browse, and cannot change it.
    const forMira = await mira.request<PlanSummary[]>('GET', '/plans');
    expect(forMira.body[0]).toMatchObject({ projects: [{ key: 'WEB' }], canEdit: false });
    const miraView = (await mira.request<PlanView>('GET', `/plans/${plan.id}/view`)).body;
    expect(miraView.projects.map((project) => project.key)).toEqual(['WEB']);
    expect((await mira.request('PATCH', `/plans/${plan.id}`, { name: 'Meins' })).status).toBe(403);
  });

  it('plays a scenario through and applies it, skipping issues changed since', async () => {
    const scenario = (
      await admin.request<PlanScenario>('POST', `/plans/${plan.id}/scenarios`, { name: 'Später' })
    ).body;
    await admin.request('PUT', `/plans/${plan.id}/scenarios/${scenario.id}/changes/${keys.WEB}`, {
      dueDate: '2027-01-15',
    });
    const changed = await admin.request<PlanScenario>(
      'PUT',
      `/plans/${plan.id}/scenarios/${scenario.id}/changes/${keys.OPS}`,
      { storyPoints: 8 },
    );
    expect(changed.body.changes.map((entry) => entry.key)).toEqual([keys.OPS, keys.WEB].sort());

    const view = (
      await admin.request<PlanView>('GET', `/plans/${plan.id}/view?scenario=${scenario.id}`)
    ).body;
    expect(view.scenarioId).toBe(scenario.id);
    expect(pointsIn(view, 'WEB', '2026-12-01')?.planned).toBe(0);
    expect(pointsIn(view, 'WEB', '2027-01-01')?.planned).toBe(5);
    expect(pointsIn(view, 'OPS', '2026-12-01')?.planned).toBe(8);
    // The real issue is untouched until the scenario is applied.
    expect((await admin.request<Issue>('GET', `/issues/${keys.WEB}`)).body.dueDate).toBe(
      '2026-12-10',
    );

    // Someone edits the OPS story meanwhile: that change is skipped.
    await admin.request('PATCH', `/issues/${keys.OPS}`, { summary: 'Story OPS, neu' });
    const applied = await admin.request<ApplyScenarioResult>(
      'POST',
      `/plans/${plan.id}/scenarios/${scenario.id}/apply`,
      {},
    );
    expect(applied.body).toEqual({
      applied: [keys.WEB],
      skipped: [{ key: keys.OPS, reason: 'changed' }],
    });
    expect((await admin.request<Issue>('GET', `/issues/${keys.WEB}`)).body.dueDate).toBe(
      '2027-01-15',
    );
    const left = (await admin.request<PlanView>('GET', `/plans/${plan.id}/view`)).body;
    expect(left.scenarios[0]?.changes.map((entry) => entry.key)).toEqual([keys.OPS]);
  });
});
