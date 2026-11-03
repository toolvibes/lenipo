import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { AppsAdminController, AppsController } from './apps.controller.js';
import { AppsService } from './apps.service.js';

/** Apps in iframes (TL-50, E-140). */
@Module({
  imports: [IdentityModule],
  controllers: [AppsAdminController, AppsController],
  providers: [AppsService],
  exports: [AppsService],
})
export class AppsModule {}
