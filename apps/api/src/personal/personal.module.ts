import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module.js';
import { DashboardsModule } from '../dashboards/dashboards.module.js';
import { SearchModule } from '../search/search.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { WikiModule } from '../wiki/wiki.module.js';
import { ActivityService } from './activity.service.js';
import { PersonalController } from './personal.controller.js';
import { PersonalService } from './personal.service.js';

@Module({
  imports: [TrackingModule, SearchModule, WikiModule, BoardsModule, DashboardsModule],
  controllers: [PersonalController],
  providers: [PersonalService, ActivityService],
})
export class PersonalModule {}
