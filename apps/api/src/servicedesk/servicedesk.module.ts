import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { MailHandlerController } from './mail-handler.controller.js';
import { MailHandlerService } from './mail-handler.service.js';
import {
  PortalController,
  ServiceDeskController,
  ServiceQueueController,
} from './servicedesk.controller.js';
import { ServiceDeskService } from './servicedesk.service.js';

/** Service desk with customer portal (TL-47, E-137). */
@Module({
  imports: [IdentityModule, TrackingModule],
  controllers: [
    ServiceDeskController,
    ServiceQueueController,
    PortalController,
    MailHandlerController,
  ],
  providers: [ServiceDeskService, MailHandlerService],
  exports: [ServiceDeskService, MailHandlerService],
})
export class ServiceDeskModule {}
