import type {
  ChangeGroup,
  Issue,
  ProjectDetails,
  SearchResult,
  TrackingMeta,
  Worklog,
} from '@toolvibes/shared';
import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { domainEvents, projectRoleMembers } from '../db/schema/index.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { webhookEventType } from '../webhooks/webhook.service.js';

let test: TestApp;
let admin: TestClient;
let jonas: TestClient;
let mira: TestClient;
const HOUR = 3600;

async function signIn(email: string): Promise<TestClient> {
  const client = new TestClient(test.baseUrl);
  await client.request('POST', '/auth/login', { email, password: 'ein-langes-passwort' });
  return client;
}

async function time(): Promise<Issue['timeTracking']> {
  return (await admin.request<Issue>('GET', '/issues/WEB-1')).body.timeTracking;
}

async function history(): Promise<Array<[string, string | null, string | null]>> {
  const groups = await admin.request<ChangeGroup[]>('GET', '/issues/WEB-1/history');
  return groups.body.flatMap((group) =>
    group.items.map(
      (item) => [item.field, item.from, item.to] as [string, string | null, string | null],
    ),
  );
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
  await create('jonas@example.org', 'Jonas Schulz');
  const miraId = await create('mira@example.org', 'Mira Kaya');
  jonas = await signIn('jonas@example.org');
  mira = await signIn('mira@example.org');
  const web = await admin.request<ProjectDetails>('POST', '/projects', {
    key: 'WEB',
    name: 'Web-Relaunch',
    template: 'scrum',
  });
  // Mira develops in WEB; Jonas only has the default "users" role.
  await test.database.db
    .insert(projectRoleMembers)
    .values({ id: uuidv7(), projectId: web.body.id, role: 'developers', userId: miraId });
  await admin.request('POST', '/issues', {
    projectKey: 'WEB',
    issueType: 'task',
    summary: 'Login',
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('estimates', () => {
  it('uses the first estimate as remaining estimate and records both', async () => {
    const meta = await jonas.request<TrackingMeta>('GET', '/tracking/meta');
    expect(meta.body.workingTime).toEqual({ hoursPerDay: 8, daysPerWeek: 5 });
    const updated = await admin.request<Issue>('PATCH', '/issues/WEB-1', {
      originalEstimate: '1d',
    });
    expect(updated.body.timeTracking).toEqual({
      originalEstimateSeconds: 8 * HOUR,
      remainingEstimateSeconds: 8 * HOUR,
      timeSpentSeconds: 0,
    });
    expect(await history()).toEqual(
      expect.arrayContaining([
        ['originalEstimate', null, '1d'],
        ['remainingEstimate', null, '1d'],
      ]),
    );
    expect(
      (await admin.request('PATCH', '/issues/WEB-1', { originalEstimate: 'soon' })).status,
    ).toBe(400);
  });
});

describe('worklogs', () => {
  let first: Worklog;

  it('reduces the remaining estimate automatically', async () => {
    const logged = await mira.request<Worklog>('POST', '/issues/WEB-1/worklogs', {
      timeSpent: '2h',
      comment: 'Analyse',
      started: '2026-10-28T09:00:00+01:00',
    });
    expect(logged.status).toBe(201);
    first = logged.body;
    expect(first).toMatchObject({
      timeSpentSeconds: 2 * HOUR,
      comment: 'Analyse',
      author: { displayName: 'Mira Kaya' },
      started: '2026-10-28T08:00:00.000Z',
      canEdit: true,
      canDelete: true,
    });
    expect(await time()).toMatchObject({
      remainingEstimateSeconds: 6 * HOUR,
      timeSpentSeconds: 2 * HOUR,
    });
  });

  it('can leave the remaining estimate or set it, and only the set value is history', async () => {
    await mira.request('POST', '/issues/WEB-1/worklogs', {
      timeSpent: '1h',
      remaining: { mode: 'leave' },
    });
    expect(await time()).toMatchObject({
      remainingEstimateSeconds: 6 * HOUR,
      timeSpentSeconds: 3 * HOUR,
    });
    await mira.request('POST', '/issues/WEB-1/worklogs', {
      timeSpent: '30m',
      remaining: { mode: 'set', value: '4h' },
    });
    expect(await time()).toMatchObject({
      remainingEstimateSeconds: 4 * HOUR,
      timeSpentSeconds: 3.5 * HOUR,
    });
    expect(await history()).toContainEqual(['remainingEstimate', '6h', '4h']);
    expect(
      (await mira.request('POST', '/issues/WEB-1/worklogs', { timeSpent: 'viel' })).status,
    ).toBe(400);
  });

  it('needs edit-issues to log work', async () => {
    expect(
      (await jonas.request('POST', '/issues/WEB-1/worklogs', { timeSpent: '1h' })).status,
    ).toBe(403);
  });

  it('lists worklogs with what each person may do', async () => {
    const own = await mira.request<Worklog[]>('GET', '/issues/WEB-1/worklogs');
    expect(own.body).toHaveLength(3);
    const asAdmin = await admin.request<Worklog[]>('GET', '/issues/WEB-1/worklogs');
    expect(asAdmin.body.every((entry) => !entry.canEdit && entry.canDelete)).toBe(true);
  });

  it('lets the author change a worklog and moves the estimate by the difference', async () => {
    const changed = await mira.request<Worklog>('PATCH', `/issues/WEB-1/worklogs/${first.id}`, {
      timeSpent: '3h',
    });
    expect(changed.body.timeSpentSeconds).toBe(3 * HOUR);
    expect(await time()).toMatchObject({
      remainingEstimateSeconds: 3 * HOUR,
      timeSpentSeconds: 4.5 * HOUR,
    });
    expect(
      (await admin.request('PATCH', `/issues/WEB-1/worklogs/${first.id}`, { comment: 'x' })).status,
    ).toBe(403);
  });

  it('gives the time back when a project administrator deletes a worklog', async () => {
    expect((await admin.request('DELETE', `/issues/WEB-1/worklogs/${first.id}`)).status).toBe(204);
    expect(await time()).toMatchObject({
      remainingEstimateSeconds: 6 * HOUR,
      timeSpentSeconds: 1.5 * HOUR,
    });
    expect((await mira.request<Worklog[]>('GET', '/issues/WEB-1/worklogs')).body).toHaveLength(2);
  });

  it('writes outbox events that become worklog webhooks', async () => {
    const events = await test.database.db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.type, 'issue.worklog'));
    expect(events.map((event) => (event.payload as { action: string }).action)).toEqual([
      'created',
      'created',
      'created',
      'updated',
      'deleted',
    ]);
    expect(
      webhookEventType({
        type: 'issue.worklog',
        action: 'deleted',
        worklogId: 'x',
        timeSpentSeconds: 1,
      }),
    ).toBe('worklog.deleted');
  });
});

describe('working time and search', () => {
  it('finds issues by time values', async () => {
    const search = async (query: string) =>
      (await admin.request<SearchResult>('POST', '/search', { query })).body.issues.map(
        (issue) => issue.key,
      );
    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Ohne Schätzung',
    });
    expect(await search('timeSpent > 1h')).toEqual(['WEB-1']);
    expect(await search('remainingEstimate >= "6h" AND originalEstimate = 1d')).toEqual(['WEB-1']);
    expect(await search('originalEstimate is EMPTY')).toEqual(['WEB-2']);
    expect(await search('project = WEB ORDER BY timeSpent DESC')).toEqual(['WEB-1', 'WEB-2']);
  });

  it('lets administrators change the length of a day', async () => {
    expect((await jonas.request('GET', '/admin/time-tracking')).status).toBe(403);
    const changed = await admin.request('PUT', '/admin/time-tracking', {
      hoursPerDay: 6,
      daysPerWeek: 5,
    });
    expect(changed.body).toEqual({ hoursPerDay: 6, daysPerWeek: 5 });
    expect(
      (await mira.request<TrackingMeta>('GET', '/tracking/meta')).body.workingTime.hoursPerDay,
    ).toBe(6);
    await mira.request('POST', '/issues/WEB-1/worklogs', {
      timeSpent: '1d',
      remaining: { mode: 'leave' },
    });
    expect((await time()).timeSpentSeconds).toBe(1.5 * HOUR + 6 * HOUR);
    const invalid = await admin.request('PUT', '/admin/time-tracking', {
      hoursPerDay: 30,
      daysPerWeek: 5,
    });
    expect(invalid.status).toBe(400);
  });
});
