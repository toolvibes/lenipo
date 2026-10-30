import { Module } from '@nestjs/common';
import { TrackingModule } from '../tracking/tracking.module.js';
import { WikiModule } from '../wiki/wiki.module.js';
import { Mailer } from './mailer.js';
import { NotificationService } from './notification.service.js';
import { NotificationsController } from './notifications.controller.js';

@Module({
  imports: [TrackingModule, WikiModule],
  controllers: [NotificationsController],
  providers: [Mailer, NotificationService],
  exports: [NotificationService, Mailer],
})
export class NotificationsModule {}
