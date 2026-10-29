import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { type AppConfig, runsRole } from '../core/config.js';
import type { Logger } from '../core/logger.js';
import { CONFIG, LOGGER } from '../core/tokens.js';
import { NotificationService } from './notification.service.js';

const EVENT_INTERVAL_MS = 2_000;
const EMAIL_INTERVAL_MS = 15_000;

/** The worker role's loop over the outbox and the email queue (E-44). Off in tests. */
@Injectable()
export class NotificationWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private timers: NodeJS.Timeout[] = [];
  private busy = new Set<string>();

  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(NotificationService) private readonly notifications: NotificationService,
  ) {}

  onApplicationBootstrap(): void {
    if (!runsRole(this.config, 'worker') || this.config.NODE_ENV === 'test') return;
    this.every('events', EVENT_INTERVAL_MS, async () => {
      // Drain bursts quickly instead of one batch per tick.
      while ((await this.notifications.processPendingEvents()) > 0);
    });
    this.every('email', EMAIL_INTERVAL_MS, () => this.notifications.sendDueEmails().then(() => {}));
    this.logger.info('Notification worker running');
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
