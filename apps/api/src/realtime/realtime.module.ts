import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { RealtimeService } from './realtime.service.js';

@Module({
  imports: [IdentityModule, TrackingModule, BoardsModule],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
