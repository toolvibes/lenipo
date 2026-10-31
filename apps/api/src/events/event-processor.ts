import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, isNull, sql } from 'drizzle-orm';
import { AutomationEngine } from '../automation/automation.engine.js';
import type { Logger } from '../core/logger.js';
import { DATABASE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { domainEvents } from '../db/schema/index.js';
import { NotificationService } from '../notifications/notification.service.js';
import { ProjectPagesService } from '../releases/project-pages.service.js';
import { WebhookService } from '../webhooks/webhook.service.js';

const MAX_ATTEMPTS = 5;

/**
 * Reads the transactional outbox (E-44) and hands each event to its consumers (notifications,
 * webhooks) in one transaction per batch; safe with several workers.
 */
@Injectable()
export class EventProcessor {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(NotificationService) private readonly notifications: NotificationService,
    @Inject(WebhookService) private readonly webhooks: WebhookService,
    @Inject(AutomationEngine) private readonly automation: AutomationEngine,
    @Inject(ProjectPagesService) private readonly projectPages: ProjectPagesService,
  ) {}

  /** Handles a batch of pending events; returns how many were taken. */
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
          await tx.transaction(async (savepoint) => {
            await this.notifications.handle(savepoint, row);
            await this.webhooks.enqueue(savepoint, row);
            await this.automation.enqueue(savepoint, row);
          });
          await tx
            .update(domainEvents)
            .set({ processedAt: sql`now()` })
            .where(eq(domainEvents.id, row.id));
          // Pages are written on their own connections; labels keep a retry from doubling them.
          await this.projectPages.handle(row);
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

  /** Processes until the outbox is empty (tests, and bursts in the worker). */
  async drain(): Promise<void> {
    while ((await this.processPendingEvents()) > 0);
  }
}
