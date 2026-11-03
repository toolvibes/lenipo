import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { ScimController, ScimGuard, ScimTokensController } from './scim.controller.js';
import { ScimService } from './scim.service.js';

/** SCIM 2.0 provisioning (TL-52, E-141). */
@Module({
  imports: [IdentityModule],
  controllers: [ScimController, ScimTokensController],
  providers: [ScimService, ScimGuard],
})
export class ScimModule {}
