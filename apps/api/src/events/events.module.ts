import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { AutomationModule } from '../automation/automation.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { ImportsModule } from '../imports/imports.module.js';
import { MaintenanceModule } from '../maintenance/maintenance.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ReleasesModule } from '../releases/releases.module.js';
import { SearchModule } from '../search/search.module.js';
import { ServiceDeskModule } from '../servicedesk/servicedesk.module.js';
import { WebhooksModule } from '../webhooks/webhooks.module.js';
import { WikiModule } from '../wiki/wiki.module.js';
import { EventWorker } from './event.worker.js';
import { EventProcessor } from './event-processor.js';

@Module({
  imports: [
    IdentityModule,
    NotificationsModule,
    WebhooksModule,
    AutomationModule,
    ReleasesModule,
    WikiModule,
    SearchModule,
    ImportsModule,
    MaintenanceModule,
    AiModule,
    ServiceDeskModule,
  ],
  providers: [EventProcessor, EventWorker],
})
export class EventsModule {}
