import { Inject, Injectable } from '@nestjs/common';
import {
  NOTIFICATION_CATEGORIES,
  type Notification,
  type NotificationCategory,
  type NotificationDetails,
  type NotificationList,
  type NotificationListQuery,
  type NotificationSettings,
  type UpdateNotificationSettings,
  type UserRef,
} from '@tasklore/shared';
import { and, asc, count, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { AppConfig } from '../core/config.js';
import type { Logger } from '../core/logger.js';
import { CONFIG, DATABASE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle, Executor } from '../db/client.js';
import {
  domainEvents,
  issues,
  issueWatchers,
  notificationSettings,
  notifications,
  users,
} from '../db/schema/index.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';
import { notificationEmail } from './email.js';
import type { ChangedItem, IssueEvent } from './events.js';
import { Mailer } from './mailer.js';

type EventRow = typeof domainEvents.$inferSelect;

const MAX_ATTEMPTS = 5;
const STATUS_FIELDS = new Set(['status', 'resolution']);

function issueEvent(row: EventRow): IssueEvent {
  return { type: row.type, ...(row.payload as object) } as IssueEvent;
}

function shown(items: ChangedItem[]): NotificationDetails['items'] {
  return items.map((item) => ({ field: item.field, from: item.fromDisplay, to: item.toDisplay }));
}

/**
 * In-app and email notifications (P-NTF-01/-02, E-44): events from the outbox become one
 * notification per recipient; emails bundle a person's notifications per issue.
 */
@Injectable()
export class NotificationService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(Mailer) private readonly mailer: Mailer,
  ) {}

  // ---------------------------------------------------------------- processing events

  /** Handles a batch of outbox events; returns how many were taken. Safe with several workers. */
  async processPendingEvents(limit = 50): Promise<number> {
    return this.database.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(domainEvents)
        .where(isNull(domainEvents.processedAt))
        .orderBy(asc(domainEvents.id))
        .limit(limit)
        .for('update', { skipLocked: true });
      for (const row of rows) {
        try {
          await tx.transaction((savepoint) => this.handle(savepoint, row));
          await tx
            .update(domainEvents)
            .set({ processedAt: sql`now()` })
            .where(eq(domainEvents.id, row.id));
        } catch (error) {
          const attempts = row.attempts + 1;
          this.logger.error({ err: error, event: row.id, attempts }, 'Processing an event failed');
          await tx
            .update(domainEvents)
            .set({
              attempts,
              lastError: String(error).slice(0, 1000),
              // Give up after a few attempts, so one broken event does not block the rest.
              ...(attempts >= MAX_ATTEMPTS ? { processedAt: sql`now()` } : {}),
            })
            .where(eq(domainEvents.id, row.id));
        }
      }
      return rows.length;
    });
  }

  /** Watchers plus mentioned people, minus the actor; only who may still see the issue. */
  private async handle(tx: Executor, row: EventRow): Promise<void> {
    if (!row.issueId) return;
    const [issue] = await tx.select().from(issues).where(eq(issues.id, row.issueId));
    if (!issue || issue.deletedAt) return;
    const event = issueEvent(row);
    const mentions = new Set(event.mentions);

    let candidates: string[];
    if (event.type === 'issue.commented' && event.edited) candidates = [...mentions];
    else {
      const watchers = await tx
        .select({ userId: issueWatchers.userId })
        .from(issueWatchers)
        .where(eq(issueWatchers.issueId, issue.id));
      candidates = [...new Set([...watchers.map((watcher) => watcher.userId), ...mentions])];
    }
    candidates = candidates.filter((id) => id !== row.actorId);
    if (candidates.length === 0) return;

    const active = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, candidates), eq(users.status, 'active')));
    const recipients: string[] = [];
    for (const { id } of active) {
      if ((await this.projectAccess.permissions(id, issue.projectId)).has('browse'))
        recipients.push(id);
    }
    if (recipients.length === 0) return;

    const settings = await tx
      .select()
      .from(notificationSettings)
      .where(inArray(notificationSettings.userId, recipients));
    const settingsOf = new Map(settings.map((entry) => [entry.userId, entry]));

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

    await tx.insert(notifications).values(
      recipients.map((userId) => {
        const kind = category(userId);
        const choice = settingsOf.get(userId);
        const wantsEmail =
          (choice?.emailEnabled ?? true) &&
          (choice?.emailCategories ?? NOTIFICATION_CATEGORIES).includes(kind);
        return {
          userId,
          issueId: issue.id,
          eventId: row.id,
          category: kind,
          actorId: row.actorId,
          details,
          emailPending: this.mailer.enabled && wantsEmail,
        };
      }),
    );
  }

  // ---------------------------------------------------------------- email

  /** Sends one email per person and issue once no change came for the quiet period. */
  async sendDueEmails(limit = 50): Promise<number> {
    if (!this.mailer.enabled) return 0;
    const delay = this.config.NOTIFICATION_EMAIL_DELAY_SECONDS;
    const groups = await this.database.db
      .select({ userId: notifications.userId, issueId: notifications.issueId })
      .from(notifications)
      .where(eq(notifications.emailPending, true))
      .groupBy(notifications.userId, notifications.issueId)
      .having(sql`max(${notifications.createdAt}) <= now() - make_interval(secs => ${delay})`)
      .limit(limit);
    let sent = 0;
    for (const group of groups) {
      try {
        if (await this.sendGroup(group.userId, group.issueId)) sent += 1;
      } catch (error) {
        // Stays pending; the next round tries again.
        this.logger.error({ err: error, ...group }, 'Sending a notification email failed');
      }
    }
    return sent;
  }

  private async sendGroup(userId: string, issueId: string): Promise<boolean> {
    return this.database.db.transaction(async (tx) => {
      const pending = await tx
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.issueId, issueId),
            eq(notifications.emailPending, true),
          ),
        )
        .orderBy(asc(notifications.id))
        .for('update', { skipLocked: true });
      if (pending.length === 0) return false;
      const [recipient] = await tx.select().from(users).where(eq(users.id, userId));
      const [issue] = await tx
        .select({ key: issues.key, summary: issues.summary })
        .from(issues)
        .where(eq(issues.id, issueId));
      if (recipient?.status === 'active' && issue) {
        const actors = await this.refs(
          tx,
          pending.map((entry) => entry.actorId),
        );
        await this.mailer.send(
          notificationEmail({
            to: recipient.email,
            locale: recipient.locale,
            issue,
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
    const rows = await this.database.db
      .select({ notification: notifications, key: issues.key, summary: issues.summary })
      .from(notifications)
      .innerJoin(issues, eq(issues.id, notifications.issueId))
      .where(
        and(
          eq(notifications.userId, userId),
          query.unread ? isNull(notifications.readAt) : undefined,
          query.before ? lt(notifications.id, query.before) : undefined,
        ),
      )
      .orderBy(desc(notifications.id))
      .limit(query.limit);
    const actors = await this.refs(
      this.database.db,
      rows.map((row) => row.notification.actorId),
    );
    const list: Notification[] = rows.map(({ notification, key, summary }) => ({
      id: notification.id,
      issue: { key, summary },
      actor: notification.actorId ? (actors.get(notification.actorId) ?? null) : null,
      category: notification.category,
      details: notification.details as NotificationDetails,
      createdAt: notification.createdAt.toISOString(),
      read: notification.readAt !== null,
    }));
    return { notifications: list, unreadCount: await this.unreadCount(userId) };
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
    };
    await this.database.db
      .insert(notificationSettings)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: notificationSettings.userId, set: values });
    return this.settings(userId);
  }
}
