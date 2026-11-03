import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { WikiModule } from '../wiki/wiki.module.js';
import { EventsController } from './events.controller.js';
import { RealtimeService } from './realtime.service.js';

@Module({
  imports: [IdentityModule, TrackingModule, BoardsModule, WikiModule, NotificationsModule],
  controllers: [EventsController],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
