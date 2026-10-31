import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { AutomationEngine } from '../automation/automation.engine.js';
import { type AppConfig, runsRole } from '../core/config.js';
import type { Logger } from '../core/logger.js';
import { CONFIG, DATABASE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { DirectoryService } from '../identity/directory.service.js';
import { OAuthService } from '../identity/oauth.service.js';
import { ImportService } from '../imports/import.service.js';
import { NotificationService } from '../notifications/notification.service.js';
import { FilterSubscriptionService } from '../search/filter-subscription.service.js';
import { WebhookService } from '../webhooks/webhook.service.js';
import { wikiSettings } from '../wiki/blog.controller.js';
import { PageService } from '../wiki/page.service.js';
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
    @Inject(PageService) private readonly pages: PageService,
    @Inject(FilterSubscriptionService) private readonly subscriptions: FilterSubscriptionService,
    @Inject(OAuthService) private readonly oauth: OAuthService,
    @Inject(DirectoryService) private readonly directories: DirectoryService,
    @Inject(ImportService) private readonly imports: ImportService,
    @Inject(DATABASE) private readonly database: DatabaseHandle,
  ) {}

  onApplicationBootstrap(): void {
    if (!runsRole(this.config, 'worker') || this.config.NODE_ENV === 'test') return;
    this.every('events', 2_000, () => this.events.drain());
    this.every('webhooks', 2_000, async () => {
      while ((await this.webhooks.deliverDue()) > 0);
    });
    this.every('email', 15_000, () => this.notifications.sendDueEmails().then(() => {}));
    // Digests and filter subscriptions go out at their hour; checked every few minutes (E-112).
    this.every('digests', 5 * 60_000, () => this.notifications.sendDigests().then(() => {}));
    this.every('subscriptions', 5 * 60_000, () => this.subscriptions.sendDue().then(() => {}));
    // Imports run one at a time; a long one keeps the loop busy (TL-35).
    this.every('imports', 5_000, () => this.imports.runPending().then(() => {}));
    this.every('automation', 2_000, async () => {
      while ((await this.automation.runDue()) > 0);
    });
    this.every('schedules', 30_000, () => this.automation.tickSchedules());
    // Verified pages that nobody touched for long enough become outdated (TL-29).
    this.every('outdated', 60 * 60_000, async () => {
      const { outdatedAfterDays } = await wikiSettings(this.database);
      if (outdatedAfterDays) await this.pages.markOutdated(outdatedAfterDays);
    });
    this.every('cleanup', 60 * 60_000, async () => {
      await this.webhooks.cleanUp();
      await this.automation.cleanUp();
      await this.oauth.cleanUp();
      // LDAP directories mirror people and groups once an hour (TL-38, E-119).
      await this.directories.syncAll();
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
