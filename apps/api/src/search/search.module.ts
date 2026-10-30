import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { WikiModule } from '../wiki/wiki.module.js';
import { EverythingService } from './everything.service.js';
import { FilterService } from './filter.service.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [IdentityModule, TrackingModule, WikiModule],
  controllers: [SearchController],
  providers: [SearchService, FilterService, EverythingService],
  exports: [FilterService, SearchService, EverythingService],
})
export class SearchModule {}
