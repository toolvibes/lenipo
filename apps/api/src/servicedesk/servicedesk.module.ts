import { Module } from '@nestjs/common';
import { TrackingModule } from '../tracking/tracking.module.js';
import { PortalController, ServiceDeskController } from './servicedesk.controller.js';
import { ServiceDeskService } from './servicedesk.service.js';

/** Service desk with customer portal (TL-47, E-137). */
@Module({
  imports: [TrackingModule],
  controllers: [ServiceDeskController, PortalController],
  providers: [ServiceDeskService],
  exports: [ServiceDeskService],
})
export class ServiceDeskModule {}
