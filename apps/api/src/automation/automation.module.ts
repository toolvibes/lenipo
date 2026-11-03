import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { SearchModule } from '../search/search.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { WikiModule } from '../wiki/wiki.module.js';
import { AutomationController } from './automation.controller.js';
import { AutomationEngine } from './automation.engine.js';
import { AutomationService } from './automation.service.js';

@Module({
  imports: [
    IdentityModule,
    TrackingModule,
    SearchModule,
    WikiModule,
    NotificationsModule,
    AiModule,
  ],
  controllers: [AutomationController],
  providers: [AutomationService, AutomationEngine],
  exports: [AutomationEngine],
})
export class AutomationModule {}
