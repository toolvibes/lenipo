import { Module } from '@nestjs/common';
import { SearchModule } from '../search/search.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { ClaimService } from './claim.service.js';
import { ClaimsController } from './claims.controller.js';
import { PresenceController } from './presence.controller.js';
import { PresenceService } from './presence.service.js';

/** Heartbeats, the team of a project and claims on issues (TL-93, TL-94). */
@Module({
  imports: [TrackingModule, SearchModule],
  controllers: [PresenceController, ClaimsController],
  providers: [PresenceService, ClaimService],
  exports: [PresenceService, ClaimService],
})
export class PresenceModule {}
