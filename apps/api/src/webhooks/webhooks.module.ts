import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { WebhookService } from './webhook.service.js';
import { WebhooksController } from './webhooks.controller.js';

@Module({
  imports: [IdentityModule, TrackingModule],
  controllers: [WebhooksController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhooksModule {}
