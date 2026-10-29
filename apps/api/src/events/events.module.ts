import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { WebhooksModule } from '../webhooks/webhooks.module.js';
import { EventWorker } from './event.worker.js';
import { EventProcessor } from './event-processor.js';

@Module({
  imports: [NotificationsModule, WebhooksModule],
  providers: [EventProcessor, EventWorker],
})
export class EventsModule {}
