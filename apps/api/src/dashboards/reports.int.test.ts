import type {
  AverageAge,
  BoardSummary,
  ControlChart,
  Dashboard,
  FieldSeries,
  ScopeProgress,
  Sprint,
  TimeReport,
} from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let boardId = '';

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());

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
  for (const [summary, storyPoints] of [
    ['Startseite', 3],
    ['Suche', 5],
    ['Login', 2],
  ] as const) {
    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'story',
      summary,
      storyPoints,
    });
  }
  boardId = (
    await admin.request<BoardSummary>('POST', '/boards', {
      name: 'Team',
      projectKey: 'WEB',
      type: 'scrum',
    })
  ).body.id;
  const sprint = (await admin.request<Sprint>('POST', `/boards/${boardId}/sprints`, {})).body;
  await admin.request('POST', '/sprints/move-issues', {
    issueKeys: ['WEB-1', 'WEB-2', 'WEB-3'],
    sprintId: sprint.id,
  });
  await admin.request('POST', `/sprints/${sprint.id}/start`, {
    startDate: today,
    endDate: today,
  });
  // WEB-1 goes through "in progress", WEB-2 straight to done, WEB-3 stays open.
  await admin.request('POST', '/issues/WEB-1/transitions', { transitionId: 'to-in-progress' });
  for (const key of ['WEB-1', 'WEB-2']) {
    await admin.request('POST', `/issues/${key}/transitions`, {
      transitionId: 'to-done',
      resolution: 'done',
    });
  }
  await admin.request('POST', `/sprints/${sprint.id}/complete`, { moveTo: 'backlog' });
  await admin.request('PATCH', '/issues/WEB-3', { originalEstimate: '1d' });
  await admin.request('POST', '/issues/WEB-3/worklogs', { timeSpent: '2h' });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('reports (TL-21)', () => {
  it('rebuilds issues per status for each day (cumulative flow)', async () => {
    const series = (
      await admin.request<FieldSeries>('POST', '/reports/field-series', {
        query: 'project = WEB',
        field: 'statusCategory',
        days: 7,
      })
    ).body;
    expect(series.dates).toHaveLength(7);
    expect(series.dates.at(-1)).toBe(today);
    const last = Object.fromEntries(
      series.values.map((value, index) => [value.key, series.counts[index]?.at(-1)]),
    );
    expect(last).toEqual({ todo: 1, done: 2 });
    // Nothing existed a week ago.
    expect(series.counts.every((line) => line[0] === 0)).toBe(true);
    const byStatus = (
      await admin.request<FieldSeries>('POST', '/reports/field-series', {
        query: 'project = WEB',
        field: 'status',
        days: 7,
      })
    ).body;
    expect(byStatus.values.map((value) => value.label)).toEqual(['Offen', 'Erledigt']);
  });

  it('measures lead and cycle time of resolved issues', async () => {
    const chart = (
      await admin.request<ControlChart>('POST', '/reports/control-chart', {
        query: 'project = WEB',
        days: 30,
      })
    ).body;
    expect(chart.points.map((point) => point.key).sort()).toEqual(['WEB-1', 'WEB-2']);
    const byKey = Object.fromEntries(chart.points.map((point) => [point.key, point]));
    expect(byKey['WEB-1']?.cycleDays).toBeGreaterThanOrEqual(0);
    expect(byKey['WEB-2']?.cycleDays).toBeNull();
    expect(chart.lead.average).not.toBeNull();
    expect(chart.cycle.p85).not.toBeNull();
  });

  it('counts open issues and their age', async () => {
    const age = (
      await admin.request<AverageAge>('POST', '/reports/average-age', {
        query: 'project = WEB',
        days: 7,
      })
    ).body;
    expect(age.points.at(-1)).toMatchObject({ date: today, open: 1 });
    expect(age.points[0]).toMatchObject({ open: 0, averageDays: 0 });
  });

  it('shows release progress per closed sprint with a forecast', async () => {
    const progress = (
      await admin.request<ScopeProgress>('POST', '/reports/scope-progress', {
        boardId,
        query: 'project = WEB',
      })
    ).body;
    expect(progress).toMatchObject({
      estimation: 'storyPoints',
      scope: 10,
      done: 8,
      remaining: 2,
      velocity: 8,
      forecastSprints: 1,
    });
    expect(progress.sprints).toHaveLength(1);
    expect(progress.sprints[0]).toMatchObject({ scope: 10, added: 10, done: 8, remaining: 2 });
  });

  it('sums estimates, time spent and time logged per person', async () => {
    const report = (
      await admin.request<TimeReport>('POST', '/reports/time-tracking', {
        query: 'project = WEB',
        from: today,
        to: today,
      })
    ).body;
    expect(report.issues.map((issue) => issue.key)).toEqual(['WEB-3']);
    expect(report.issues[0]).toMatchObject({
      originalEstimateSeconds: 8 * 3600,
      timeSpentSeconds: 2 * 3600,
      loggedSeconds: 2 * 3600,
    });
    expect(report.people).toEqual([
      { user: { id: expect.any(String), displayName: 'Lena Vogt' }, loggedSeconds: 7200 },
    ]);
    const before = (
      await admin.request<TimeReport>('POST', '/reports/time-tracking', {
        query: 'project = WEB',
        from: '2020-01-01',
        to: '2020-01-31',
      })
    ).body;
    expect(before.totals.loggedSeconds).toBe(0);
  });

  it('puts any report on a dashboard', async () => {
    const dashboard = (await admin.request<Dashboard>('POST', '/dashboards', { name: 'Berichte' }))
      .body;
    const added = await admin.request<Dashboard>('POST', `/dashboards/${dashboard.id}/gadgets`, {
      config: { type: 'report', report: { kind: 'control-chart', query: 'project = WEB' } },
    });
    expect(added.status).toBe(201);
    expect(added.body.columns[0]?.[0]?.config).toEqual({
      type: 'report',
      report: { kind: 'control-chart', query: 'project = WEB', days: 30 },
    });
    expect(
      (
        await admin.request('POST', `/dashboards/${dashboard.id}/gadgets`, {
          config: { type: 'report', report: { kind: 'cfd', query: 'project = = WEB' } },
        })
      ).status,
    ).toBe(400);
  });
});
