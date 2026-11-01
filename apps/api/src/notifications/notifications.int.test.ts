import type {
  Issue,
  NotificationList,
  NotificationSettings,
  RichText,
  UnreadCount,
} from '@toolvibes/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { users } from '../db/schema/index.js';
import { EventProcessor } from '../events/event-processor.js';
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
  await test.app.get(EventProcessor).drain();
}

async function inbox(client: TestClient): Promise<NotificationList> {
  return (await client.request<NotificationList>('GET', '/me/notifications')).body;
}

beforeAll(async () => {
  test = await startTestApp({
    SMTP_URL: 'smtp://127.0.0.1:1',
    NOTIFICATION_EMAIL_DELAY_SECONDS: '0',
    PUBLIC_URL: 'https://lenipo.example.org',
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
    expect(toJonas[0]?.html).toContain('https://lenipo.example.org/issues/WEB-1');
    // Nothing is sent twice.
    expect(await service.sendDueEmails()).toBe(0);
  });

  it('respects personal settings, while the bell keeps everything', async () => {
    const defaults = await mira.request<NotificationSettings>('GET', '/me/notification-settings');
    expect(defaults.body).toEqual({
      emailEnabled: true,
      emailCategories: ['mention', 'assigned', 'comment', 'status', 'other'],
      emailMode: 'immediate',
      digestHour: 8,
      notifyOwnChanges: false,
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
    expect(toMira?.text).toContain('Open issue: https://lenipo.example.org/issues/WEB-1');
  });
});

describe('page comment notifications (E-63)', () => {
  let pageId: string;

  it('tells mentioned people, thread participants and the page creator', async () => {
    await admin.request('POST', '/spaces', { key: 'DOCS', name: 'Doku' });
    const page = await admin.request<{ id: string }>('POST', '/spaces/DOCS/pages', {
      title: 'Regeln',
    });
    pageId = page.body.id;
    await admin.request('POST', `/pages/${pageId}/publish`, {
      title: 'Regeln',
      content: docFromText('Der Sprint dauert zwei Wochen.'),
    });
    const before = {
      lena: (await inbox(admin)).unreadCount,
      mira: (await inbox(mira)).unreadCount,
    };

    // Gast cannot see the space, so that mention reaches nobody.
    const doc: RichText = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Passt das? ' },
            { type: 'mention', attrs: { id: ids.mira, label: 'Mira Kaya' } },
            { type: 'text', text: ' ' },
            { type: 'mention', attrs: { id: ids.gast, label: 'Gast' } },
          ],
        },
      ],
    };
    const thread = await jonas.request<{ id: string }>('POST', `/pages/${pageId}/comments`, {
      body: doc,
      anchor: { exact: 'zwei Wochen', prefix: 'Der Sprint dauert ', suffix: '.', block: 0 },
    });
    expect(thread.status).toBe(201);
    await work();

    const toMira = (await inbox(mira)).notifications[0];
    expect(toMira).toMatchObject({
      issue: null,
      page: { id: pageId, title: 'Regeln', spaceKey: 'DOCS' },
      category: 'mention',
      details: { kind: 'commented', quote: 'zwei Wochen' },
    });
    expect((await inbox(admin)).notifications[0]).toMatchObject({
      page: { title: 'Regeln' },
      category: 'comment',
    });
    expect((await inbox(mira)).unreadCount).toBe(before.mira + 1);
    expect((await inbox(admin)).unreadCount).toBe(before.lena + 1);
    const [gastRows] = await test.database.sql`
      select count(*)::int as count from notifications where user_id = ${ids.gast}`;
    expect(gastRows?.count).toBe(0);

    // A reply reaches the thread's author and the page's creator, not the one who replies.
    const jonasBefore = (await inbox(jonas)).unreadCount;
    await mira.request('POST', `/pages/${pageId}/comments`, {
      body: docFromText('Ja, passt.'),
      parentId: thread.body.id,
    });
    await work();
    expect((await inbox(jonas)).unreadCount).toBe(jonasBefore + 1);
    expect((await inbox(jonas)).notifications[0]).toMatchObject({
      category: 'comment',
      details: { excerpt: 'Ja, passt.', quote: 'zwei Wochen' },
    });
    expect((await inbox(mira)).unreadCount).toBe(before.mira + 1);
  });

  it('bundles one email per person and page', async () => {
    const before = sent.length;
    await test.app.get(NotificationService).sendDueEmails();
    const toLena = sent.slice(before).filter((mail) => mail.to === 'lena@example.org');
    expect(toLena).toHaveLength(1);
    expect(toLena[0]?.subject).toBe('[DOCS] Regeln');
    expect(toLena[0]?.text).toContain('Jonas Schulz hat auf der Seite kommentiert:');
    expect(toLena[0]?.text).toContain('zu „zwei Wochen“');
    expect(toLena[0]?.text).toContain(
      `Seite öffnen: https://lenipo.example.org/spaces/DOCS/pages/${pageId}`,
    );
  });
});

describe('watching wiki pages (E-65)', () => {
  it('tells watchers about published versions and new pages below a watched page', async () => {
    const [page] = await test.database.sql<{ id: string }[]>`
      select id from pages where title = 'Regeln'`;
    const pageId = page?.id as string;
    await jonas.request('PUT', '/spaces/DOCS/watch');
    const before = {
      jonas: (await inbox(jonas)).unreadCount,
      mira: (await inbox(mira)).unreadCount,
    };
    await admin.request('POST', `/pages/${pageId}/publish`, {
      title: 'Regeln',
      content: docFromText('Der Sprint dauert drei Wochen.'),
      comment: 'Länger geplant',
    });
    await work();
    // Jonas follows the space, Mira the page since she answered on it.
    expect((await inbox(jonas)).notifications[0]).toMatchObject({
      page: { id: pageId },
      category: 'other',
      details: { kind: 'published', version: 2, excerpt: 'Länger geplant' },
    });
    expect((await inbox(mira)).unreadCount).toBe(before.mira + 1);

    // Unwatching stops it; a subtree watch reaches new pages below.
    await mira.request('DELETE', `/pages/${pageId}/watch?scope=page`);
    await jonas.request('DELETE', '/spaces/DOCS/watch');
    await jonas.request('PUT', `/pages/${pageId}/watch`, { scope: 'subtree' });
    const child = await admin.request<{ id: string }>('POST', '/spaces/DOCS/pages', {
      title: 'Ausnahmen',
      parentId: pageId,
    });
    await admin.request('POST', `/pages/${child.body.id}/publish`, {
      title: 'Ausnahmen',
      content: docFromText('Feiertage verschieben den Sprint.'),
    });
    await work();
    expect((await inbox(mira)).unreadCount).toBe(before.mira + 1);
    expect((await inbox(jonas)).notifications[0]).toMatchObject({
      page: { id: child.body.id, title: 'Ausnahmen' },
      details: { kind: 'published', version: 1 },
    });
    expect((await inbox(jonas)).unreadCount).toBe(before.jonas + 2);
  });
});
