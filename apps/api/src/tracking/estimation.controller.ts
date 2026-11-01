import { Controller, Delete, Get, HttpCode, Inject, Param, Post, Put } from '@nestjs/common';
import { EstimateVoteRequest, Estimation, EstimationState } from '@toolvibes/shared';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { EstimationService } from './estimation.service.js';

/** Planning poker on an issue (TL-51, E-134). */
@Controller('issues/:key/estimation')
export class EstimationController {
  constructor(@Inject(EstimationService) private readonly estimation: EstimationService) {}

  @Endpoint({
    tag: 'Issues',
    summary: 'The open planning poker round, if any',
    response: EstimationState,
  })
  @Get()
  async getEstimation(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<EstimationState> {
    return { round: await this.estimation.get(principal, key) };
  }

  @Endpoint({
    tag: 'Issues',
    summary: 'Start a planning poker round (a fresh one if open)',
    description: 'Requires the project permission `edit-issues`.',
    response: Estimation,
  })
  @Post()
  @HttpCode(200)
  startEstimation(@CurrentPrincipal() principal: Principal, @Param('key') key: string) {
    return this.estimation.start(principal, key);
  }

  @Endpoint({ tag: 'Issues', summary: 'Lay or change your card', response: Estimation })
  @Put('vote')
  voteEstimate(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(EstimateVoteRequest) body: EstimateVoteRequest,
  ) {
    return this.estimation.vote(principal, key, body.value);
  }

  @Endpoint({
    tag: 'Issues',
    summary: 'Turn all cards over',
    description: 'Requires the project permission `edit-issues`.',
    response: Estimation,
  })
  @Post('reveal')
  @HttpCode(200)
  revealEstimation(@CurrentPrincipal() principal: Principal, @Param('key') key: string) {
    return this.estimation.reveal(principal, key);
  }

  @Endpoint({ tag: 'Issues', summary: 'End the round', description: 'Requires `edit-issues`.' })
  @Delete()
  @HttpCode(204)
  endEstimation(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<void> {
    return this.estimation.end(principal, key);
  }
}
