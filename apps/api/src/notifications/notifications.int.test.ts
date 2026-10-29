import type {
  Issue,
  NotificationList,
  NotificationSettings,
  RichText,
  UnreadCount,
} from '@tasklore/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { users } from '../db/schema/index.js';
import { SetupService } from '../identity/setup.service.js';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { docFromText } from '../tracking/rich-text.js';
import type { MailMessage } from './mailer.js';
import { Mailer } from './mailer.js';
import { NotificationService } from './notification.service.js';

let test: TestApp;
let admin: TestClient;
let jonas: TestClient;
let mira: TestClient;
let ids: Record<'jonas' | 'mira' | 'gast', string>;
const sent: MailMessage[] = [];

function mention(text: string, userId: string, label: string): RichText {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: `${text} ` },
          { type: 'mention', attrs: { id: userId, label } },
        ],
      },
    ],
  };
}

/** Lets the worker do its job now instead of on its timer. */
async function work(): Promise<void> {
  const notifications = test.app.get(NotificationService);
  while ((await notifications.processPendingEvents()) > 0);
}

async function inbox(client: TestClient): Promise<NotificationList> {
  return (await client.request<NotificationList>('GET', '/me/notifications')).body;
}

beforeAll(async () => {
  test = await startTestApp({
    SMTP_URL: 'smtp://127.0.0.1:1',
    NOTIFICATION_EMAIL_DELAY_SECONDS: '0',
    PUBLIC_URL: 'https://tasklore.example.org',
  });
  // Record email instead of talking to a mail server.
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
  const create = async (email: string, displayName: string) =>
    (
      await admin.request<{ id: string }>('POST', '/admin/users', {
        email,
        displayName,
        password: 'ein-langes-passwort',
      })
    ).body.id;
  ids = {
    jonas: await create('jonas@example.org', 'Jonas Schulz'),
    mira: await create('mira@example.org', 'Mira Kaya'),
    gast: await create('gast@example.org', 'Gast'),
  };
  await admin.request('DELETE', `/admin/groups/users/members/${ids.gast}`);
  const signIn = async (email: string) => {
    const client = new TestClient(test.baseUrl);
    await client.request('POST', '/auth/login', { email, password: 'ein-langes-passwort' });
    return client;
  };
  jonas = await signIn('jonas@example.org');
  mira = await signIn('mira@example.org');
  await admin.request('POST', '/projects', { key: 'WEB', name: 'Web-Relaunch', template: 'scrum' });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('notifications', () => {
  it('tells the assignee about a new issue, but never the actor', async () => {
    const created = await admin.request<Issue>('POST', '/issues', {
      projectKey: 'WEB',
      issueType: 'task',
      summary: 'Login schlägt fehl',
      assigneeId: ids.jonas,
    });
    expect(created.status).toBe(201);
    await work();
    const list = await inbox(jonas);
    expect(list.unreadCount).toBe(1);
    expect(list.notifications[0]).toMatchObject({
      issue: { key: 'WEB-1', summary: 'Login schlägt fehl' },
      actor: { displayName: 'Lena Vogt' },
      category: 'assigned',
      details: { kind: 'created' },
      read: false,
    });
    expect((await inbox(admin)).notifications).toEqual([]);
  });

  it('tells watchers about comments and mentioned people about mentions', async () => {
    await jonas.request('POST', '/issues/WEB-1/comments', {
      body: mention('Kannst du helfen,', ids.mira, 'Mira Kaya'),
    });
    await work();
    expect((await inbox(admin)).notifications[0]).toMatchObject({
      category: 'comment',
      details: { kind: 'commented', excerpt: 'Kannst du helfen, @Mira Kaya' },
    });
    expect((await inbox(mira)).notifications[0]).toMatchObject({
      category: 'mention',
      actor: { displayName: 'Jonas Schulz' },
    });
    // The commenter is not told about their own comment.
    expect((await inbox(jonas)).notifications).toHaveLength(1);
  });

  it('never notifies people who cannot see the issue', async () => {
    await jonas.request('POST', '/issues/WEB-1/comments', {
      body: mention('Auch an', ids.gast, 'Gast'),
    });
    await work();
    const gast = new TestClient(test.baseUrl);
    await gast.request('POST', '/auth/login', {
      email: 'gast@example.org',
      password: 'ein-langes-passwort',
    });
    expect((await inbox(gast)).notifications).toEqual([]);
  });

  it('categorises status changes and assignments for watchers', async () => {
    await admin.request('POST', '/issues/WEB-1/transitions', { transitionId: 'to-in-progress' });
    await work();
    expect((await inbox(jonas)).notifications[0]).toMatchObject({
      category: 'status',
      details: { kind: 'updated', items: [{ field: 'status', from: 'Offen', to: 'In Arbeit' }] },
    });
  });

  it('tells only newly mentioned people about edits', async () => {
    const before = (await inbox(admin)).notifications.length;
    const comment = await admin.request<{ id: string }>('POST', '/issues/WEB-1/comments', {
      body: docFromText('Zwischenstand'),
    });
    await work();
    const jonasBefore = (await inbox(jonas)).notifications.length;
    await admin.request('PATCH', `/issues/WEB-1/comments/${comment.body.id}`, {
      body: mention('Zwischenstand für', ids.jonas, 'Jonas Schulz'),
    });
    await work();
    const after = await inbox(jonas);
    expect(after.notifications).toHaveLength(jonasBefore + 1);
    expect(after.notifications[0]).toMatchObject({ category: 'mention' });
    expect((await inbox(admin)).notifications).toHaveLength(before);

    // A mention added to the description counts as well.
    await admin.request<Issue>('PATCH', '/issues/WEB-1', {
      description: mention('Rückfrage an', ids.mira, 'Mira Kaya'),
    });
    await work();
    expect((await inbox(mira)).notifications[0]).toMatchObject({
      category: 'mention',
      details: { kind: 'updated' },
    });
  });

  it('marks notifications as read', async () => {
    const list = await inbox(jonas);
    const first = list.notifications[0]?.id;
    expect((await jonas.request('POST', '/me/notifications/read', { ids: [first] })).status).toBe(
      204,
    );
    const count = await jonas.request<UnreadCount>('GET', '/me/notifications/unread-count');
    expect(count.body.count).toBe(list.unreadCount - 1);
    const unread = await jonas.request<NotificationList>('GET', '/me/notifications?unread=true');
    expect(unread.body.notifications.map((entry) => entry.id)).not.toContain(first);

    await jonas.request('POST', '/me/notifications/read', { all: true });
    expect(
      (await jonas.request<UnreadCount>('GET', '/me/notifications/unread-count')).body.count,
    ).toBe(0);
    // Others' notifications stay untouched.
    expect((await inbox(mira)).unreadCount).toBeGreaterThan(0);
  });
});

describe('notification email', () => {
  it('sends one bundled email per person and issue', async () => {
    const service = test.app.get(NotificationService);
    expect(await service.sendDueEmails()).toBeGreaterThan(0);
    const toJonas = sent.filter((mail) => mail.to === 'jonas@example.org');
    expect(toJonas).toHaveLength(1);
    expect(toJonas[0]?.subject).toBe('[WEB-1] Login schlägt fehl');
    expect(toJonas[0]?.text).toContain('Lena Vogt hat Ihnen den Vorgang zugewiesen.');
    expect(toJonas[0]?.text).toContain('- Status: Offen → In Arbeit');
    expect(toJonas[0]?.text).toContain('Lena Vogt hat Sie erwähnt:');
    expect(toJonas[0]?.html).toContain('https://tasklore.example.org/issues/WEB-1');
    // Nothing is sent twice.
    expect(await service.sendDueEmails()).toBe(0);
  });

  it('respects personal settings, while the bell keeps everything', async () => {
    const defaults = await mira.request<NotificationSettings>('GET', '/me/notification-settings');
    expect(defaults.body).toEqual({
      emailEnabled: true,
      emailCategories: ['mention', 'assigned', 'comment', 'status', 'other'],
      emailAvailable: true,
    });
    const changed = await mira.request<NotificationSettings>('PUT', '/me/notification-settings', {
      emailEnabled: true,
      emailCategories: ['assigned'],
    });
    expect(changed.body.emailCategories).toEqual(['assigned']);

    const before = sent.length;
    const unread = (await inbox(mira)).unreadCount;
    await jonas.request('POST', '/issues/WEB-1/comments', {
      body: mention('Noch einmal', ids.mira, 'Mira Kaya'),
    });
    await work();
    await test.app.get(NotificationService).sendDueEmails();
    expect((await inbox(mira)).unreadCount).toBe(unread + 1);
    expect(sent.slice(before).map((mail) => mail.to)).not.toContain('mira@example.org');
  });

  it('writes in the recipient’s language', async () => {
    await mira.request('PUT', '/me/notification-settings', {
      emailEnabled: true,
      emailCategories: ['mention', 'assigned', 'comment', 'status', 'other'],
    });
    // There is no profile page yet; the language is stored on the user.
    await test.database.db.update(users).set({ locale: 'en' }).where(eq(users.id, ids.mira));
    await jonas.request('POST', '/issues/WEB-1/comments', {
      body: mention('Please check', ids.mira, 'Mira Kaya'),
    });
    await work();
    await test.app.get(NotificationService).sendDueEmails();
    // Lena watches the issue and gets her own (German) email in the same round.
    const toMira = sent.filter((mail) => mail.to === 'mira@example.org').at(-1);
    expect(toMira?.text).toContain('Jonas Schulz mentioned you:');
    expect(toMira?.text).toContain('Open issue: https://tasklore.example.org/issues/WEB-1');
  });
});
