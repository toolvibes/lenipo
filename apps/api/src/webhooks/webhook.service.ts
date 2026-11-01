import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreatedWebhook,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  Webhook,
  WebhookDelivery,
  WebhookEventType,
  WebhookFormat,
} from '@tasklore/shared';
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AuditService } from '../audit/audit.service.js';
import type { AppConfig } from '../core/config.js';
import type { Principal } from '../core/http/principal.js';
import type { Logger } from '../core/logger.js';
import { CONFIG, DATABASE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle, Executor } from '../db/client.js';
import {
  domainEvents,
  issueComments,
  issues,
  issueWorklogs,
  pages,
  projects,
  spaces,
  sprints,
  statuses,
  users,
  webhookDeliveries,
  webhooks,
} from '../db/schema/index.js';
import type { IssueEvent } from '../notifications/events.js';
import { SearchService } from '../search/search.service.js';
import { IssueService } from '../tracking/issue.service.js';
import { chatMessage } from './chat.js';
import { BlockedAddressError, isPrivateAddress, postJson } from './http.js';
import { generateSecret, sign } from './signature.js';

type WebhookRow = typeof webhooks.$inferSelect;
type DeliveryRow = typeof webhookDeliveries.$inferSelect;
type EventRow = typeof domainEvents.$inferSelect;

const TIMEOUT_MS = 10_000;
/** Waits after attempt 1, 2, … (about a day in total, E-45). */
const BACKOFF_SECONDS = [5, 5 * 60, 30 * 60, 2 * 3600, 5 * 3600, 10 * 3600, 10 * 3600];
const MAX_ATTEMPTS = BACKOFF_SECONDS.length + 1;
const DISABLE_AFTER_FAILING_DAYS = 3;
const KEEP_DAYS = 30;

/** The status a transition event moved the issue into. */
function statusAfter(event: IssueEvent): string | null {
  if (event.type !== 'issue.updated') return null;
  return event.items.find((item) => item.field === 'status')?.toValue ?? null;
}

/** The public event type of an outbox event; transitions are updates that change the status. */
export function webhookEventType(event: IssueEvent): WebhookEventType {
  switch (event.type) {
    case 'issue.created':
      return 'issue.created';
    case 'issue.updated':
      return event.items.some((item) => item.field === 'status')
        ? 'issue.transitioned'
        : 'issue.updated';
    case 'issue.commented':
      return event.edited ? 'comment.updated' : 'comment.created';
    case 'issue.comment_deleted':
      return 'comment.deleted';
    case 'issue.worklog':
      return `worklog.${event.action}`;
    case 'issue.deleted':
      return 'issue.deleted';
  }
}

/** Outgoing webhooks (D-HOOK-01/-03, E-45), managed by global administrators. */
@Injectable()
export class WebhookService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(IssueService) private readonly issues: IssueService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(SearchService) private readonly search: SearchService,
  ) {}

  // ---------------------------------------------------------------- management

  private async statusIds(ids: string[]): Promise<string[]> {
    const wanted = [...new Set(ids)];
    if (wanted.length === 0) return [];
    const rows = await this.database.db
      .select({ id: statuses.id })
      .from(statuses)
      .where(inArray(statuses.id, wanted));
    if (rows.length !== wanted.length) throw new BadRequestException('Unknown status');
    return wanted;
  }

  private async projectIds(keys: string[]): Promise<string[]> {
    if (keys.length === 0) return [];
    const wanted = [...new Set(keys.map((key) => key.toUpperCase()))];
    const rows = await this.database.db
      .select({ id: projects.id, key: projects.key })
      .from(projects)
      .where(inArray(projects.key, wanted));
    const missing = wanted.filter((key) => !rows.some((row) => row.key === key));
    if (missing.length > 0) throw new BadRequestException(`Unknown project ${missing.join(', ')}`);
    return rows.map((row) => row.id);
  }

  private async spaceIds(keys: string[]): Promise<string[]> {
    if (keys.length === 0) return [];
    const wanted = [...new Set(keys.map((key) => key.toUpperCase()))];
    const rows = await this.database.db
      .select({ id: spaces.id, key: spaces.key })
      .from(spaces)
      .where(inArray(spaces.key, wanted));
    const missing = wanted.filter((key) => !rows.some((row) => row.key === key));
    if (missing.length > 0) throw new BadRequestException(`Unknown space ${missing.join(', ')}`);
    return rows.map((row) => row.id);
  }

  /** A filter must be valid TQL for the person saving it; sorting makes no sense here. */
  private async checkTql(principal: Principal, tql: string | null | undefined) {
    if (!tql) return null;
    if (/\border\s+by\b/i.test(tql)) throw new BadRequestException('The filter cannot sort');
    await this.search.search(
      { userId: principal.userId, via: 'session', sessionId: 'webhook' },
      { query: `(${tql})`, limit: 1, offset: 0 },
    );
    return tql;
  }

  /** Whether an issue matches a webhook's TQL, seen with its creator's rights. */
  private async matches(webhook: WebhookRow, issueKey: string): Promise<boolean> {
    if (!webhook.tql) return true;
    if (!webhook.createdById) return false;
    try {
      const found = await this.search.search(
        { userId: webhook.createdById, via: 'session', sessionId: 'webhook' },
        { query: `key = ${issueKey} AND (${webhook.tql})`, limit: 1, offset: 0 },
      );
      return found.total > 0;
    } catch (error) {
      this.logger.warn({ err: error, webhook: webhook.id }, 'Webhook filter failed');
      return false;
    }
  }

  /** Early feedback for literal private addresses; names are checked again on every delivery. */
  private checkTarget(url: string): void {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
    if (
      !this.config.WEBHOOK_ALLOW_PRIVATE_NETWORKS &&
      (host === 'localhost' || isPrivateAddress(host))
    ) {
      throw new BadRequestException(
        'Webhooks may not target private addresses unless WEBHOOK_ALLOW_PRIVATE_NETWORKS is set',
      );
    }
  }

  private async present(rows: WebhookRow[]): Promise<Webhook[]> {
    if (rows.length === 0) return [];
    const db = this.database.db;
    const projectIdList = [...new Set(rows.flatMap((row) => row.projectIds))];
    const projectRows =
      projectIdList.length > 0
        ? await db
            .select({ id: projects.id, key: projects.key })
            .from(projects)
            .where(inArray(projects.id, projectIdList))
        : [];
    const keyOf = new Map(projectRows.map((row) => [row.id, row.key]));
    const spaceIdList = [...new Set(rows.flatMap((row) => row.spaceIds))];
    const spaceRows =
      spaceIdList.length > 0
        ? await db
            .select({ id: spaces.id, key: spaces.key })
            .from(spaces)
            .where(inArray(spaces.id, spaceIdList))
        : [];
    const spaceKeyOf = new Map(spaceRows.map((row) => [row.id, row.key]));
    const latest = await db
      .selectDistinctOn([webhookDeliveries.webhookId], {
        webhookId: webhookDeliveries.webhookId,
        status: webhookDeliveries.status,
        responseStatus: webhookDeliveries.responseStatus,
        at: sql<Date>`coalesce(${webhookDeliveries.lastAttemptAt}, ${webhookDeliveries.createdAt})`,
      })
      .from(webhookDeliveries)
      .where(
        inArray(
          webhookDeliveries.webhookId,
          rows.map((row) => row.id),
        ),
      )
      .orderBy(webhookDeliveries.webhookId, desc(webhookDeliveries.createdAt));
    return rows.map((row) => {
      const last = latest.find((entry) => entry.webhookId === row.id);
      return {
        id: row.id,
        name: row.name,
        url: row.url,
        events: row.events as WebhookEventType[],
        projectKeys: row.projectIds.flatMap((id) => keyOf.get(id) ?? []),
        statusIds: row.statusIds,
        tql: row.tql,
        spaceKeys: row.spaceIds.flatMap((id) => spaceKeyOf.get(id) ?? []),
        format: row.format as WebhookFormat,
        locale: row.locale === 'en' ? 'en' : 'de',
        enabled: row.enabled,
        disabledReason: row.disabledReason,
        failingSince: row.failingSince?.toISOString() ?? null,
        lastDelivery: last
          ? {
              status: last.status,
              responseStatus: last.responseStatus,
              at: new Date(last.at).toISOString(),
            }
          : null,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }

  private async load(id: string): Promise<WebhookRow> {
    const [row] = await this.database.db.select().from(webhooks).where(eq(webhooks.id, id));
    if (!row) throw new NotFoundException('Webhook not found');
    return row;
  }

  async list(): Promise<Webhook[]> {
    return this.present(await this.database.db.select().from(webhooks).orderBy(webhooks.name));
  }

  async get(id: string): Promise<Webhook> {
    const [webhook] = await this.present([await this.load(id)]);
    return webhook as Webhook;
  }

  async create(principal: Principal, request: CreateWebhookRequest): Promise<CreatedWebhook> {
    this.checkTarget(request.url);
    const id = uuidv7();
    const secret = generateSecret();
    await this.database.db.insert(webhooks).values({
      id,
      name: request.name,
      url: request.url,
      secret,
      events: [...new Set(request.events)],
      projectIds: await this.projectIds(request.projectKeys),
      statusIds: await this.statusIds(request.statusIds),
      tql: await this.checkTql(principal, request.tql),
      spaceIds: await this.spaceIds(request.spaceKeys),
      format: request.format,
      locale: request.locale,
      enabled: request.enabled,
      createdById: principal.userId,
    });
    await this.audit.record({
      action: 'webhook.created',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'webhook',
      targetId: id,
      details: { name: request.name, url: request.url, events: request.events },
    });
    return { ...(await this.get(id)), secret };
  }

  async update(principal: Principal, id: string, request: UpdateWebhookRequest): Promise<Webhook> {
    await this.load(id);
    if (request.url !== undefined) this.checkTarget(request.url);
    await this.database.db
      .update(webhooks)
      .set({
        ...(request.name !== undefined ? { name: request.name } : {}),
        ...(request.url !== undefined ? { url: request.url } : {}),
        ...(request.events !== undefined ? { events: [...new Set(request.events)] } : {}),
        ...(request.projectKeys !== undefined
          ? { projectIds: await this.projectIds(request.projectKeys) }
          : {}),
        ...(request.statusIds !== undefined
          ? { statusIds: await this.statusIds(request.statusIds) }
          : {}),
        ...(request.tql !== undefined ? { tql: await this.checkTql(principal, request.tql) } : {}),
        ...(request.spaceKeys !== undefined
          ? { spaceIds: await this.spaceIds(request.spaceKeys) }
          : {}),
        ...(request.format !== undefined ? { format: request.format } : {}),
        ...(request.locale !== undefined ? { locale: request.locale } : {}),
        // Switching a webhook on again also clears the reason the system switched it off.
        ...(request.enabled !== undefined
          ? {
              enabled: request.enabled,
              ...(request.enabled ? { disabledReason: null, failingSince: null } : {}),
            }
          : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(webhooks.id, id));
    await this.audit.record({
      action: 'webhook.updated',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'webhook',
      targetId: id,
      details: { ...request },
    });
    return this.get(id);
  }

  async delete(principal: Principal, id: string): Promise<void> {
    const row = await this.load(id);
    await this.database.db.delete(webhooks).where(eq(webhooks.id, id));
    await this.audit.record({
      action: 'webhook.deleted',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'webhook',
      targetId: id,
      details: { name: row.name, url: row.url },
    });
  }

  async rotateSecret(principal: Principal, id: string): Promise<string> {
    await this.load(id);
    const secret = generateSecret();
    await this.database.db
      .update(webhooks)
      .set({ secret, updatedAt: sql`now()` })
      .where(eq(webhooks.id, id));
    await this.audit.record({
      action: 'webhook.secret_rotated',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'webhook',
      targetId: id,
    });
    return secret;
  }

  private presentDelivery(row: DeliveryRow): WebhookDelivery {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      attempts: row.attempts,
      nextAttemptAt: row.status === 'pending' ? row.nextAttemptAt.toISOString() : null,
      lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
      responseStatus: row.responseStatus,
      responseBody: row.responseBody,
      durationMs: row.durationMs,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async deliveries(id: string, limit: number): Promise<WebhookDelivery[]> {
    await this.load(id);
    const rows = await this.database.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, id))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit);
    return rows.map((row) => this.presentDelivery(row));
  }

  /** Sends a ping right away, so administrators see at once whether the target answers. */
  async test(id: string): Promise<WebhookDelivery> {
    const webhook = await this.load(id);
    const deliveryId = uuidv7();
    const [row] = await this.database.db
      .insert(webhookDeliveries)
      .values({
        id: deliveryId,
        webhookId: id,
        type: 'webhook.test',
        payload: {
          type: 'webhook.test',
          timestamp: new Date().toISOString(),
          data: { webhook: { id: webhook.id, name: webhook.name } },
        },
      })
      .returning();
    return this.presentDelivery(await this.send(row as DeliveryRow, webhook));
  }

  /** Sends a delivery again now, e.g. after the receiver was fixed. */
  async resend(id: string, deliveryId: string): Promise<WebhookDelivery> {
    const webhook = await this.load(id);
    const [row] = await this.database.db
      .update(webhookDeliveries)
      .set({ status: 'pending', nextAttemptAt: sql`now()` })
      .where(and(eq(webhookDeliveries.id, deliveryId), eq(webhookDeliveries.webhookId, id)))
      .returning();
    if (!row) throw new NotFoundException('Delivery not found');
    return this.presentDelivery(await this.send(row, webhook));
  }

  // ---------------------------------------------------------------- events to deliveries

  /** Creates the deliveries for an outbox event, inside the event's processing transaction. */
  async enqueue(tx: Executor, row: EventRow): Promise<void> {
    if (row.type.startsWith('git.')) return;
    if (!row.issueId) {
      await this.enqueueOther(tx, row);
      return;
    }
    const event = { type: row.type, ...(row.payload as object) } as IssueEvent;
    const type = webhookEventType(event);
    const [issue] = await tx
      .select({ id: issues.id, projectId: issues.projectId, deletedAt: issues.deletedAt })
      .from(issues)
      .where(eq(issues.id, row.issueId));
    // A deleted issue still announces its deletion (TL-61, E-126), nothing after it.
    if (!issue || (issue.deletedAt && event.type !== 'issue.deleted')) return;
    const targets = (await tx.select().from(webhooks).where(eq(webhooks.enabled, true))).filter(
      (webhook) =>
        webhook.events.includes(type) &&
        (webhook.projectIds.length === 0 || webhook.projectIds.includes(issue.projectId)) &&
        (type !== 'issue.transitioned' ||
          webhook.statusIds.length === 0 ||
          webhook.statusIds.includes(statusAfter(event) ?? '')),
    );
    if (targets.length === 0) return;
    const snapshot =
      event.type === 'issue.deleted'
        ? { id: issue.id, key: event.key, summary: event.summary, subtasks: event.subtasks }
        : await this.issues.snapshot(issue.id);
    const matching: typeof targets = [];
    for (const webhook of targets) {
      // The filter cannot see a deleted issue; only unfiltered webhooks hear about deletions.
      if (event.type === 'issue.deleted' ? !webhook.tql : await this.matches(webhook, snapshot.key))
        matching.push(webhook);
    }
    if (matching.length === 0) return;

    const [actor] = row.actorId
      ? await tx
          .select({ id: users.id, displayName: users.displayName })
          .from(users)
          .where(eq(users.id, row.actorId))
      : [];
    const data: Record<string, unknown> = {
      eventId: row.id,
      actor: actor ?? null,
      issue: snapshot,
    };
    if (event.type === 'issue.updated') {
      data.changes = event.items.map((item) => ({
        field: item.field,
        from: item.fromDisplay,
        to: item.toDisplay,
      }));
    }
    if (event.type === 'issue.commented' || event.type === 'issue.comment_deleted') {
      const [comment] = await tx
        .select()
        .from(issueComments)
        .where(eq(issueComments.id, event.commentId));
      data.comment =
        event.type === 'issue.comment_deleted' || !comment
          ? { id: event.commentId }
          : {
              id: comment.id,
              body: comment.body,
              text: comment.bodyText,
              createdAt: comment.createdAt.toISOString(),
              updatedAt: comment.updatedAt.toISOString(),
            };
    }
    if (event.type === 'issue.worklog') {
      const [worklog] = await tx
        .select()
        .from(issueWorklogs)
        .where(eq(issueWorklogs.id, event.worklogId));
      data.worklog = worklog
        ? {
            id: worklog.id,
            started: worklog.startedAt.toISOString(),
            timeSpentSeconds: worklog.timeSpentSeconds,
            comment: worklog.comment,
          }
        : { id: event.worklogId, timeSpentSeconds: event.timeSpentSeconds };
    }
    const payload = { type, timestamp: row.createdAt.toISOString(), data };
    await tx.insert(webhookDeliveries).values(
      matching.map((webhook) => ({
        id: uuidv7(),
        webhookId: webhook.id,
        eventId: row.id,
        type,
        payload,
      })),
    );
  }

  /** Page, sprint and version events (TL-41, E-122), filtered by space or project. */
  private async enqueueOther(tx: Executor, row: EventRow): Promise<void> {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    let type: WebhookEventType;
    let data: Record<string, unknown>;
    let fits: (webhook: WebhookRow) => boolean;
    if ((row.type === 'page.published' || row.type === 'page.commented') && row.pageId) {
      if (row.type === 'page.commented' && payload.edited) return;
      const [page] = await tx
        .select({ id: pages.id, title: pages.title, spaceId: pages.spaceId, key: spaces.key })
        .from(pages)
        .innerJoin(spaces, eq(spaces.id, pages.spaceId))
        .where(eq(pages.id, row.pageId));
      if (!page) return;
      type = row.type;
      data = {
        page: { id: page.id, title: page.title, spaceKey: page.key },
        ...(row.type === 'page.published'
          ? { version: payload.version, comment: payload.comment }
          : { comment: { id: payload.commentId, text: payload.excerpt } }),
      };
      fits = (webhook) => webhook.spaceIds.length === 0 || webhook.spaceIds.includes(page.spaceId);
    } else if (
      row.type === 'sprint.started' ||
      row.type === 'sprint.completed' ||
      row.type === 'version.released'
    ) {
      const projectId = String(payload.projectId ?? '');
      const [project] = await tx
        .select({ key: projects.key })
        .from(projects)
        .where(eq(projects.id, projectId));
      if (!project) return;
      type = row.type;
      if (row.type === 'version.released') {
        data = { version: { id: payload.versionId, name: payload.name, projectKey: project.key } };
      } else {
        const [sprint] = await tx
          .select({ goal: sprints.goal, startDate: sprints.startDate, endDate: sprints.endDate })
          .from(sprints)
          .where(eq(sprints.id, String(payload.sprintId ?? '')));
        data = {
          sprint: {
            id: payload.sprintId,
            name: payload.name,
            boardId: payload.boardId,
            projectKey: project.key,
            ...(sprint ?? {}),
          },
        };
      }
      fits = (webhook) => webhook.projectIds.length === 0 || webhook.projectIds.includes(projectId);
    } else {
      return;
    }
    const targets = (await tx.select().from(webhooks).where(eq(webhooks.enabled, true))).filter(
      (webhook) => webhook.events.includes(type) && fits(webhook),
    );
    if (targets.length === 0) return;
    const [actor] = row.actorId
      ? await tx
          .select({ id: users.id, displayName: users.displayName })
          .from(users)
          .where(eq(users.id, row.actorId))
      : [];
    const body = {
      type,
      timestamp: row.createdAt.toISOString(),
      data: { eventId: row.id, actor: actor ?? null, ...data },
    };
    await tx.insert(webhookDeliveries).values(
      targets.map((webhook) => ({
        id: uuidv7(),
        webhookId: webhook.id,
        eventId: row.id,
        type,
        payload: body,
      })),
    );
  }

  // ---------------------------------------------------------------- sending

  /** Sends due deliveries of enabled webhooks; safe with several workers (lease by time). */
  async deliverDue(limit = 20): Promise<number> {
    const claimed = await this.database.db.transaction(async (tx) => {
      const due = await tx
        .select({ delivery: webhookDeliveries, webhook: webhooks })
        .from(webhookDeliveries)
        .innerJoin(webhooks, eq(webhooks.id, webhookDeliveries.webhookId))
        .where(
          and(
            eq(webhookDeliveries.status, 'pending'),
            sql`${webhookDeliveries.nextAttemptAt} <= now()`,
            eq(webhooks.enabled, true),
          ),
        )
        .orderBy(webhookDeliveries.nextAttemptAt)
        .limit(limit)
        .for('update', { of: webhookDeliveries, skipLocked: true });
      if (due.length > 0) {
        // A lease: if this worker dies mid-send, another one picks the delivery up later.
        await tx
          .update(webhookDeliveries)
          .set({ nextAttemptAt: sql`now() + interval '2 minutes'` })
          .where(
            inArray(
              webhookDeliveries.id,
              due.map((entry) => entry.delivery.id),
            ),
          );
      }
      return due;
    });
    await Promise.all(claimed.map(({ delivery, webhook }) => this.send(delivery, webhook)));
    return claimed.length;
  }

  private async send(delivery: DeliveryRow, webhook: WebhookRow): Promise<DeliveryRow> {
    // Chat formats turn the payload into a message for the platform's incoming webhook (E-112).
    const body = JSON.stringify(
      webhook.format === 'standard'
        ? delivery.payload
        : chatMessage(
            webhook.format as Exclude<WebhookFormat, 'standard'>,
            webhook.locale === 'en' ? 'en' : 'de',
            delivery.payload,
            this.config.PUBLIC_URL ?? '',
          ),
    );
    const timestamp = Math.floor(Date.now() / 1000);
    const attempts = delivery.attempts + 1;
    let result: { ok: boolean; status: number | null; text: string; durationMs: number | null };
    try {
      const response = await postJson(
        webhook.url,
        {
          'content-type': 'application/json',
          'user-agent': 'Tasklore-Webhooks/1.0',
          'webhook-id': delivery.id,
          'webhook-timestamp': String(timestamp),
          'webhook-signature': sign(webhook.secret, delivery.id, timestamp, body),
        },
        body,
        { allowPrivate: this.config.WEBHOOK_ALLOW_PRIVATE_NETWORKS, timeoutMs: TIMEOUT_MS },
      );
      result = {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        text: response.body,
        durationMs: response.durationMs,
      };
    } catch (error) {
      result = {
        ok: false,
        status: null,
        text: error instanceof BlockedAddressError ? error.message : `Error: ${String(error)}`,
        durationMs: null,
      };
    }

    // Test messages answer the administrator right away and are not retried.
    const finished = result.ok || attempts >= MAX_ATTEMPTS || delivery.type === 'webhook.test';
    const wait = BACKOFF_SECONDS[attempts - 1] ?? 0;
    const [updated] = await this.database.db
      .update(webhookDeliveries)
      .set({
        status: result.ok ? 'succeeded' : finished ? 'failed' : 'pending',
        attempts,
        lastAttemptAt: sql`now()`,
        nextAttemptAt: finished ? sql`now()` : sql`now() + make_interval(secs => ${wait})`,
        responseStatus: result.status,
        responseBody: result.text.slice(0, 1_024),
        durationMs: result.durationMs,
      })
      .where(eq(webhookDeliveries.id, delivery.id))
      .returning();
    if (delivery.type !== 'webhook.test') await this.trackHealth(webhook, result.ok);
    return updated ?? delivery;
  }

  /** Remembers since when a webhook only fails and switches it off after three days. */
  private async trackHealth(webhook: WebhookRow, ok: boolean): Promise<void> {
    if (ok) {
      if (webhook.failingSince) {
        await this.database.db
          .update(webhooks)
          .set({ failingSince: null })
          .where(eq(webhooks.id, webhook.id));
      }
      return;
    }
    await this.database.db
      .update(webhooks)
      .set({ failingSince: sql`coalesce(${webhooks.failingSince}, now())` })
      .where(eq(webhooks.id, webhook.id));
    const [disabled] = await this.database.db
      .update(webhooks)
      .set({
        enabled: false,
        disabledReason: `Only failed deliveries for ${DISABLE_AFTER_FAILING_DAYS} days`,
      })
      .where(
        and(
          eq(webhooks.id, webhook.id),
          eq(webhooks.enabled, true),
          lt(
            webhooks.failingSince,
            sql`now() - make_interval(days => ${DISABLE_AFTER_FAILING_DAYS})`,
          ),
        ),
      )
      .returning({ id: webhooks.id });
    if (disabled)
      this.logger.warn({ webhook: webhook.id }, 'Webhook switched off after repeated failures');
  }

  /** Drops delivery logs and processed outbox events older than 30 days. */
  async cleanUp(): Promise<void> {
    await this.database.db
      .delete(webhookDeliveries)
      .where(lt(webhookDeliveries.createdAt, sql`now() - make_interval(days => ${KEEP_DAYS})`));
    await this.database.db
      .delete(domainEvents)
      .where(
        and(
          lt(domainEvents.createdAt, sql`now() - make_interval(days => ${KEEP_DAYS})`),
          sql`${domainEvents.processedAt} is not null`,
        ),
      );
  }
}
