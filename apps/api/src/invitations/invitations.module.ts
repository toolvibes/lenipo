import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { InvitationService } from './invitation.service.js';
import { InvitationsController } from './invitations.controller.js';

@Module({
  imports: [IdentityModule, TrackingModule, NotificationsModule],
  controllers: [InvitationsController],
  providers: [InvitationService],
})
export class InvitationsModule {}
