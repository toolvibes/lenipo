import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { SearchModule } from '../search/search.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { ClaimService } from './claim.service.js';
import { ClaimsController, HandoverController, ReviewsController } from './claims.controller.js';
import { HandoverService } from './handover.service.js';
import { PresenceController } from './presence.controller.js';
import { PresenceService } from './presence.service.js';
import { ReviewService } from './review.service.js';

/** Heartbeats, the team of a project and claims on issues (TL-93, TL-94). */
@Module({
  imports: [TrackingModule, SearchModule, NotificationsModule],
  controllers: [PresenceController, ClaimsController, HandoverController, ReviewsController],
  providers: [PresenceService, ClaimService, HandoverService, ReviewService],
  exports: [PresenceService, ClaimService, HandoverService, ReviewService],
})
export class PresenceModule {}
