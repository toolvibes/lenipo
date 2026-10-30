import { Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { OnboardingRequest, OnboardingResult } from '@tasklore/shared';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { OnboardingService } from './onboarding.service.js';

@Controller('me')
export class OnboardingController {
  constructor(@Inject(OnboardingService) private readonly onboarding: OnboardingService) {}

  @Endpoint({
    tag: 'Me',
    summary: 'Finish the welcome steps after the first sign-in',
    description:
      'Saves the profile and, with `start`, creates in one go: Scrum or Kanban → project, board and a linked Lore space with a start page; Lore → only the space. Without `start` the steps count as skipped. Web sessions only.',
    response: OnboardingResult,
  })
  @Post('onboarding')
  @HttpCode(200)
  finish(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(OnboardingRequest) body: OnboardingRequest,
  ): Promise<OnboardingResult> {
    return this.onboarding.finish(principal, body);
  }
}
