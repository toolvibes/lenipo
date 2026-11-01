import type {
  CreatedResolved,
  Dashboard,
  DashboardSummary,
  Favourite,
  Statistics,
} from '@toolvibes/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';

let test: TestApp;
let admin: TestClient;
let olaf: TestClient;
let dashboard: Dashboard;

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  const olafId = (
    await admin.request<{ id: string }>('POST', '/admin/users', {
      email: 'olaf@example.org',
      displayName: 'Olaf Alt',
      password: 'ein-langes-passwort',
    })
  ).body.id;
  // Olaf sees only OPS, not WEB.
  await admin.request('DELETE', `/admin/groups/users/members/${olafId}`);
  olaf = new TestClient(test.baseUrl);
  await olaf.request('POST', '/auth/login', {
    email: 'olaf@example.org',
    password: 'ein-langes-passwort',
  });
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
  await admin.request('POST', '/projects', { key: 'OPS', name: 'Betrieb', template: 'kanban' });
  await admin.request('POST', '/projects/OPS/members', { role: 'developers', userId: olafId });
  for (const [projectKey, summary, labels] of [
    ['WEB', 'Startseite', ['ui', 'seo']],
    ['WEB', 'Suche', ['ui']],
    ['WEB', 'Login', []],
    ['OPS', 'Backup', ['ui']],
  ] as const) {
    await admin.request('POST', '/issues', {
      projectKey,
      issueType: 'task',
      summary,
      labels,
    });
  }
  await admin.request('POST', '/issues/WEB-3/transitions', {
    transitionId: 'to-done',
    resolution: 'done',
  });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('dashboards (TL-20)', () => {
  it('holds gadgets in columns and keeps them when the layout shrinks', async () => {
    const created = await admin.request<Dashboard>('POST', '/dashboards', {
      name: 'Team',
      layout: 'three',
    });
    expect(created.status).toBe(201);
    expect(created.body.columns).toHaveLength(3);
    const id = created.body.id;
    await admin.request('POST', `/dashboards/${id}/gadgets`, {
      column: 0,
      config: { type: 'assigned-to-me' },
    });
    await admin.request('POST', `/dashboards/${id}/gadgets`, {
      column: 0,
      title: 'Nach Status',
      config: { type: 'pie', query: 'project = WEB', field: 'status' },
    });
    const third = await admin.request<Dashboard>('POST', `/dashboards/${id}/gadgets`, {
      column: 2,
      config: { type: 'text', markdown: '**Hallo**' },
    });
    // New gadgets go on top.
    expect(third.body.columns[0]?.map((gadget) => gadget.config.type)).toEqual([
      'pie',
      'assigned-to-me',
    ]);
    expect(third.body.columns[0]?.[1]?.config).toEqual({ type: 'assigned-to-me', limit: 10 });
    expect(
      (
        await admin.request('POST', `/dashboards/${id}/gadgets`, {
          config: { type: 'filter-results', query: 'project = = WEB' },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await admin.request('POST', `/dashboards/${id}/gadgets`, {
          config: { type: 'wiki-page', pageId: '01a00000-0000-7000-8000-000000000000' },
        })
      ).status,
    ).toBe(404);

    const two = await admin.request<Dashboard>('PATCH', `/dashboards/${id}`, { layout: 'two' });
    expect(two.body.columns.map((column) => column.length)).toEqual([2, 1]);
    const [left, right] = two.body.columns as [Dashboard['columns'][0], Dashboard['columns'][0]];
    expect(
      (
        await admin.request('PUT', `/dashboards/${id}/arrangement`, {
          columns: [[left[0]?.id], [right[0]?.id]],
        })
      ).status,
    ).toBe(400);
    const arranged = await admin.request<Dashboard>('PUT', `/dashboards/${id}/arrangement`, {
      columns: [[right[0]?.id, left[1]?.id], [left[0]?.id]],
    });
    expect(arranged.body.columns.map((column) => column.map((g) => g.config.type))).toEqual([
      ['text', 'assigned-to-me'],
      ['pie'],
    ]);
    dashboard = arranged.body;
  });

  it('is viewed through shares, edited by the owner and copied by others', async () => {
    const id = dashboard.id;
    expect((await olaf.request('GET', `/dashboards/${id}`)).status).toBe(404);
    await admin.request('PATCH', `/dashboards/${id}`, { shares: [{ type: 'authenticated' }] });
    const seen = await olaf.request<Dashboard>('GET', `/dashboards/${id}`);
    expect(seen.body).toMatchObject({ name: 'Team', editable: false, favourite: false });
    expect((await olaf.request('PATCH', `/dashboards/${id}`, { name: 'Meins' })).status).toBe(403);
    const gadgetId = dashboard.columns[0]?.[0]?.id;
    expect((await olaf.request('DELETE', `/dashboards/${id}/gadgets/${gadgetId}`)).status).toBe(
      403,
    );
    const copy = await olaf.request<Dashboard>('POST', `/dashboards/${id}/copy`, {
      name: 'Meine Übersicht',
    });
    expect(copy.status).toBe(201);
    expect(copy.body).toMatchObject({ editable: true, favourite: true, shares: [] });
    expect(copy.body.columns.flat()).toHaveLength(3);
    const shared = (await olaf.request<DashboardSummary[]>('GET', '/dashboards?scope=shared')).body;
    expect(shared.map((entry) => entry.name)).toEqual(['Team']);
  });

  it('can be the start page and a favourite', async () => {
    const id = dashboard.id;
    expect((await olaf.request('PUT', `/dashboards/${id}/home`)).status).toBe(204);
    const home = (await olaf.request<DashboardSummary[]>('GET', '/dashboards?scope=home')).body;
    expect(home.map((entry) => entry.id)).toEqual([id]);
    expect(home[0]?.home).toBe(true);
    expect((await olaf.request('PUT', `/me/favourites/dashboard/${id}`)).status).toBe(204);
    const favourites = (await olaf.request<Favourite[]>('GET', '/me/favourites')).body;
    expect(favourites.filter((entry) => entry.kind === 'dashboard').map((e) => e.name)).toEqual(
      expect.arrayContaining(['Team', 'Meine Übersicht']),
    );
    // Unshared, it is gone from start page and favourites.
    await admin.request('PATCH', `/dashboards/${id}`, { shares: [] });
    expect((await olaf.request<DashboardSummary[]>('GET', '/dashboards?scope=home')).body).toEqual(
      [],
    );
    const after = (await olaf.request<Favourite[]>('GET', '/me/favourites')).body;
    expect(after.map((entry) => entry.name)).not.toContain('Team');
  });

  it('counts issues by one or two fields with the viewer’s permissions', async () => {
    const byStatus = (
      await admin.request<Statistics>('POST', '/reports/statistics', {
        query: 'project = WEB',
        x: 'statusCategory',
      })
    ).body;
    expect(byStatus.total).toBe(3);
    const counts = Object.fromEntries(
      byStatus.x.map((value, index) => [value.key, byStatus.counts[index]?.[0]]),
    );
    expect(counts).toEqual({ todo: 2, done: 1 });

    const grid = (
      await admin.request<Statistics>('POST', '/reports/statistics', {
        query: '',
        x: 'label',
        y: 'project',
      })
    ).body;
    expect(grid.x.map((value) => value.key)).toEqual(['ui', 'seo', null]);
    expect(grid.y?.map((value) => value.label)).toEqual(['Web', 'Betrieb']);
    expect(grid.counts).toEqual([
      [2, 1],
      [1, 0],
      [1, 0],
    ]);
    // Olaf only counts what he may see.
    const his = (
      await olaf.request<Statistics>('POST', '/reports/statistics', { query: '', x: 'label' })
    ).body;
    expect(his).toMatchObject({ total: 1, counts: [[1]] });
    expect(
      (await admin.request('POST', '/reports/statistics', { query: 'foo ~', x: 'status' })).status,
    ).toBe(400);
  });

  it('gives created and resolved issues per day', async () => {
    const series = (
      await admin.request<CreatedResolved>('POST', '/reports/created-vs-resolved', {
        query: '',
        days: 7,
      })
    ).body;
    expect(series.points).toHaveLength(7);
    expect(series.points.at(-1)).toMatchObject({ created: 4, resolved: 1 });
    expect(series.points.slice(0, 6).every((point) => point.created === 0)).toBe(true);
  });

  it('is deleted by its owner only', async () => {
    const mine = (await olaf.request<DashboardSummary[]>('GET', '/dashboards?scope=mine')).body;
    expect((await admin.request('DELETE', `/dashboards/${mine[0]?.id}`)).status).toBe(404);
    expect((await olaf.request('DELETE', `/dashboards/${mine[0]?.id}`)).status).toBe(204);
    const favourites = (await olaf.request<Favourite[]>('GET', '/me/favourites')).body;
    expect(favourites.filter((entry) => entry.kind === 'dashboard')).toEqual([]);
  });
});
