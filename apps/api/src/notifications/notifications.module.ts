import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { WikiModule } from '../wiki/wiki.module.js';
import { Mailer } from './mailer.js';
import { NotificationService } from './notification.service.js';
import { NotificationSchemeService } from './notification-scheme.service.js';
import { NotificationSchemesController } from './notification-schemes.controller.js';
import { NotificationsController } from './notifications.controller.js';

@Module({
  imports: [IdentityModule, TrackingModule, WikiModule],
  controllers: [NotificationsController, NotificationSchemesController],
  providers: [Mailer, NotificationService, NotificationSchemeService],
  exports: [NotificationService, Mailer],
})
export class NotificationsModule {}
