import type { AutomationRule, AutomationRun, ChangeGroup, Comment, Issue } from '@tasklore/shared';
import { AUTOMATION_ACTOR_ID } from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EventProcessor } from '../events/event-processor.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { AutomationEngine } from './automation.engine.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;

async function drain(): Promise<void> {
  const processor = test.app.get(EventProcessor);
  await test.app.get(AutomationEngine).drain(() => processor.drain());
}

async function rule(body: Record<string, unknown>): Promise<AutomationRule> {
  const created = await admin.request<AutomationRule>('POST', '/automation/rules', {
    projectKey: 'WEB',
    ...body,
  });
  expect(created.status).toBe(201);
  return created.body;
}

async function runs(id: string): Promise<AutomationRun[]> {
  return (await admin.request<AutomationRun[]>('GET', `/automation/rules/${id}/runs`)).body;
}

async function comments(key: string): Promise<string[]> {
  const list = (await admin.request<Comment[]>('GET', `/issues/${key}/comments?format=markdown`))
    .body;
  return list.map((comment) => String(comment.body).trim());
}

async function disable(target: AutomationRule): Promise<void> {
  await admin.request('PUT', `/automation/rules/${target.id}`, {
    name: target.name,
    projectKey: target.project?.key ?? null,
    trigger: target.trigger,
    components: target.components,
    enabled: false,
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
  await admin.request('POST', '/projects', { key: 'OPS', name: 'Betrieb', template: 'kanban' });
  await admin.request('POST', '/projects/WEB/members', { role: 'developers', userId: miraId });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('automation rules (TL-22)', () => {
  it('are managed by project administrators only', async () => {
    const body = {
      name: 'Nicht erlaubt',
      projectKey: 'WEB',
      trigger: { type: 'issue-created' },
      components: [],
    };
    expect((await mira.request('POST', '/automation/rules', body)).status).toBe(403);
    expect(
      (await mira.request('POST', '/automation/rules', { ...body, projectKey: null })).status,
    ).toBe(403);
    expect(
      (
        await admin.request('POST', '/automation/rules', {
          ...body,
          trigger: { type: 'schedule', cron: 'jeden Tag', query: '' },
        })
      ).status,
    ).toBe(400);
  });

  it('assigns new issues to their creator, as the automation actor', async () => {
    const assign = await rule({
      name: 'Ersteller zuweisen',
      trigger: { type: 'issue-created' },
      components: [
        { type: 'user', who: 'assignee', check: 'empty' },
        { type: 'assign', to: 'initiator' },
      ],
    });
    await mira.request('POST', '/issues', { projectKey: 'WEB', issueType: 'story', summary: 'A' });
    await drain();
    const issue = (await admin.request<Issue>('GET', '/issues/WEB-1')).body;
    expect(issue.assignee?.displayName).toBe('Mira Kaya');
    const history = (await admin.request<ChangeGroup[]>('GET', '/issues/WEB-1/history')).body;
    expect(history[0]?.author?.id).toBe(AUTOMATION_ACTOR_ID);
    expect((await runs(assign.id))[0]).toMatchObject({ status: 'success', issueKey: 'WEB-1' });
    await disable(assign);
  });

  it('closes the parent when the last subtask is done', async () => {
    await admin.request('POST', '/issues', { projectKey: 'WEB', issueType: 'story', summary: 'P' });
    for (const summary of ['S1', 'S2']) {
      await admin.request('POST', '/issues', {
        projectKey: 'WEB',
        issueType: 'subtask',
        summary,
        parentKey: 'WEB-2',
      });
    }
    const close = await rule({
      name: 'Eltern schließen',
      trigger: { type: 'issue-transitioned', to: 'Erledigt' },
      components: [
        {
          type: 'branch',
          over: 'parent',
          components: [
            {
              type: 'tql',
              query: 'parent = {{issue.key}} AND statusCategory != done',
              mode: 'none',
            },
            { type: 'transition', to: 'Erledigt' },
          ],
        },
      ],
    });
    await admin.request('POST', '/issues/WEB-3/transitions', {
      transitionId: 'to-done',
      resolution: 'done',
    });
    await drain();
    expect((await admin.request<Issue>('GET', '/issues/WEB-2')).body.status.name).not.toBe(
      'Erledigt',
    );
    await admin.request('POST', '/issues/WEB-4/transitions', {
      transitionId: 'to-done',
      resolution: 'done',
    });
    await drain();
    expect((await admin.request<Issue>('GET', '/issues/WEB-2')).body.status.name).toBe('Erledigt');
    await disable(close);
  });

  it('fills smart values into comments and fields', async () => {
    const remind = await rule({
      name: 'Bei Priorität kommentieren',
      trigger: { type: 'field-changed', fields: ['priority'] },
      components: [
        {
          type: 'compare',
          left: '{{issue.priority.name}}',
          operator: 'equals',
          right: 'Hoch',
        },
        { type: 'set-field', field: 'dueDate', value: '{{now.plusDays(2)}}' },
        {
          type: 'comment',
          body: '{{initiator.displayName}} hat {{issue.key}} auf {{issue.priority.name}} gesetzt, fällig {{issue.dueDate}}.',
        },
      ],
    });
    await admin.request('PATCH', '/issues/WEB-1', { priority: 'high' });
    await drain();
    const issue = (await admin.request<Issue>('GET', '/issues/WEB-1')).body;
    expect(issue.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await comments('WEB-1')).toContain(
      `Lena Vogt hat WEB-1 auf Hoch gesetzt, fällig ${issue.dueDate}.`,
    );
    await disable(remind);
  });

  it('stops loops: no self-triggering, and a chain depth of ten', async () => {
    const quiet = await rule({
      name: 'Ohne Selbstauslösung',
      trigger: { type: 'field-changed', fields: ['summary'] },
      components: [{ type: 'set-field', field: 'summary', value: '{{issue.summary}}!' }],
    });
    await admin.request('PATCH', '/issues/WEB-1', { summary: 'Loop' });
    await drain();
    expect((await admin.request<Issue>('GET', '/issues/WEB-1')).body.summary).toBe('Loop!');
    await disable(quiet);

    const loud = await rule({
      name: 'Mit Selbstauslösung',
      trigger: { type: 'field-changed', fields: ['summary'] },
      allowSelfTrigger: true,
      components: [{ type: 'set-field', field: 'summary', value: '{{issue.summary}}!' }],
    });
    await admin.request('PATCH', '/issues/WEB-1', { summary: 'Loop' });
    await drain();
    expect((await admin.request<Issue>('GET', '/issues/WEB-1')).body.summary).toBe(
      `Loop${'!'.repeat(10)}`,
    );
    expect((await runs(loud.id))[0]?.status).toBe('loop');
    await disable(loud);
  });

  it('reacts to released versions and branches over a query', async () => {
    const version = (
      await admin.request<{ id: string }>('POST', '/projects/WEB/versions', { name: '1.0' })
    ).body;
    await admin.request('PATCH', '/issues/WEB-1', { fixVersions: ['1.0'] });
    const released = await rule({
      name: 'Ausgeliefert',
      trigger: { type: 'version-released' },
      components: [
        {
          type: 'branch',
          over: 'query',
          query: 'fixVersion = "{{version.name}}"',
          components: [{ type: 'comment', body: 'Ausgeliefert mit {{version.name}}.' }],
        },
      ],
    });
    await admin.request('POST', `/projects/WEB/versions/${version.id}/release`, {});
    await drain();
    expect(await comments('WEB-1')).toContain('Ausgeliefert mit 1.0.');
    await disable(released);
  });

  it('runs on a schedule and stays inside its project', async () => {
    await admin.request('POST', '/issues', { projectKey: 'OPS', issueType: 'task', summary: 'X' });
    const daily = await rule({
      name: 'Jede Minute',
      trigger: { type: 'schedule', cron: '* * * * *', query: 'key in (WEB-2, OPS-1)' },
      components: [{ type: 'comment', body: 'Geplant für {{issue.key}}' }],
    });
    await test.app.get(AutomationEngine).tickSchedules();
    // The same minute does not run twice.
    await test.app.get(AutomationEngine).tickSchedules();
    await drain();
    expect(await comments('WEB-2')).toEqual(['Geplant für WEB-2']);
    expect(await comments('OPS-1')).toEqual([]);
    await disable(daily);
  });

  it('starts from an incoming webhook with its secret', async () => {
    const hook = await rule({
      name: 'Von außen',
      trigger: { type: 'incoming-webhook' },
      components: [{ type: 'comment', body: 'Build {{webhookData.build}} ist durch.' }],
    });
    expect(hook.webhookUrl).toContain(`/api/v1/automation/hooks/${hook.id}?token=`);
    const anonymous = new TestClient(test.baseUrl);
    expect(
      (await anonymous.request('POST', `/automation/hooks/${hook.id}?token=falsch`, {})).status,
    ).toBe(401);
    const token = new URL(hook.webhookUrl ?? '', 'http://x').searchParams.get('token');
    const called = await anonymous.request<{ queued: number }>(
      'POST',
      `/automation/hooks/${hook.id}?token=${token}`,
      { issues: ['WEB-2', 'OPS-1'], build: 42 },
    );
    expect(called.body).toEqual({ queued: 1 });
    await drain();
    expect(await comments('WEB-2')).toContain('Build 42 ist durch.');
  });
});
