import { Module } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { WebhooksModule } from '../webhooks/webhooks.module.js';
import { EventWorker } from './event.worker.js';
import { EventProcessor } from './event-processor.js';

@Module({
  imports: [NotificationsModule, WebhooksModule, AutomationModule],
  providers: [EventProcessor, EventWorker],
})
export class EventsModule {}
