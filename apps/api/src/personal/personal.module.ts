import { Module } from '@nestjs/common';
import { SearchModule } from '../search/search.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { WikiModule } from '../wiki/wiki.module.js';
import { ActivityService } from './activity.service.js';
import { PersonalController } from './personal.controller.js';
import { PersonalService } from './personal.service.js';

@Module({
  imports: [TrackingModule, SearchModule, WikiModule],
  controllers: [PersonalController],
  providers: [PersonalService, ActivityService],
})
export class PersonalModule {}
