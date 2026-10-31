import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { SearchModule } from '../search/search.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { WikiModule } from '../wiki/wiki.module.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardsController } from './dashboards.controller.js';
import { StatisticsService } from './statistics.service.js';

@Module({
  imports: [IdentityModule, TrackingModule, SearchModule, WikiModule, BoardsModule],
  controllers: [DashboardsController],
  providers: [DashboardService, StatisticsService],
  exports: [DashboardService, StatisticsService],
})
export class DashboardsModule {}
