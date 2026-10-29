import type {
  ActivityPage,
  Favourite,
  NotificationList,
  ProjectDetails,
  ProjectSummary,
  RecentItem,
  SavedFilter,
} from '@tasklore/shared';
import { and, count, eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { favourites, groups, projectRoleMembers, recentItems } from '../db/schema/index.js';
import { EventProcessor } from '../events/event-processor.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { docFromText } from '../tracking/rich-text.js';

let test: TestApp;
let admin: TestClient;
let jonas: TestClient;
let jonasId: string;

beforeAll(async () => {
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  jonasId = (
    await admin.request<{ id: string }>('POST', '/admin/users', {
      email: 'jonas@example.org',
      displayName: 'Jonas Schulz',
      password: 'ein-langes-passwort',
    })
  ).body.id;
  jonas = new TestClient(test.baseUrl);
  await jonas.request('POST', '/auth/login', {
    email: 'jonas@example.org',
    password: 'ein-langes-passwort',
  });
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web-Relaunch', template: 'scrum' });
  const sec = await admin.request<ProjectDetails>('POST', '/projects', {
    key: 'SEC',
    name: 'Sicherheit',
    template: 'basic',
  });
  // SEC stays invisible to Jonas: without the default role of the "users" group.
  const [usersGroup] = await test.database.db.select().from(groups).where(eq(groups.name, 'users'));
  await test.database.db
    .delete(projectRoleMembers)
    .where(
      and(
        eq(projectRoleMembers.projectId, sec.body.id),
        eq(projectRoleMembers.groupId, usersGroup?.id ?? ''),
      ),
    );

  await admin.request('POST', '/issues', {
    projectKey: 'WEB',
    issueType: 'task',
    summary: 'Login',
    assigneeId: jonasId,
  });
  await admin.request('POST', '/issues', {
    projectKey: 'SEC',
    issueType: 'task',
    summary: 'Audit',
  });
  await jonas.request('POST', '/issues/WEB-1/comments', {
    body: docFromText('Ich schaue es mir an'),
  });
  await admin.request('POST', '/issues/WEB-1/transitions', { transitionId: 'to-in-progress' });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('activity stream', () => {
  it('shows new issues, changes and comments of visible projects, newest first', async () => {
    const page = await jonas.request<ActivityPage>('GET', '/activity');
    expect(page.status).toBe(200);
    expect(page.body.entries.map((entry) => [entry.kind, entry.issue.key])).toEqual([
      ['updated', 'WEB-1'],
      ['commented', 'WEB-1'],
      ['created', 'WEB-1'],
    ]);
    expect(page.body.entries[0]).toMatchObject({
      actor: { displayName: 'Lena Vogt' },
      project: { key: 'WEB', name: 'Web-Relaunch' },
      items: [{ field: 'status', from: 'Offen', to: 'In Arbeit' }],
    });
    expect(page.body.entries[1]).toMatchObject({ excerpt: 'Ich schaue es mir an' });
    expect(page.body.next).toBeNull();

    const all = await admin.request<ActivityPage>('GET', '/activity');
    expect(all.body.entries.map((entry) => entry.issue.key)).toContain('SEC-1');
  });

  it('filters by project and person and pages by time', async () => {
    const web = await admin.request<ActivityPage>('GET', '/activity?project=web');
    expect(web.body.entries.every((entry) => entry.project.key === 'WEB')).toBe(true);
    const person = await admin.request<ActivityPage>('GET', `/activity?user=${jonasId}`);
    expect(person.body.entries.map((entry) => entry.kind)).toEqual(['commented']);

    const first = await admin.request<ActivityPage>('GET', '/activity?project=WEB&limit=2');
    expect(first.body.entries).toHaveLength(2);
    expect(first.body.next).not.toBeNull();
    const second = await admin.request<ActivityPage>(
      'GET',
      `/activity?project=WEB&limit=2&before=${encodeURIComponent(first.body.next ?? '')}`,
    );
    expect(second.body.entries.map((entry) => entry.kind)).toEqual(['created']);
    expect(second.body.next).toBeNull();

    expect((await jonas.request('GET', '/activity?project=SEC')).status).toBe(404);
  });
});

describe('favourites', () => {
  it('stars projects the caller can see', async () => {
    expect((await jonas.request('PUT', '/me/favourites/project/web')).status).toBe(204);
    const list = await jonas.request<Favourite[]>('GET', '/me/favourites');
    expect(list.body).toMatchObject([{ kind: 'project', ref: 'WEB', name: 'Web-Relaunch' }]);
    const projects = await jonas.request<ProjectSummary[]>('GET', '/projects');
    expect(projects.body.find((project) => project.key === 'WEB')?.favourite).toBe(true);
    expect((await jonas.request('PUT', '/me/favourites/project/SEC')).status).toBe(404);
    expect((await jonas.request('PUT', '/me/favourites/board/x')).status).toBe(400);
  });

  it('keeps saved-filter favourites in the same place', async () => {
    const filter = await jonas.request<SavedFilter>('POST', '/filters', {
      name: 'Meine Arbeit',
      query: 'assignee = currentUser()',
    });
    // New filters start as favourites.
    const list = await jonas.request<Favourite[]>('GET', '/me/favourites');
    expect(list.body.map((entry) => [entry.kind, entry.name])).toEqual([
      ['project', 'Web-Relaunch'],
      ['filter', 'Meine Arbeit'],
    ]);
    await jonas.request('DELETE', `/filters/${filter.body.id}/favourite`);
    expect((await jonas.request<Favourite[]>('GET', '/me/favourites')).body).toHaveLength(1);
    await jonas.request('PUT', `/me/favourites/filter/${filter.body.id}`);
    const again = await jonas.request<SavedFilter>('GET', `/filters/${filter.body.id}`);
    expect(again.body.favourite).toBe(true);

    // Deleting the filter removes its favourite rows.
    await jonas.request('DELETE', `/filters/${filter.body.id}`);
    const [left] = await test.database.db
      .select({ total: count() })
      .from(favourites)
      .where(eq(favourites.targetId, filter.body.id));
    expect(left?.total).toBe(0);
  });
});

describe('recently viewed', () => {
  it('lists what the web app reported, newest first and only what is still visible', async () => {
    expect(
      (await jonas.request('POST', '/me/recent', { kind: 'issue', ref: 'web-1' })).status,
    ).toBe(204);
    await jonas.request('POST', '/me/recent', { kind: 'project', ref: 'WEB' });
    await jonas.request('POST', '/me/recent', { kind: 'issue', ref: 'WEB-1' });
    const recent = await jonas.request<RecentItem[]>('GET', '/me/recent');
    expect(recent.body.map((item) => [item.kind, item.ref])).toEqual([
      ['issue', 'WEB-1'],
      ['project', 'WEB'],
    ]);
    expect(recent.body[0]?.issue).toMatchObject({ key: 'WEB-1', status: { key: 'in-progress' } });
    expect(
      (await jonas.request('POST', '/me/recent', { kind: 'issue', ref: 'SEC-1' })).status,
    ).toBe(404);
  });

  it('keeps the newest 50 per person', async () => {
    await test.database.db.insert(recentItems).values(
      Array.from({ length: 60 }, (_, index) => ({
        userId: jonasId,
        kind: 'issue' as const,
        targetId: uuidv7(),
        viewedAt: new Date(Date.now() - (index + 10) * 60_000),
      })),
    );
    await jonas.request('POST', '/me/recent', { kind: 'issue', ref: 'WEB-1' });
    const [stored] = await test.database.db
      .select({ total: count() })
      .from(recentItems)
      .where(eq(recentItems.userId, jonasId));
    expect(stored?.total).toBe(50);
    // Entries of issues that no longer exist are simply not shown.
    expect(
      (await jonas.request<RecentItem[]>('GET', '/me/recent?limit=50')).body.map(
        (item) => item.ref,
      ),
    ).toEqual(['WEB-1', 'WEB']);
  });
});

describe('mentions for the home page', () => {
  it('lists notifications of one category', async () => {
    await admin.request('POST', '/issues/WEB-1/comments', {
      body: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Bitte prüfen ' },
              { type: 'mention', attrs: { id: jonasId, label: 'Jonas Schulz' } },
            ],
          },
        ],
      },
    });
    await test.app.get(EventProcessor).drain();
    const mentions = await jonas.request<NotificationList>(
      'GET',
      '/me/notifications?category=mention',
    );
    expect(mentions.body.notifications.map((entry) => entry.category)).toEqual(['mention']);
    const all = await jonas.request<NotificationList>('GET', '/me/notifications');
    expect(all.body.notifications.length).toBeGreaterThan(1);
  });
});
