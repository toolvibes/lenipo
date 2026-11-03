import { Module } from '@nestjs/common';
import { TrackingModule } from '../tracking/tracking.module.js';
import { PresenceController } from './presence.controller.js';
import { PresenceService } from './presence.service.js';

/** Heartbeats of agents and the team of a project (TL-93, E-145). */
@Module({
  imports: [TrackingModule],
  controllers: [PresenceController],
  providers: [PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
