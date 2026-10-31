import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type CreateFilterSubscription,
  type FilterSubscription,
  SUBSCRIPTION_ISSUE_LIMIT,
  type SubscriptionSchedule,
} from '@tasklore/shared';
import { and, asc, eq, inArray, or } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { AppConfig } from '../core/config.js';
import type { Principal } from '../core/http/principal.js';
import type { Logger } from '../core/logger.js';
import { CONFIG, DATABASE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { groupMembers, groups, users } from '../db/schema/identity.js';
import { filterSubscriptions, savedFilters } from '../db/schema/search.js';
import { filterEmail } from '../notifications/email.js';
import { localTime } from '../notifications/local-time.js';
import { Mailer } from '../notifications/mailer.js';
import { FilterService } from './filter.service.js';
import { SearchService } from './search.service.js';

type Row = typeof filterSubscriptions.$inferSelect;

/** Whether a schedule wants a mail at this local hour and weekday. */
export function isDue(
  row: { schedule: string; weekday: number; hour: number; lastSentAt: Date | null },
  local: { hour: number; weekday: number },
  now: Date,
): boolean {
  if (local.hour !== row.hour) return false;
  const schedule = row.schedule as SubscriptionSchedule;
  if (schedule === 'weekdays' && local.weekday > 5) return false;
  if (schedule === 'weekly' && local.weekday !== row.weekday) return false;
  // Once per day at most, however often the job runs in that hour.
  return !row.lastSentAt || now.getTime() - row.lastSentAt.getTime() >= 20 * 3600_000;
}

/** Filter results by e-mail on a schedule (T-QRY-07, E-112). */
@Injectable()
export class FilterSubscriptionService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(FilterService) private readonly filters: FilterService,
    @Inject(SearchService) private readonly search: SearchService,
    @Inject(Mailer) private readonly mailer: Mailer,
  ) {}

  private async present(principal: Principal, ownerId: string, rows: Row[]) {
    const db = this.database.db;
    const people = rows.length
      ? await db
          .select({ id: users.id, displayName: users.displayName })
          .from(users)
          .where(inArray(users.id, [...new Set(rows.map((row) => row.userId))]))
      : [];
    const groupIds = [...new Set(rows.flatMap((row) => (row.groupId ? [row.groupId] : [])))];
    const groupRows = groupIds.length
      ? await db
          .select({ id: groups.id, name: groups.name })
          .from(groups)
          .where(inArray(groups.id, groupIds))
      : [];
    return rows.map(
      (row): FilterSubscription => ({
        id: row.id,
        filterId: row.filterId,
        schedule: row.schedule as SubscriptionSchedule,
        weekday: row.weekday,
        hour: row.hour,
        onlyWithResults: row.onlyWithResults,
        subscriber: people.find((person) => person.id === row.userId) ?? {
          id: row.userId,
          displayName: '?',
        },
        group: groupRows.find((group) => group.id === row.groupId) ?? null,
        lastSentAt: row.lastSentAt?.toISOString() ?? null,
        canDelete: row.userId === principal.userId || ownerId === principal.userId,
      }),
    );
  }

  private async myGroupIds(userId: string): Promise<string[]> {
    const rows = await this.database.db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(eq(groupMembers.userId, userId));
    return rows.map((row) => row.groupId);
  }

  /** The caller's subscriptions and those of their groups; the owner sees all of the filter. */
  async list(principal: Principal, filterId: string): Promise<FilterSubscription[]> {
    const filter = await this.filters.get(principal, filterId);
    const mine = await this.myGroupIds(principal.userId);
    const rows = await this.database.db
      .select()
      .from(filterSubscriptions)
      .where(
        and(
          eq(filterSubscriptions.filterId, filterId),
          filter.owner.id === principal.userId
            ? undefined
            : or(
                eq(filterSubscriptions.userId, principal.userId),
                mine.length ? inArray(filterSubscriptions.groupId, mine) : undefined,
              ),
        ),
      )
      .orderBy(asc(filterSubscriptions.createdAt));
    return this.present(principal, filter.owner.id, rows);
  }

  async create(
    principal: Principal,
    filterId: string,
    request: CreateFilterSubscription,
  ): Promise<FilterSubscription> {
    const filter = await this.filters.get(principal, filterId);
    if (request.groupId) {
      if (filter.owner.id !== principal.userId) {
        throw new ForbiddenException('Only the owner of the filter can subscribe a group');
      }
      if (!(await this.myGroupIds(principal.userId)).includes(request.groupId)) {
        throw new BadRequestException('You can only subscribe groups you belong to');
      }
    }
    const [row] = await this.database.db
      .insert(filterSubscriptions)
      .values({
        id: uuidv7(),
        filterId,
        userId: principal.userId,
        groupId: request.groupId ?? null,
        schedule: request.schedule,
        weekday: request.weekday,
        hour: request.hour,
        onlyWithResults: request.onlyWithResults,
      })
      .returning();
    const [presented] = await this.present(principal, filter.owner.id, [row as Row]);
    return presented as FilterSubscription;
  }

  async delete(principal: Principal, id: string): Promise<void> {
    const [row] = await this.database.db
      .select({ subscription: filterSubscriptions, ownerId: savedFilters.ownerId })
      .from(filterSubscriptions)
      .innerJoin(savedFilters, eq(savedFilters.id, filterSubscriptions.filterId))
      .where(eq(filterSubscriptions.id, id));
    if (
      !row ||
      (row.subscription.userId !== principal.userId && row.ownerId !== principal.userId)
    ) {
      throw new NotFoundException('Subscription not found');
    }
    await this.database.db.delete(filterSubscriptions).where(eq(filterSubscriptions.id, id));
  }

  /** Sends the subscriptions due now; each recipient sees only what they may see. */
  async sendDue(now = new Date()): Promise<number> {
    if (!this.mailer.enabled) return 0;
    const db = this.database.db;
    const rows = await db
      .select({ subscription: filterSubscriptions, timeZone: users.timeZone })
      .from(filterSubscriptions)
      .innerJoin(users, eq(users.id, filterSubscriptions.userId))
      .where(eq(users.status, 'active'));
    let sent = 0;
    for (const { subscription, timeZone } of rows) {
      if (!isDue(subscription, localTime(now, timeZone), now)) continue;
      const recipients = subscription.groupId
        ? (
            await db
              .select({ id: groupMembers.userId })
              .from(groupMembers)
              .where(eq(groupMembers.groupId, subscription.groupId))
          ).map((member) => member.id)
        : [subscription.userId];
      for (const userId of recipients) {
        try {
          if (await this.sendTo(userId, subscription)) sent += 1;
        } catch (error) {
          this.logger.error(
            { err: error, subscription: subscription.id, userId },
            'Sending a filter subscription failed',
          );
        }
      }
      await db
        .update(filterSubscriptions)
        .set({ lastSentAt: now })
        .where(eq(filterSubscriptions.id, subscription.id));
    }
    return sent;
  }

  private async sendTo(userId: string, subscription: Row): Promise<boolean> {
    const [person] = await this.database.db.select().from(users).where(eq(users.id, userId));
    if (person?.status !== 'active') return false;
    const principal: Principal = { userId, via: 'session', sessionId: 'subscription' };
    // A filter that is no longer shared with the person sends them nothing.
    const filter = await this.filters.get(principal, subscription.filterId).catch(() => null);
    if (!filter) return false;
    const result = await this.search.search(principal, {
      query: filter.query,
      limit: SUBSCRIPTION_ISSUE_LIMIT,
      offset: 0,
    });
    if (subscription.onlyWithResults && result.total === 0) return false;
    await this.mailer.send(
      filterEmail({
        to: person.email,
        locale: person.locale,
        publicUrl: this.config.PUBLIC_URL,
        filter: { id: filter.id, name: filter.name },
        total: result.total,
        issues: result.issues.map((issue) => ({
          key: issue.key,
          summary: issue.summary,
          status: issue.status.name,
          assignee: issue.assignee?.displayName ?? null,
        })),
      }),
    );
    return true;
  }
}
