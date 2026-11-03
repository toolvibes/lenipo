import { Controller, Delete, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import {
  BlockerRequest,
  Claim,
  ClaimNextRequest,
  ClaimRequest,
  ClaimResult,
  Comment,
  HandoverRequest,
} from '@toolvibes/shared';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { ClaimService } from './claim.service.js';
import { HandoverService } from './handover.service.js';

/** Claims on issues so agents do not collide (TL-94, E-146). */
@Controller()
export class ClaimsController {
  constructor(@Inject(ClaimService) private readonly claims: ClaimService) {}

  @Endpoint({
    tag: 'Agents',
    summary: 'Get the active claim on an issue',
    response: ClaimResult,
  })
  @Get('issues/:key/claim')
  getClaim(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<ClaimResult> {
    return this.claims.get(principal, key);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'Claim an issue',
    description:
      'Atomic: makes the caller the assignee of an unassigned issue and holds it for 30 minutes; every heartbeat (`PUT /me/presence`) extends the claims. 409 when someone else is assigned or works on it, and with `claimConflicts` when branch or paths overlap with other claims in the project, unless `force` is set. Claiming again renews and changes the work area.',
    response: Claim,
  })
  @Post('issues/:key/claim')
  @HttpCode(200)
  claimIssue(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(ClaimRequest) body: ClaimRequest,
  ): Promise<Claim> {
    return this.claims.claim(principal, key, body);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'Release a claim',
    description: 'One’s own, or any as project administrator. The assignee stays.',
  })
  @Delete('issues/:key/claim')
  @HttpCode(204)
  async releaseClaim(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<void> {
    await this.claims.release(principal, key);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'List the active claims of a project',
    response: z.array(Claim),
  })
  @Get('projects/:key/claims')
  listClaims(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<Claim[]> {
    return this.claims.list(principal, key);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'Claim the next fitting issue of a project',
    description:
      'One’s own open claim first; otherwise unresolved issues of active and planned sprints, then of the whole project, in rank order, that are unassigned or one’s own, not claimed by others, not blocked by an unresolved issue and within the agent’s task filter and the optional `filter`. `claim` is null when nothing fits.',
    response: ClaimResult,
  })
  @Post('projects/:key/claim-next')
  @HttpCode(200)
  claimNext(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(ClaimNextRequest) body: ClaimNextRequest,
  ): Promise<ClaimResult> {
    return this.claims.claimNext(principal, key, body);
  }
}

/** Handovers and blockers between people and agents (TL-95, E-147). */
@Controller('issues/:key')
export class HandoverController {
  constructor(@Inject(HandoverService) private readonly handovers: HandoverService) {}

  @Endpoint({
    tag: 'Agents',
    summary: 'Hand an issue over',
    description:
      'Writes one comment marked as handover with what is done, what is open and notes. With `to` (id or e-mail) that person or agent becomes assignee, is mentioned and takes over the caller’s claim with its work area; without, the caller’s claim ends.',
    response: Comment,
  })
  @Post('handover')
  @HttpCode(201)
  handover(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(HandoverRequest) body: HandoverRequest,
  ): Promise<Comment> {
    return this.handovers.handover(principal, key, body);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'Report a blocker',
    description:
      'Links `blockedBy` as blocking issue, writes the note as comment and sets the caller’s heartbeat to blocked on this issue.',
    response: Comment,
  })
  @Post('blocker')
  @HttpCode(201)
  blocker(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(BlockerRequest) body: BlockerRequest,
  ): Promise<Comment> {
    return this.handovers.blocker(principal, key, body);
  }
}
