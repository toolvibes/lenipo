import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { WikiModule } from '../wiki/wiki.module.js';
import { EverythingService } from './everything.service.js';
import { FilterService } from './filter.service.js';
import { FilterSubscriptionService } from './filter-subscription.service.js';
import { FilterSubscriptionsController } from './filter-subscriptions.controller.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [IdentityModule, TrackingModule, WikiModule, NotificationsModule, AiModule],
  controllers: [SearchController, FilterSubscriptionsController],
  providers: [SearchService, FilterService, EverythingService, FilterSubscriptionService],
  exports: [FilterService, SearchService, EverythingService, FilterSubscriptionService],
})
export class SearchModule {}
