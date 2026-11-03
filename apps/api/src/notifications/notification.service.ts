import { Inject, Injectable } from '@nestjs/common';
import {
  type EmailMode,
  NOTIFICATION_CATEGORIES,
  type Notification,
  type NotificationCategory,
  type NotificationDetails,
  type NotificationList,
  type NotificationListQuery,
  type NotificationSettings,
  type UpdateNotificationSettings,
  type UserRef,
} from '@toolvibes/shared';
import { and, asc, count, desc, eq, gt, inArray, isNull, lt, or, type SQL, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { AppConfig } from '../core/config.js';
import type { Logger } from '../core/logger.js';
import { CONFIG, DATABASE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle, Executor } from '../db/client.js';
import {
  DEFAULT_NOTIFICATION_SCHEME_ID,
  domainEvents,
  groupMembers,
  issues,
  issueWatchers,
  notificationSchemeRules,
  notificationSettings,
  notifications,
  pageComments,
  pages,
  projectRoleMembers,
  projects,
  spaces,
  sprints,
  users,
  webhookDeliveries,
  webhooks,
} from '../db/schema/index.js';
import { signal } from '../realtime/signals.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';
import { PageService } from '../wiki/page.service.js';
import { pageWatcherIds } from '../wiki/watches.js';
import { type DigestGroup, digestEmail, notificationEmail } from './email.js';
import type { ChangedItem, IssueEvent, PageEvent } from './events.js';
import { localTime } from './local-time.js';
import { Mailer } from './mailer.js';

type EventRow = typeof domainEvents.$inferSelect;

const STATUS_FIELDS = new Set(['status', 'resolution']);

type NotificationEventKind = (typeof notificationSchemeRules.$inferSelect)['event'];

/** The scheme's kinds of event in one issue event: a change can be several at once. */
function kindsOf(event: IssueEvent): NotificationEventKind[] {
  if (event.type === 'issue.created') return ['created'];
  if (event.type === 'issue.commented') return ['commented'];
  if (event.type !== 'issue.updated') return [];
  const kinds = new Set<NotificationEventKind>();
  for (const item of event.items) {
    if (item.field === 'assignee') kinds.add('assigned');
    else if (STATUS_FIELDS.has(item.field)) kinds.add('status');
    else kinds.add('updated');
  }
  return [...kinds];
}

function issueEvent(row: EventRow): IssueEvent {
  return { type: row.type, ...(row.payload as object) } as IssueEvent;
}

function shown(items: ChangedItem[]): NotificationDetails['items'] {
  return items.map((item) => ({ field: item.field, from: item.fromDisplay, to: item.toDisplay }));
}

/**
 * In-app and email notifications (P-NTF-01/-02, E-44): events from the outbox become one
 * notification per recipient; emails bundle a person's notifications per issue or page.
 */
@Injectable()
export class NotificationService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(Mailer) private readonly mailer: Mailer,
    @Inject(PageService) private readonly pages: PageService,
  ) {}

  // ---------------------------------------------------------------- events

  /**
   * Turns one outbox event into notifications (called by the EventProcessor in its transaction):
   * watchers plus mentioned people, minus the actor; only who may still see the issue.
   */
  async handle(tx: Executor, row: EventRow): Promise<void> {
    if (row.pageId) return this.handlePage(tx, row, row.pageId);
    // Git activity is for automation and the development panel only (E-116).
    if (!row.issueId || row.type.startsWith('git.')) return;
    const [issue] = await tx.select().from(issues).where(eq(issues.id, row.issueId));
    if (!issue || issue.deletedAt) return;
    const event = issueEvent(row);
    // Deleted comments and logged work are of interest to webhooks only.
    if (
      event.type === 'issue.comment_deleted' ||
      event.type === 'issue.worklog' ||
      event.type === 'issue.deleted'
    )
      return;
    // Issues moved by a workflow change would flood every watcher (E-70).
    if (event.type === 'issue.updated' && event.migration) return;
    await this.notifyCustomer(tx, issue, event, row.actorId);
    const mentions = new Set(event.mentions);

    let candidates: string[];
    if (event.type === 'issue.commented' && event.edited) candidates = [...mentions];
    else {
      const recipients = await this.schemeRecipients(tx, issue, kindsOf(event));
      candidates = [...new Set([...recipients, ...mentions])];
    }
    candidates = await this.withoutOwnChanges(tx, candidates, row.actorId);
    if (candidates.length === 0) return;

    const active = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, candidates), eq(users.status, 'active')));
    const recipients: string[] = [];
    for (const { id } of active) {
      // Nobody hears of what they may not see, issue security included (TL-13, E-94).
      if (
        (await this.projectAccess.permissions(id, issue.projectId)).has('browse') &&
        (!issue.securityLevelId || (await this.projectAccess.seesIssue(id, issue.id)))
      )
        recipients.push(id);
    }
    if (recipients.length === 0) return;

    const details: NotificationDetails =
      event.type === 'issue.created'
        ? { kind: 'created', items: [] }
        : event.type === 'issue.updated'
          ? { kind: 'updated', items: shown(event.items) }
          : { kind: 'commented', items: [], excerpt: event.excerpt };

    const category = (userId: string): NotificationCategory => {
      if (mentions.has(userId)) return 'mention';
      if (event.type === 'issue.commented') return 'comment';
      if (event.type === 'issue.created') return issue.assigneeId === userId ? 'assigned' : 'other';
      if (event.items.some((item) => item.field === 'assignee' && item.toValue === userId)) {
        return 'assigned';
      }
      if (event.items.some((item) => STATUS_FIELDS.has(item.field))) return 'status';
      return 'other';
    };

    await this.deliver(tx, row, { issueId: issue.id }, recipients, details, category);
  }

  /**
   * Service desk customers hear of public answers and status changes by e-mail, with a link to
   * the portal; internal notes never reach them (TL-47, E-137). People who work in the project
   * hear of everything through the normal notifications instead.
   */
  private async notifyCustomer(
    tx: Executor,
    issue: typeof issues.$inferSelect,
    event: IssueEvent,
    actorId: string | null,
  ): Promise<void> {
    if (!issue.requestTypeId || !issue.reporterId || issue.reporterId === actorId) return;
    const answered = event.type === 'issue.commented' && !event.edited && !event.internal;
    const moved =
      event.type === 'issue.updated' && event.items.some((item) => STATUS_FIELDS.has(item.field));
    if (!answered && !moved) return;
    if ((await this.projectAccess.permissions(issue.reporterId, issue.projectId)).has('browse')) {
      return;
    }
    const [customer] = await tx
      .select({ email: users.email, locale: users.locale, status: users.status })
      .from(users)
      .where(eq(users.id, issue.reporterId));
    if (customer?.status !== 'active') return;
    const link = `${(this.config.PUBLIC_URL ?? '').replace(/\/+$/, '')}/portal/requests/${issue.key}`;
    const german = customer.locale !== 'en';
    const subject = answered
      ? german
        ? `[${issue.key}] Neue Antwort auf Ihre Anfrage`
        : `[${issue.key}] New answer to your request`
      : german
        ? `[${issue.key}] Ihre Anfrage hat einen neuen Status`
        : `[${issue.key}] Your request has a new status`;
    const line = german
      ? `„${issue.summary}“: Details und Antworten im Portal: ${link}`
      : `"${issue.summary}": details and answers in the portal: ${link}`;
    const escapeHtml = (value: string) =>
      value.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);
    await this.mailer.send({
      to: customer.email,
      subject,
      text: `${line}\n`,
      html: `<p>${escapeHtml(german ? `„${issue.summary}“` : `"${issue.summary}"`)}</p><p><a href="${escapeHtml(link)}">${german ? 'Anfrage im Portal öffnen' : 'Open the request in the portal'}</a></p>`,
    });
  }

  /**
   * Who the project's notification scheme names for these kinds of event (P-NTF-03, E-83):
   * watchers, assignee, reporter, holders of a project role, members of a group, or a person.
   */
  private async schemeRecipients(
    tx: Executor,
    issue: typeof issues.$inferSelect,
    kinds: NotificationEventKind[],
  ): Promise<string[]> {
    if (kinds.length === 0) return [];
    const [project] = await tx
      .select({ schemeId: projects.notificationSchemeId })
      .from(projects)
      .where(eq(projects.id, issue.projectId));
    const rules = await tx
      .select()
      .from(notificationSchemeRules)
      .where(
        and(
          eq(notificationSchemeRules.schemeId, project?.schemeId ?? DEFAULT_NOTIFICATION_SCHEME_ID),
          inArray(notificationSchemeRules.event, kinds),
        ),
      );
    const found = new Set<string>();
    const add = (ids: Array<string | null>) => {
      for (const id of ids) if (id) found.add(id);
    };
    const groupIds = rules.flatMap((rule) => (rule.groupId ? [rule.groupId] : []));
    const roles = rules.flatMap((rule) => (rule.role ? [rule.role] : []));
    for (const rule of rules) {
      if (rule.recipient === 'assignee') add([issue.assigneeId]);
      if (rule.recipient === 'reporter') add([issue.reporterId]);
      if (rule.recipient === 'user') add([rule.userId]);
    }
    if (rules.some((rule) => rule.recipient === 'watchers')) {
      const watchers = await tx
        .select({ userId: issueWatchers.userId })
        .from(issueWatchers)
        .where(eq(issueWatchers.issueId, issue.id));
      add(watchers.map((watcher) => watcher.userId));
    }
    if (groupIds.length > 0) {
      const members = await tx
        .select({ userId: groupMembers.userId })
        .from(groupMembers)
        .where(inArray(groupMembers.groupId, groupIds));
      add(members.map((member) => member.userId));
    }
    if (roles.length > 0) {
      const holders = await tx
        .select({ userId: projectRoleMembers.userId, groupId: projectRoleMembers.groupId })
        .from(projectRoleMembers)
        .where(
          and(
            eq(projectRoleMembers.projectId, issue.projectId),
            inArray(projectRoleMembers.role, roles),
          ),
        );
      add(holders.map((holder) => holder.userId));
      const viaGroups = holders.flatMap((holder) => (holder.groupId ? [holder.groupId] : []));
      if (viaGroups.length > 0) {
        const members = await tx
          .select({ userId: groupMembers.userId })
          .from(groupMembers)
          .where(inArray(groupMembers.groupId, viaGroups));
        add(members.map((member) => member.userId));
      }
    }
    return [...found];
  }

  /**
   * Wiki pages (E-63, E-65): watchers of the page, its subtree or space hear about published
   * versions and comments; comments also reach mentioned people and the thread's participants.
   * Never the actor, only who may still see the page; edits tell new mentions only.
   */
  private async handlePage(tx: Executor, row: EventRow, pageId: string): Promise<void> {
    const [page] = await tx
      .select({ id: pages.id, deletedAt: pages.deletedAt })
      .from(pages)
      .where(eq(pages.id, pageId));
    if (!page || page.deletedAt) return;
    const event = { type: row.type, ...(row.payload as object) } as PageEvent;
    const mentions = new Set(event.type === 'page.commented' ? event.mentions : []);
    let candidates: string[] = [...mentions];
    if (event.type === 'page.published' || !event.edited) {
      candidates.push(...(await pageWatcherIds(tx, page.id)));
    }
    if (event.type === 'page.commented' && !event.edited) {
      const thread = await tx
        .select({ authorId: pageComments.authorId })
        .from(pageComments)
        .where(
          and(
            or(eq(pageComments.id, event.threadId), eq(pageComments.parentId, event.threadId)),
            isNull(pageComments.deletedAt),
          ),
        );
      candidates.push(...thread.flatMap((entry) => (entry.authorId ? [entry.authorId] : [])));
    }
    candidates = await this.withoutOwnChanges(tx, [...new Set(candidates)], row.actorId);
    if (candidates.length === 0) return;
    const active = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, candidates), eq(users.status, 'active')));
    const recipients: string[] = [];
    for (const { id } of active) {
      if ((await this.pages.visible(id, [page.id])).has(page.id)) recipients.push(id);
    }
    if (recipients.length === 0) return;
    const details: NotificationDetails =
      event.type === 'page.published'
        ? {
            kind: 'published',
            items: [],
            version: event.version,
            ...(event.comment ? { excerpt: event.comment } : {}),
          }
        : {
            kind: 'commented',
            items: [],
            excerpt: event.excerpt,
            ...(event.quote ? { quote: event.quote } : {}),
          };
    await this.deliver(tx, row, { pageId: page.id }, recipients, details, (userId) =>
      mentions.has(userId) ? 'mention' : event.type === 'page.commented' ? 'comment' : 'other',
    );
  }

  /** One notification per recipient, queued for email as each person chose; bells update. */
  /** The actor hears about their own change only if they asked for it (P-NTF-04, E-112). */
  private async withoutOwnChanges(
    tx: Executor,
    candidates: string[],
    actorId: string | null,
  ): Promise<string[]> {
    if (!actorId || !candidates.includes(actorId)) return candidates;
    const [choice] = await tx
      .select({ own: notificationSettings.notifyOwnChanges })
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, actorId));
    return choice?.own ? candidates : candidates.filter((id) => id !== actorId);
  }

  private async deliver(
    tx: Executor,
    row: EventRow,
    subject: { issueId: string } | { pageId: string },
    recipients: string[],
    details: NotificationDetails,
    category: (userId: string) => NotificationCategory,
  ): Promise<void> {
    const settings = await tx
      .select()
      .from(notificationSettings)
      .where(inArray(notificationSettings.userId, recipients));
    const settingsOf = new Map(settings.map((entry) => [entry.userId, entry]));
    const inserted = await tx
      .insert(notifications)
      .values(
        recipients.map((userId) => {
          const kind = category(userId);
          const choice = settingsOf.get(userId);
          const wantsEmail =
            (choice?.emailEnabled ?? true) &&
            (choice?.emailCategories ?? NOTIFICATION_CATEGORIES).includes(kind);
          return {
            userId,
            ...subject,
            eventId: row.id,
            category: kind,
            actorId: row.actorId,
            details,
            emailPending: this.mailer.enabled && wantsEmail,
          };
        }),
      )
      .returning({ id: notifications.id });
    await this.toAgentWebhooks(
      tx,
      inserted.map((entry) => entry.id),
      recipients,
    );
    // The bells of the recipients update at once (P-NTF-01, E-58).
    for (const userId of recipients) await signal(tx, { type: 'notification', userId });
  }

  // ---------------------------------------------------------------- email

  /** Sends one email per person and issue or page once no change came for the quiet period. */
  async sendDueEmails(limit = 50): Promise<number> {
    if (!this.mailer.enabled) return 0;
    const delay = this.config.NOTIFICATION_EMAIL_DELAY_SECONDS;
    const groups = await this.database.db
      .select({
        userId: notifications.userId,
        issueId: notifications.issueId,
        pageId: notifications.pageId,
      })
      .from(notifications)
      .leftJoin(notificationSettings, eq(notificationSettings.userId, notifications.userId))
      // People with a digest get their e-mails collected (E-112).
      .where(
        and(
          eq(notifications.emailPending, true),
          sql`coalesce(${notificationSettings.emailMode}, 'immediate') = 'immediate'`,
        ),
      )
      .groupBy(notifications.userId, notifications.issueId, notifications.pageId)
      .having(sql`max(${notifications.createdAt}) <= now() - make_interval(secs => ${delay})`)
      .limit(limit);
    let sent = 0;
    for (const group of groups) {
      try {
        if (await this.sendGroup(group)) sent += 1;
      } catch (error) {
        // Stays pending; the next round tries again.
        this.logger.error({ err: error, ...group }, 'Sending a notification email failed');
      }
    }
    return sent;
  }

  private async sendGroup(group: {
    userId: string;
    issueId: string | null;
    pageId: string | null;
  }): Promise<boolean> {
    const same = (
      column: typeof notifications.issueId | typeof notifications.pageId,
      value: string | null,
    ): SQL => (value ? eq(column, value) : isNull(column));
    return this.database.db.transaction(async (tx) => {
      const pending = await tx
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, group.userId),
            same(notifications.issueId, group.issueId),
            same(notifications.pageId, group.pageId),
            eq(notifications.emailPending, true),
          ),
        )
        .orderBy(asc(notifications.id))
        .for('update', { skipLocked: true });
      if (pending.length === 0) return false;
      const [recipient] = await tx.select().from(users).where(eq(users.id, group.userId));
      const [issue] = group.issueId
        ? await tx
            .select({ key: issues.key, summary: issues.summary })
            .from(issues)
            .where(eq(issues.id, group.issueId))
        : [];
      const [page] = group.pageId
        ? await tx
            .select({ id: pages.id, title: pages.title, spaceKey: spaces.key })
            .from(pages)
            .innerJoin(spaces, eq(spaces.id, pages.spaceId))
            .where(eq(pages.id, group.pageId))
        : [];
      const subject = issue ? { issue } : page ? { page } : null;
      if (recipient?.status === 'active' && subject) {
        const actors = await this.refs(
          tx,
          pending.map((entry) => entry.actorId),
        );
        await this.mailer.send(
          notificationEmail({
            to: recipient.email,
            locale: recipient.locale,
            ...subject,
            publicUrl: this.config.PUBLIC_URL,
            entries: pending.map((entry) => ({
              actor: entry.actorId ? (actors.get(entry.actorId)?.displayName ?? null) : null,
              category: entry.category,
              details: entry.details as NotificationDetails,
            })),
          }),
        );
      }
      await tx
        .update(notifications)
        .set({ emailPending: false, emailedAt: sql`now()` })
        .where(
          inArray(
            notifications.id,
            pending.map((entry) => entry.id),
          ),
        );
      return true;
    });
  }

  /**
   * One e-mail with everything collected for people with a daily or weekly digest (E-112), at
   * their hour in their time zone; weekly digests on Mondays. Runs every few minutes.
   */
  async sendDigests(now = new Date()): Promise<number> {
    if (!this.mailer.enabled) return 0;
    const db = this.database.db;
    const candidates = await db
      .select({
        userId: users.id,
        email: users.email,
        locale: users.locale,
        timeZone: users.timeZone,
        status: users.status,
        mode: notificationSettings.emailMode,
        hour: notificationSettings.digestHour,
        last: notificationSettings.lastDigestAt,
      })
      .from(notificationSettings)
      .innerJoin(users, eq(users.id, notificationSettings.userId))
      .where(
        and(
          sql`${notificationSettings.emailMode} <> 'immediate'`,
          sql`exists (select 1 from ${notifications} where ${notifications.userId} = ${users.id} and ${notifications.emailPending})`,
        ),
      );
    let sent = 0;
    for (const person of candidates) {
      const local = localTime(now, person.timeZone);
      if (local.hour !== person.hour) continue;
      if (person.mode === 'weekly' && local.weekday !== 1) continue;
      // Once per day at most, however often the job runs in that hour.
      if (person.last && now.getTime() - person.last.getTime() < 20 * 3600_000) continue;
      try {
        await this.sendDigest(person, now);
        sent += 1;
      } catch (error) {
        this.logger.error({ err: error, userId: person.userId }, 'Sending a digest failed');
      }
    }
    return sent;
  }

  private async sendDigest(
    person: { userId: string; email: string; locale: string; status: string },
    now: Date,
  ): Promise<void> {
    await this.database.db.transaction(async (tx) => {
      const pending = await tx
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, person.userId), eq(notifications.emailPending, true)))
        .orderBy(asc(notifications.id))
        .for('update', { skipLocked: true });
      if (pending.length === 0) return;
      const issueIds = [
        ...new Set(pending.flatMap((entry) => (entry.issueId ? [entry.issueId] : []))),
      ];
      const pageIds = [
        ...new Set(pending.flatMap((entry) => (entry.pageId ? [entry.pageId] : []))),
      ];
      const issueRows = issueIds.length
        ? await tx
            .select({ id: issues.id, key: issues.key, summary: issues.summary })
            .from(issues)
            .where(inArray(issues.id, issueIds))
        : [];
      const pageRows = pageIds.length
        ? await tx
            .select({ id: pages.id, title: pages.title, spaceKey: spaces.key })
            .from(pages)
            .innerJoin(spaces, eq(spaces.id, pages.spaceId))
            .where(inArray(pages.id, pageIds))
        : [];
      const actors = await this.refs(
        tx,
        pending.map((entry) => entry.actorId),
      );
      const groups: DigestGroup[] = [];
      for (const entry of pending) {
        const issue = issueRows.find((candidate) => candidate.id === entry.issueId);
        const page = pageRows.find((candidate) => candidate.id === entry.pageId);
        const key = issue?.id ?? page?.id;
        if (!key) continue;
        let group = groups.find((candidate) => candidate.key === key);
        if (!group) {
          group = issue
            ? { key, issue: { key: issue.key, summary: issue.summary }, entries: [] }
            : { key, page: page as { id: string; title: string; spaceKey: string }, entries: [] };
          groups.push(group);
        }
        group.entries.push({
          actor: entry.actorId ? (actors.get(entry.actorId)?.displayName ?? null) : null,
          category: entry.category,
          details: entry.details as NotificationDetails,
        });
      }
      if (person.status === 'active' && groups.length > 0) {
        await this.mailer.send(
          digestEmail({
            to: person.email,
            locale: person.locale,
            publicUrl: this.config.PUBLIC_URL,
            groups,
          }),
        );
      }
      await tx
        .update(notifications)
        .set({ emailPending: false, emailedAt: sql`now()` })
        .where(
          inArray(
            notifications.id,
            pending.map((entry) => entry.id),
          ),
        );
      await tx
        .update(notificationSettings)
        .set({ lastDigestAt: now })
        .where(eq(notificationSettings.userId, person.userId));
    });
  }

  // ---------------------------------------------------------------- reading

  private async refs(db: Executor, ids: Array<string | null>): Promise<Map<string, UserRef>> {
    const unique = [...new Set(ids.filter((id): id is string => id !== null))];
    if (unique.length === 0) return new Map();
    const rows = await db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(inArray(users.id, unique));
    return new Map(rows.map((row) => [row.id, row]));
  }

  async unreadCount(userId: string): Promise<number> {
    const [row] = await this.database.db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return row?.count ?? 0;
  }

  async list(userId: string, query: NotificationListQuery): Promise<NotificationList> {
    const list = await this.present(
      this.database.db,
      and(
        eq(notifications.userId, userId),
        query.unread ? isNull(notifications.readAt) : undefined,
        query.category ? eq(notifications.category, query.category) : undefined,
        query.before ? lt(notifications.id, query.before) : undefined,
        query.after !== undefined ? gt(notifications.id, query.after) : undefined,
      ),
      query.limit,
    );
    return { notifications: list, unreadCount: await this.unreadCount(userId) };
  }

  /** Notifications as the API shows them, newest first. */
  private async present(db: Executor, where: SQL | undefined, limit: number) {
    const rows = await db
      .select({
        notification: notifications,
        key: issues.key,
        summary: issues.summary,
        pageTitle: pages.title,
        spaceKey: spaces.key,
        sprintName: sprints.name,
        boardId: sprints.boardId,
      })
      .from(notifications)
      .leftJoin(issues, eq(issues.id, notifications.issueId))
      .leftJoin(pages, eq(pages.id, notifications.pageId))
      .leftJoin(spaces, eq(spaces.id, pages.spaceId))
      .leftJoin(sprints, eq(sprints.id, notifications.sprintId))
      .where(where)
      .orderBy(desc(notifications.id))
      .limit(limit);
    const actors = await this.refs(
      db,
      rows.map((row) => row.notification.actorId),
    );
    return rows.map(
      ({
        notification,
        key,
        summary,
        pageTitle,
        spaceKey,
        sprintName,
        boardId,
      }): Notification & { userId: string } => ({
        id: notification.id,
        userId: notification.userId,
        issue: key && summary !== null ? { key, summary } : null,
        page:
          notification.pageId && pageTitle !== null && spaceKey
            ? { id: notification.pageId, title: pageTitle, spaceKey }
            : null,
        sprint:
          notification.sprintId && sprintName !== null && boardId
            ? { id: notification.sprintId, name: sprintName, boardId }
            : null,
        actor: notification.actorId ? (actors.get(notification.actorId) ?? null) : null,
        category: notification.category,
        details: notification.details as NotificationDetails,
        createdAt: notification.createdAt.toISOString(),
        read: notification.readAt !== null,
      }),
    );
  }

  /**
   * Agents with their own webhook get their new notifications there, signed and retried like
   * every webhook delivery (TL-95, E-147).
   */
  private async toAgentWebhooks(tx: Executor, ids: number[], userIds: string[]): Promise<void> {
    const hooks = await tx
      .select({ id: webhooks.id, userId: webhooks.userId })
      .from(webhooks)
      .where(and(inArray(webhooks.userId, userIds), eq(webhooks.enabled, true)));
    if (hooks.length === 0) return;
    const shown = await this.present(tx, inArray(notifications.id, ids), ids.length);
    const deliveries = hooks.flatMap((hook) =>
      shown
        .filter((notification) => notification.userId === hook.userId)
        .map(({ userId: _user, ...notification }) => ({
          id: uuidv7(),
          webhookId: hook.id,
          type: 'notification.created',
          payload: {
            type: 'notification.created',
            timestamp: notification.createdAt,
            data: { notification },
          },
        })),
    );
    if (deliveries.length > 0) await tx.insert(webhookDeliveries).values(deliveries);
  }

  /**
   * Approval requests of agents and their outcome (TL-96, E-148): about a sprint, in the bell,
   * the event stream and agent webhooks, never by e-mail.
   */
  async notifySprint(
    tx: Executor,
    recipients: string[],
    sprintId: string,
    actorId: string | null,
    excerpt: string,
    /** What happened: `start` or `complete` as field, `requested`/`approved`/`rejected` as value. */
    item: NotificationDetails['items'][number],
  ): Promise<void> {
    await this.notifyDirect(tx, recipients, { sprintId }, actorId, {
      kind: 'approval',
      items: [item],
      ...(excerpt ? { excerpt } : {}),
    });
  }

  /**
   * Review requests and verdicts (TL-97, E-149): about the issue, with `review` as field and
   * `requested`, `approved` or `changes_requested` as value; never by e-mail.
   */
  async notifyReview(
    tx: Executor,
    recipients: string[],
    issueId: string,
    actorId: string,
    outcome: string,
    excerpt: string,
  ): Promise<void> {
    await this.notifyDirect(tx, recipients, { issueId }, actorId, {
      kind: 'review',
      items: [{ field: 'review', from: null, to: outcome }],
      ...(excerpt ? { excerpt: excerpt.slice(0, 500) } : {}),
    });
  }

  /** Notifications outside the event stream: bell, event stream and agent webhooks. */
  private async notifyDirect(
    tx: Executor,
    recipients: string[],
    subject: { sprintId: string } | { issueId: string },
    actorId: string | null,
    details: NotificationDetails,
  ): Promise<void> {
    if (recipients.length === 0) return;
    const inserted = await tx
      .insert(notifications)
      .values(
        recipients.map((userId) => ({
          userId,
          ...subject,
          category: 'other' as const,
          actorId,
          details,
          emailPending: false,
        })),
      )
      .returning({ id: notifications.id });
    await this.toAgentWebhooks(
      tx,
      inserted.map((entry) => entry.id),
      recipients,
    );
    for (const userId of recipients) await signal(tx, { type: 'notification', userId });
  }

  /** The newest notification id of the user, 0 without any. */
  async latestId(userId: string): Promise<number> {
    const [row] = await this.database.db
      .select({ id: sql<number | null>`max(${notifications.id})` })
      .from(notifications)
      .where(eq(notifications.userId, userId));
    return Number(row?.id ?? 0);
  }

  async markRead(userId: string, ids: number[] | undefined, all: boolean): Promise<void> {
    if (!all && (!ids || ids.length === 0)) return;
    await this.database.db
      .update(notifications)
      .set({ readAt: sql`now()` })
      .where(
        and(
          eq(notifications.userId, userId),
          isNull(notifications.readAt),
          all ? undefined : inArray(notifications.id, ids ?? []),
        ),
      );
  }

  // ---------------------------------------------------------------- settings

  async settings(userId: string): Promise<NotificationSettings> {
    const [row] = await this.database.db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, userId));
    return {
      emailEnabled: row?.emailEnabled ?? true,
      emailCategories: (row?.emailCategories ?? [
        ...NOTIFICATION_CATEGORIES,
      ]) as NotificationCategory[],
      emailMode: (row?.emailMode ?? 'immediate') as EmailMode,
      digestHour: row?.digestHour ?? 8,
      notifyOwnChanges: row?.notifyOwnChanges ?? false,
      emailAvailable: this.mailer.enabled,
    };
  }

  async updateSettings(
    userId: string,
    request: UpdateNotificationSettings,
  ): Promise<NotificationSettings> {
    const values = {
      emailEnabled: request.emailEnabled,
      emailCategories: [...new Set(request.emailCategories)],
      emailMode: request.emailMode,
      digestHour: request.digestHour,
      notifyOwnChanges: request.notifyOwnChanges,
    };
    await this.database.db
      .insert(notificationSettings)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: notificationSettings.userId, set: values });
    return this.settings(userId);
  }
}
