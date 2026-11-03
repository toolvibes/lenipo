import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { SearchModule } from '../search/search.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { PlanService } from './plan.service.js';
import { PlansController } from './plans.controller.js';

/** Cross-project plans and scenarios (TL-46, E-136). */
@Module({
  imports: [IdentityModule, TrackingModule, SearchModule],
  controllers: [PlansController],
  providers: [PlanService],
})
export class PlanningModule {}
