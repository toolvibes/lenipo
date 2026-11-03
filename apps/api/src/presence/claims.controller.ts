import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  BlockerRequest,
  Claim,
  ClaimNextRequest,
  ClaimRequest,
  ClaimResult,
  Comment,
  CreateReviewRequest,
  HandoverRequest,
  ReviewRequest,
  ReviewStatus,
  ReviewVerdictRequest,
} from '@toolvibes/shared';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { ClaimService } from './claim.service.js';
import { HandoverService } from './handover.service.js';
import { ReviewService } from './review.service.js';

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

const ReviewQueueQuery = z.object({ status: ReviewStatus.optional() });
type ReviewQueueQuery = z.infer<typeof ReviewQueueQuery>;

/** Code reviews between agents and people (TL-97, E-149). */
@Controller()
export class ReviewsController {
  constructor(@Inject(ReviewService) private readonly reviews: ReviewService) {}

  @Endpoint({
    tag: 'Agents',
    summary: 'Ask for a review of an issue’s work',
    description:
      'Without `reviewer` Lenipo picks a reviewer agent of the project (role reviewer), never the requester or assignee, another vendor first, then the least busy. The reviewer is notified and finds the pull request in the answer.',
    response: ReviewRequest,
  })
  @Post('issues/:key/reviews')
  @HttpCode(201)
  requestReview(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(CreateReviewRequest) body: CreateReviewRequest,
  ): Promise<ReviewRequest> {
    return this.reviews.request(principal, key, body);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'List the reviews of an issue',
    response: z.array(ReviewRequest),
  })
  @Get('issues/:key/reviews')
  issueReviews(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<ReviewRequest[]> {
    return this.reviews.forIssue(principal, key);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'List the reviews the caller is asked for',
    description: 'Waiting ones by default, oldest first.',
    response: z.array(ReviewRequest),
  })
  @Get('me/reviews')
  myReviews(
    @CurrentPrincipal() principal: Principal,
    @ValidQuery(ReviewQueueQuery) query: ReviewQueueQuery,
  ): Promise<ReviewRequest[]> {
    return this.reviews.queue(principal, query.status);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'Give the verdict of a review',
    description:
      'Writes a review comment on the issue, tells the requester and moves the issue to the status the project set for this verdict, if any. Post in the pull request yourself; Lenipo does not write to the git host.',
    response: ReviewRequest,
  })
  @Post('reviews/:id/verdict')
  @HttpCode(200)
  reviewVerdict(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @ValidBody(ReviewVerdictRequest) body: ReviewVerdictRequest,
  ): Promise<ReviewRequest> {
    return this.reviews.verdict(principal, id, body);
  }

  @Endpoint({ tag: 'Agents', summary: 'Withdraw a waiting review request' })
  @Delete('reviews/:id')
  @HttpCode(204)
  async cancelReview(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.reviews.cancel(principal, id);
  }
}
