import type { Issue, TimePivot, TimerState, Timesheet, Worklog } from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let miraId = '';
const monday = '2026-10-26';

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  miraId = (
    await admin.request<{ id: string }>('POST', '/admin/users', {
      email: 'mira@example.org',
      displayName: 'Mira Kaya',
      password: 'ein-langes-passwort',
    })
  ).body.id;
  // Mira sees WEB only.
  await admin.request('DELETE', `/admin/groups/users/members/${miraId}`);
  mira = new TestClient(test.baseUrl);
  await mira.request('POST', '/auth/login', {
    email: 'mira@example.org',
    password: 'ein-langes-passwort',
  });
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  await admin.request('POST', '/projects', { key: 'OPS', name: 'Betrieb', template: 'kanban' });
  await admin.request('POST', '/projects/WEB/members', { role: 'developers', userId: miraId });
  await admin.request('POST', '/issues', { projectKey: 'WEB', issueType: 'epic', summary: 'Shop' });
  for (const summary of ['Warenkorb', 'Kasse']) {
    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'story',
      summary,
      parentKey: 'WEB-1',
    });
  }
  await admin.request('POST', '/issues', {
    projectKey: 'OPS',
    issueType: 'task',
    summary: 'Backup',
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('timesheet (TL-24)', () => {
  it('creates, changes and removes the day’s worklog from a cell', async () => {
    const set = (issueKey: string, date: string, seconds: number) =>
      admin.request<Timesheet>('PUT', '/timesheet/cells', { issueKey, date, seconds });
    await set('WEB-2', '2026-10-27', 2 * 3600);
    await set('OPS-1', '2026-10-28', 3600);
    let sheet = (await set('WEB-2', '2026-10-27', 90 * 60)).body;
    expect(sheet.week).toBe(monday);
    expect(sheet.days).toHaveLength(7);
    const row = sheet.rows.find((entry) => entry.issue.key === 'WEB-2');
    expect(row?.cells[1]).toMatchObject({ date: '2026-10-27', seconds: 5400 });
    expect(row?.cells[1]?.worklogIds).toHaveLength(1);
    expect(sheet.total).toBe(5400 + 3600);
    // A second worklog that day makes the cell a list.
    await admin.request('POST', '/issues/WEB-2/worklogs', {
      timeSpent: '30m',
      started: '2026-10-27T15:00:00.000Z',
    });
    expect((await set('WEB-2', '2026-10-27', 0)).status).toBe(409);
    sheet = (await set('OPS-1', '2026-10-28', 0)).body;
    expect(sheet.rows.map((entry) => entry.issue.key)).toEqual(['WEB-2']);
  });

  it('shows others only what the viewer may see, and read-only', async () => {
    await admin.request('PUT', '/timesheet/cells', {
      issueKey: 'OPS-1',
      date: '2026-10-29',
      seconds: 3600,
    });
    const lenaId = (await admin.request<{ id: string }>('GET', '/me')).body.id;
    const seen = (await mira.request<Timesheet>('GET', `/timesheet?user=${lenaId}&week=2026-10-29`))
      .body;
    expect(seen.editable).toBe(false);
    expect(seen.rows.map((entry) => entry.issue.key)).toEqual(['WEB-2']);
    expect(
      (
        await mira.request('PUT', '/timesheet/cells', {
          issueKey: 'OPS-1',
          date: '2026-10-29',
          seconds: 60,
        })
      ).status,
    ).toBe(404);
  });

  it('runs one timer per person and logs it when stopped', async () => {
    expect((await mira.request<TimerState>('GET', '/me/timer')).body).toEqual({ timer: null });
    const started = await mira.request<TimerState>('POST', '/issues/WEB-3/timer');
    expect(started.status).toBe(201);
    expect(started.body.timer?.issue.key).toBe('WEB-3');
    expect((await mira.request('POST', '/issues/WEB-2/timer')).status).toBe(409);
    const worklog = await mira.request<Worklog>('POST', '/me/timer/stop', { comment: 'Kasse' });
    expect(worklog.body).toMatchObject({ timeSpentSeconds: 60, comment: 'Kasse' });
    expect((await mira.request<TimerState>('GET', '/me/timer')).body.timer).toBeNull();
    await mira.request('POST', '/issues/WEB-2/timer');
    expect((await mira.request('DELETE', '/me/timer')).status).toBe(204);
    expect((await mira.request<Issue>('GET', '/issues/WEB-2')).body.timeTracking).toBeDefined();
  });

  it('pivots logged time by person and week, and by epic', async () => {
    const byPerson = (
      await admin.request<TimePivot>('POST', '/reports/time-pivot', {
        query: '',
        from: '2026-10-01',
        to: '2026-12-31',
        groupBy: 'person',
        period: 'week',
      })
    ).body;
    expect(byPerson.columns[0]).toBe(monday);
    expect(byPerson.rows.find((row) => row.label === 'Lena Vogt')?.values[0]).toBe(
      5400 + 1800 + 3600,
    );
    const byEpic = (
      await admin.request<TimePivot>('POST', '/reports/time-pivot', {
        query: 'project = WEB',
        from: '2026-10-01',
        // The timer minute is logged today; the range must reach it whatever today is.
        to: new Date().toISOString().slice(0, 10),
        groupBy: 'epic',
        period: 'none',
      })
    ).body;
    expect(byEpic.columns).toEqual(['total']);
    // Lena's 1h30 + 30m on WEB-2 and Mira's timer minute on WEB-3, both under the epic.
    expect(byEpic.rows).toEqual([
      { key: expect.any(String), label: 'WEB-1 Shop', values: [7260], total: 7260 },
    ]);
  });
});
