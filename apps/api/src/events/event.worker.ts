import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { AutomationEngine } from '../automation/automation.engine.js';
import { type AppConfig, runsRole } from '../core/config.js';
import type { Logger } from '../core/logger.js';
import { CONFIG, LOGGER } from '../core/tokens.js';
import { NotificationService } from '../notifications/notification.service.js';
import { WebhookService } from '../webhooks/webhook.service.js';
import { EventProcessor } from './event-processor.js';

/** The worker role's loops (E-44, E-45). Off in tests, which call the services directly. */
@Injectable()
export class EventWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private timers: NodeJS.Timeout[] = [];
  private busy = new Set<string>();

  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(EventProcessor) private readonly events: EventProcessor,
    @Inject(NotificationService) private readonly notifications: NotificationService,
    @Inject(WebhookService) private readonly webhooks: WebhookService,
    @Inject(AutomationEngine) private readonly automation: AutomationEngine,
  ) {}

  onApplicationBootstrap(): void {
    if (!runsRole(this.config, 'worker') || this.config.NODE_ENV === 'test') return;
    this.every('events', 2_000, () => this.events.drain());
    this.every('webhooks', 2_000, async () => {
      while ((await this.webhooks.deliverDue()) > 0);
    });
    this.every('email', 15_000, () => this.notifications.sendDueEmails().then(() => {}));
    this.every('automation', 2_000, async () => {
      while ((await this.automation.runDue()) > 0);
    });
    this.every('schedules', 30_000, () => this.automation.tickSchedules());
    this.every('cleanup', 60 * 60_000, async () => {
      await this.webhooks.cleanUp();
      await this.automation.cleanUp();
    });
    this.logger.info('Event worker running');
  }

  /** Runs a job periodically, never twice at the same time. */
  private every(name: string, interval: number, job: () => Promise<void>): void {
    const timer = setInterval(() => {
      if (this.busy.has(name)) return;
      this.busy.add(name);
      job()
        .catch((error) => this.logger.error({ err: error, job: name }, 'Worker job failed'))
        .finally(() => this.busy.delete(name));
    }, interval);
    timer.unref();
    this.timers.push(timer);
  }

  onApplicationShutdown(): void {
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
  }
}
