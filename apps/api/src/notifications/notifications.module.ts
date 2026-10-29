import { Module } from '@nestjs/common';
import { TrackingModule } from '../tracking/tracking.module.js';
import { Mailer } from './mailer.js';
import { NotificationService } from './notification.service.js';
import { NotificationWorker } from './notification.worker.js';
import { NotificationsController } from './notifications.controller.js';

@Module({
  imports: [TrackingModule],
  controllers: [NotificationsController],
  providers: [Mailer, NotificationService, NotificationWorker],
})
export class NotificationsModule {}
