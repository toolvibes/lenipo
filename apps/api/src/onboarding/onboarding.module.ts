import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { WikiModule } from '../wiki/wiki.module.js';
import { OnboardingController } from './onboarding.controller.js';
import { OnboardingService } from './onboarding.service.js';

/** The welcome steps after the first sign-in (E-71). */
@Module({
  imports: [IdentityModule, TrackingModule, BoardsModule, WikiModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
