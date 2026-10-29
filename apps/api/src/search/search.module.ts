import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { FilterService } from './filter.service.js';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

@Module({
  imports: [IdentityModule, TrackingModule],
  controllers: [SearchController],
  providers: [SearchService, FilterService],
  exports: [FilterService],
})
export class SearchModule {}
