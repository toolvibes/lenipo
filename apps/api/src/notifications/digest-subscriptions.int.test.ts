import type { FilterSubscription, NotificationSettings, SavedFilter } from '@tasklore/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EventProcessor } from '../events/event-processor.js';
import { SetupService } from '../identity/setup.service.js';
import { FilterSubscriptionService } from '../search/filter-subscription.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import type { MailMessage } from './mailer.js';
import { Mailer } from './mailer.js';
import { NotificationService } from './notification.service.js';

let test: TestApp;
let admin: TestClient;
let mira: TestClient;
let miraId = '';
let filter: SavedFilter;
const sent: MailMessage[] = [];

// Monday, 2 November 2026, 08:00 in Berlin (07:00 UTC).
const MONDAY_EIGHT = new Date('2026-11-02T07:00:00Z');
const MONDAY_NINE = new Date('2026-11-02T08:00:00Z');
const TUESDAY_EIGHT = new Date('2026-11-03T07:00:00Z');

beforeAll(async () => {
  test = await startTestApp({
    SMTP_URL: 'smtp://127.0.0.1:1',
    NOTIFICATION_EMAIL_DELAY_SECONDS: '0',
    PUBLIC_URL: 'https://tasklore.example.org',
  });
  test.app.get(Mailer).transport = {
    sendMail: async (message) => {
      sent.push(message);
    },
  };
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
  mira = new TestClient(test.baseUrl);
  await mira.request('POST', '/auth/login', {
    email: 'mira@example.org',
    password: 'ein-langes-passwort',
  });
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web', template: 'scrum' });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('personal e-mail settings (P-NTF-04)', () => {
  it('collects e-mails into a digest at the chosen hour, including own changes on request', async () => {
    const settings = await admin.request<NotificationSettings>('PUT', '/me/notification-settings', {
      emailEnabled: true,
      emailCategories: ['mention', 'assigned', 'comment', 'status', 'other'],
      emailMode: 'daily',
      digestHour: 8,
      notifyOwnChanges: true,
    });
    expect(settings.body).toMatchObject({
      emailMode: 'daily',
      digestHour: 8,
      notifyOwnChanges: true,
    });

    await admin.request('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'story',
      summary: 'Login bauen',
    });
    await admin.request('PATCH', '/issues/WEB-1', { summary: 'Login mit Passkey bauen' });
    await test.app.get(EventProcessor).drain();
    const service = test.app.get(NotificationService);
    // Not one by one …
    await service.sendDueEmails();
    expect(sent.filter((mail) => mail.to === 'lena@example.org')).toHaveLength(0);
    // … nor at another hour, but once at eight.
    expect(await service.sendDigests(MONDAY_NINE)).toBe(0);
    expect(await service.sendDigests(MONDAY_EIGHT)).toBe(1);
    expect(await service.sendDigests(MONDAY_EIGHT)).toBe(0);
    const digest = sent.find((mail) => mail.to === 'lena@example.org');
    expect(digest?.subject).toBe('Tasklore: 2 Neuigkeiten');
    expect(digest?.text).toContain('WEB-1 Login mit Passkey bauen');
    expect(digest?.html).toContain('https://tasklore.example.org/issues/WEB-1');
  });

  it('leaves out own changes by default', async () => {
    await admin.request('PUT', '/me/notification-settings', {
      emailEnabled: true,
      emailCategories: ['mention', 'assigned', 'comment', 'status', 'other'],
    });
    const before = (await admin.request<{ count: number }>('GET', '/me/notifications/unread-count'))
      .body.count;
    await admin.request('PATCH', '/issues/WEB-1', { summary: 'Login mit Passkey' });
    await test.app.get(EventProcessor).drain();
    const after = (await admin.request<{ count: number }>('GET', '/me/notifications/unread-count'))
      .body.count;
    expect(after).toBe(before);
  });
});

describe('filter subscriptions (T-QRY-07)', () => {
  it('lets the owner subscribe a group of theirs, and others only themselves', async () => {
    filter = (
      await admin.request<SavedFilter>('POST', '/filters', {
        name: 'Offene Stories',
        query: 'project = WEB ORDER BY key',
        shares: [{ type: 'authenticated' }],
      })
    ).body;
    await admin.request('POST', '/admin/groups', { name: 'team', description: 'Team' });
    const groups = (
      await admin.request<Array<{ id: string; name: string }>>('GET', '/admin/groups')
    ).body;
    const team = groups.find((group) => group.name === 'team');
    const lena = (await admin.request<{ id: string }>('GET', '/me')).body;
    await admin.request('POST', '/admin/groups/team/members', { userId: lena.id });
    await admin.request('POST', '/admin/groups/team/members', { userId: miraId });

    const own = await mira.request<FilterSubscription>(
      'POST',
      `/filters/${filter.id}/subscriptions`,
      {
        schedule: 'weekly',
        weekday: 2,
        hour: 8,
      },
    );
    expect(own.status).toBe(201);
    expect(
      (
        await mira.request('POST', `/filters/${filter.id}/subscriptions`, {
          schedule: 'daily',
          groupId: team?.id,
        })
      ).status,
    ).toBe(403);
    const group = await admin.request<FilterSubscription>(
      'POST',
      `/filters/${filter.id}/subscriptions`,
      {
        schedule: 'weekdays',
        hour: 8,
        onlyWithResults: false,
        groupId: team?.id,
      },
    );
    expect(group.body.group?.name).toBe('team');
    // Mira sees her own and her group's subscription; the owner sees all.
    expect(
      (await mira.request<FilterSubscription[]>('GET', `/filters/${filter.id}/subscriptions`)).body,
    ).toHaveLength(2);
    expect(
      (await admin.request<FilterSubscription[]>('GET', `/filters/${filter.id}/subscriptions`))
        .body,
    ).toHaveLength(2);
  });

  it('mails the results at the hour of the schedule, once', async () => {
    const service = test.app.get(FilterSubscriptionService);
    const before = sent.length;
    // Monday: only the group subscription (weekdays); Mira's weekly one is on Tuesdays.
    expect(await service.sendDue(MONDAY_EIGHT)).toBe(2);
    expect(await service.sendDue(MONDAY_EIGHT)).toBe(0);
    const mails = sent.slice(before);
    expect(mails.map((mail) => mail.to).sort()).toEqual(['lena@example.org', 'mira@example.org']);
    const toLena = mails.find((mail) => mail.to === 'lena@example.org');
    expect(toLena?.subject).toBe('[Tasklore] Offene Stories: 1 Vorgang');
    expect(toLena?.html).toContain('WEB-1');
    expect(toLena?.text).toContain(`https://tasklore.example.org/issues?filter=${filter.id}`);
    // Tuesday: both.
    expect(await service.sendDue(TUESDAY_EIGHT)).toBe(3);
  });

  it('can be cancelled by the subscriber', async () => {
    const [own] = (
      await mira.request<FilterSubscription[]>('GET', `/filters/${filter.id}/subscriptions`)
    ).body.filter((entry) => entry.group === null);
    expect((await mira.request('DELETE', `/filter-subscriptions/${own?.id}`)).status).toBe(204);
    expect((await admin.request('DELETE', `/filter-subscriptions/${own?.id}`)).status).toBe(404);
  });
});
