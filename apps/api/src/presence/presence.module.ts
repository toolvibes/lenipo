import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { SearchModule } from '../search/search.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { AgentActivityService } from './agent-activity.service.js';
import { ClaimService } from './claim.service.js';
import { ClaimsController, HandoverController, ReviewsController } from './claims.controller.js';
import { GuardrailService } from './guardrail.service.js';
import { GuardrailsController } from './guardrails.controller.js';
import { HandoverService } from './handover.service.js';
import { IssueApprovalService } from './issue-approval.service.js';
import { PresenceController } from './presence.controller.js';
import { PresenceService } from './presence.service.js';
import { ReviewService } from './review.service.js';

/** Heartbeats, the team of a project and claims on issues (TL-93, TL-94). */
@Module({
  imports: [IdentityModule, TrackingModule, SearchModule, NotificationsModule, BoardsModule],
  controllers: [
    PresenceController,
    ClaimsController,
    HandoverController,
    ReviewsController,
    GuardrailsController,
  ],
  providers: [
    PresenceService,
    ClaimService,
    HandoverService,
    ReviewService,
    GuardrailService,
    IssueApprovalService,
    AgentActivityService,
  ],
  exports: [
    PresenceService,
    ClaimService,
    HandoverService,
    ReviewService,
    GuardrailService,
    IssueApprovalService,
    AgentActivityService,
  ],
})
export class PresenceModule {}
