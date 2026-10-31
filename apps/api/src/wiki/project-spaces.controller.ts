import { Controller, Get, Inject, Param } from '@nestjs/common';
import { SpaceSummary } from '@tasklore/shared';
import { z } from 'zod';
import { CurrentPrincipal } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { RequireModule } from '../operations/operations.guard.js';
import { SpaceService } from './space.service.js';

/** The wiki side of a project: its linked spaces (W-SPC-04, E-60). */
@RequireModule('wiki')
@Controller('projects')
export class ProjectSpacesController {
  constructor(@Inject(SpaceService) private readonly spaces: SpaceService) {}

  @Endpoint({
    tag: 'Spaces',
    summary: 'List the spaces linked with a project',
    description: 'Only spaces the caller can see; a space is linked with at most one project.',
    response: z.array(SpaceSummary),
  })
  @Get(':key/spaces')
  ofProject(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<SpaceSummary[]> {
    return this.spaces.ofProject(principal, key);
  }
}
