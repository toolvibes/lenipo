import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { WikiModule } from '../wiki/wiki.module.js';
import { RealtimeService } from './realtime.service.js';

@Module({
  imports: [IdentityModule, TrackingModule, BoardsModule, WikiModule],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
