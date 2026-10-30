import type {
  Board,
  ChangeGroup,
  CreatedWebhook,
  CustomField,
  Issue,
  ProjectWorkflow,
  PublishWorkflowRequest,
  Sprint,
  Transition,
  TransitionRulesInput,
  WebhookDelivery,
} from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EventProcessor } from '../events/event-processor.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let workflow: ProjectWorkflow;
let kunde: CustomField;

const status = (name: string) => {
  const found = workflow.statuses.find((entry) => entry.name === name);
  if (!found) throw new Error(`No status ${name}`);
  return found;
};
const doneName = () => workflow.statuses.find((entry) => entry.category === 'done')?.name ?? '';
const startedName = () =>
  workflow.statuses.find((entry) => entry.category === 'in_progress')?.name ?? '';

async function offered(client: TestClient, key: string): Promise<string[]> {
  return (await client.request<Transition[]>('GET', `/issues/${key}/transitions`)).body.map(
    (transition) => transition.to.name,
  );
}

async function move(client: TestClient, key: string, statusName: string) {
  return client.request<Issue>('POST', `/issues/${key}/transitions`, {
    transitionId: `to-${status(statusName).key}`,
  });
}

async function create(summary: string, extra: object = {}): Promise<string> {
  return (
    await admin.request<Issue>('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary,
      ...extra,
    })
  ).body.key;
}

function withRules(rules: Record<string, TransitionRulesInput>): PublishWorkflowRequest {
  return {
    baseVersionId: workflow.versionId,
    statuses: workflow.statuses.map((entry) => ({
      id: entry.id,
      name: entry.name,
      category: entry.category,
      ...(rules[entry.name] ? { rules: rules[entry.name] } : {}),
    })),
    initial: workflow.statuses.findIndex((entry) => entry.id === workflow.initialStatusId),
    mode: 'free',
    transitions: [],
    migrate: {},
  } as PublishWorkflowRequest;
}

async function publish(rules: Record<string, TransitionRulesInput>) {
  const response = await admin.request<ProjectWorkflow>(
    'POST',
    '/projects/WEB/workflow',
    withRules(rules),
  );
  if (response.status === 200) workflow = response.body;
  return response;
}

beforeAll(async () => {
  test = await startTestApp({ WEBHOOK_ALLOW_PRIVATE_NETWORKS: 'true' });
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
  kunde = (
    await admin.request<CustomField>('POST', '/admin/custom-fields', {
      name: 'Kunde',
      type: 'text',
    })
  ).body;
  await admin.request('PUT', '/projects/WEB/custom-fields', { fieldIds: [kunde.id] });
  workflow = (await admin.request<ProjectWorkflow>('GET', '/projects/WEB/workflow')).body;
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('validators and post-functions (TL-75)', () => {
  it('accept only field changes that make sense', async () => {
    const wrong: TransitionRulesInput['fieldActions'][] = [
      [{ field: 'dueDate', action: 'set', value: '2030-01-01' }],
      [{ field: 'labels', action: 'add', value: 'zwei worte' }],
      [{ field: 'labels', action: 'add' }],
      [{ field: '0190c0de-0000-7000-8000-000000000000', action: 'clear' }],
      [{ field: kunde.id, action: 'add', value: 'x' }],
      [{ field: kunde.id, action: 'set' }],
    ];
    for (const fieldActions of wrong) {
      expect((await publish({ [doneName()]: { fieldActions } })).status).toBe(400);
    }
    const ok = await publish({
      [doneName()]: {
        fieldActions: [
          { field: 'dueDate', action: 'clear' },
          { field: 'sprint', action: 'clear' },
          { field: 'labels', action: 'remove', value: 'offen' },
          { field: 'labels', action: 'add', value: 'erledigt' },
          { field: kunde.id, action: 'set', value: 'Intern' },
        ],
        watch: true,
      },
    });
    expect(ok.status).toBe(200);
    expect(workflow.rules[status(doneName()).id]?.fieldActions).toHaveLength(5);
  });

  it('clear and set fields, take the issue out of its sprint and watch it', async () => {
    const key = await create('Abschluss', { labels: ['offen', 'web'], dueDate: '2030-05-01' });
    const board = (
      await admin.request<Board>('POST', '/boards', {
        name: 'Team',
        projectKey: 'WEB',
        type: 'scrum',
      })
    ).body;
    const sprint = (await admin.request<Sprint>('POST', `/boards/${board.id}/sprints`, {})).body;
    await admin.request('POST', '/sprints/move-issues', { issueKeys: [key], sprintId: sprint.id });

    // Mira moves it; the transition changes the fields and has her watch it.
    const moved = await move(mira, key, doneName());
    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({ dueDate: null, sprint: null, watching: true });
    expect([...moved.body.labels].sort()).toEqual(['erledigt', 'web']);
    expect(moved.body.customFields[kunde.id]).toBe('Intern');
    const history = (await admin.request<ChangeGroup[]>('GET', `/issues/${key}/history`)).body;
    expect(history[0]?.items.map((item) => item.field).sort()).toEqual(
      [`cf:${kunde.id}`, 'dueDate', 'labels', 'resolution', 'sprint', 'status'].sort(),
    );
  });

  it('wait for blockers and a due date that has not passed', async () => {
    await publish({ [startedName()]: { blockersDone: true, dueNotPast: true } });
    const blocker = await create('Vorher');
    const key = await create('Nachher', { dueDate: '2020-01-01' });
    await admin.request('POST', `/issues/${key}/links`, {
      type: 'blocks',
      direction: 'inward',
      issueKey: blocker,
    });
    // A blocked issue is not offered the transition at all.
    expect(await offered(admin, key)).not.toContain(startedName());
    expect((await move(admin, key, startedName())).status).toBe(403);

    await admin.request('POST', `/issues/${blocker}/transitions`, {
      transitionId: `to-${status(doneName()).key}`,
    });
    expect(await offered(admin, key)).toContain(startedName());
    const late = await move(admin, key, startedName());
    expect(late.status).toBe(400);
    expect(JSON.stringify(late.body)).toContain('due date');
    await admin.request('PATCH', `/issues/${key}`, { dueDate: '2099-01-01' });
    expect((await move(admin, key, startedName())).status).toBe(200);
  });

  it('send transition webhooks only for the chosen statuses', async () => {
    // Earlier events go out before the webhook exists.
    await test.app.get(EventProcessor).drain();
    const hook = (
      await admin.request<CreatedWebhook>('POST', '/admin/webhooks', {
        name: 'Fertig',
        url: 'http://127.0.0.1:9/hook',
        events: ['issue.transitioned'],
        statusIds: [status(doneName()).id],
      })
    ).body;
    expect(hook.statusIds).toEqual([status(doneName()).id]);
    expect(
      (
        await admin.request('POST', '/admin/webhooks', {
          name: 'x',
          url: 'http://127.0.0.1:9/hook',
          events: ['issue.transitioned'],
          statusIds: ['0190c0de-0000-7000-8000-000000000000'],
        })
      ).status,
    ).toBe(400);
    await publish({});
    const key = await create('Haken');
    await move(admin, key, startedName());
    await move(admin, key, doneName());
    await test.app.get(EventProcessor).drain();
    const deliveries = (
      await admin.request<WebhookDelivery[]>('GET', `/admin/webhooks/${hook.id}/deliveries`)
    ).body;
    expect(deliveries).toHaveLength(1);
  });
});
