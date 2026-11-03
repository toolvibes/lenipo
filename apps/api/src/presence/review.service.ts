import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateReviewRequest,
  ReviewRequest,
  ReviewStatus,
  ReviewVerdictRequest,
} from '@toolvibes/shared';
import { and, desc, eq, inArray, notInArray, or, type SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { v7 as uuidv7 } from 'uuid';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  agentProfiles,
  developmentLinks,
  issues,
  projectAgentRoles,
  projects,
  reviewRequests,
  users,
} from '../db/schema/index.js';
import { NotificationService } from '../notifications/notification.service.js';
import { requireIssueScope } from '../search/search.service.js';
import { AgentRoleService } from '../tracking/agent-roles.service.js';
import { IssueService } from '../tracking/issue.service.js';
import { securityVisible } from '../tracking/issue-security.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const requesters = alias(users, 'requesters');
const reviewers = alias(users, 'reviewers');

/**
 * Code reviews between agents and people (TL-97, E-149): a request names a reviewer (by default
 * a reviewer agent of another vendor), the verdict becomes a review comment and may move the
 * issue as the project wants. Lenipo does not write to the git host; the reviewer does.
 */
@Injectable()
export class ReviewService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(IssueService) private readonly issues: IssueService,
    @Inject(AgentRoleService) private readonly agentRoles: AgentRoleService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(NotificationService) private readonly notifications: NotificationService,
  ) {}

  async request(
    principal: Principal,
    key: string,
    request: CreateReviewRequest,
  ): Promise<ReviewRequest> {
    requireIssueScope(principal, true);
    const visible = await this.issues.get(principal, key);
    const [issue] = await this.database.db
      .select({ id: issues.id, projectId: issues.projectId, assigneeId: issues.assigneeId })
      .from(issues)
      .where(eq(issues.id, visible.id));
    if (!issue) throw new NotFoundException('Issue not found');
    // Four eyes: neither who asks nor who did the work reviews it.
    const authors = [principal.userId, issue.assigneeId].filter((id): id is string => !!id);
    const reviewerId = request.reviewer
      ? await this.person(request.reviewer)
      : await this.pick(issue.projectId, principal.userId, authors);
    if (authors.includes(reviewerId)) {
      throw new BadRequestException('The reviewer must not be who did the work');
    }
    if (!(await this.projectAccess.permissions(reviewerId, issue.projectId)).has('comment')) {
      throw new BadRequestException('The reviewer cannot comment in this project');
    }
    const roles = await this.agentRoles.rolesOf(issue.projectId, reviewerId);
    if (roles && !roles.includes('reviewer')) {
      throw new BadRequestException('This agent has no reviewer role in the project');
    }
    const id = uuidv7();
    await this.database.atomic(async () => {
      const db = this.database.db;
      await db.insert(reviewRequests).values({
        id,
        issueId: issue.id,
        projectId: issue.projectId,
        requesterId: principal.userId,
        reviewerId,
      });
      await this.notifications.notifyReview(
        db,
        [reviewerId],
        issue.id,
        principal.userId,
        'requested',
        '',
      );
    });
    return this.one(id);
  }

  /** The reviewer's answer: a review comment, a notification and the project's status rule. */
  async verdict(
    principal: Principal,
    id: string,
    request: ReviewVerdictRequest,
  ): Promise<ReviewRequest> {
    requireIssueScope(principal, true);
    const [row] = await this.database.db
      .select({
        review: reviewRequests,
        key: issues.key,
        statusId: issues.statusId,
        approvedStatus: projects.reviewApprovedStatusId,
        changesStatus: projects.reviewChangesStatusId,
        locale: users.locale,
      })
      .from(reviewRequests)
      .innerJoin(issues, eq(issues.id, reviewRequests.issueId))
      .innerJoin(projects, eq(projects.id, reviewRequests.projectId))
      .innerJoin(users, eq(users.id, reviewRequests.reviewerId))
      .where(eq(reviewRequests.id, id));
    if (!row) throw new NotFoundException('Review not found');
    if (row.review.reviewerId !== principal.userId) {
      throw new ForbiddenException('Only the reviewer gives the verdict');
    }
    if (row.review.status !== 'requested') throw new ConflictException('Already decided');
    const german = row.locale !== 'en';
    const approved = request.verdict === 'approved';
    const heading = german
      ? approved
        ? 'Review: freigegeben'
        : 'Review: Änderungen nötig'
      : approved
        ? 'Review: approved'
        : 'Review: changes requested';
    await this.issues.addComment(
      principal,
      row.key,
      { body: { markdown: `**${heading}**\n\n${request.body}` } },
      'review',
    );
    await this.database.atomic(async () => {
      const db = this.database.db;
      await db
        .update(reviewRequests)
        .set({ status: request.verdict, verdict: request.body, decidedAt: new Date() })
        .where(eq(reviewRequests.id, id));
      await this.notifications.notifyReview(
        db,
        [row.review.requesterId],
        row.review.issueId,
        principal.userId,
        request.verdict,
        request.body,
      );
    });
    // The project may move the issue on, e.g. back to "In Arbeit" for changes.
    const target = approved ? row.approvedStatus : row.changesStatus;
    if (target && target !== row.statusId) {
      const transition = (await this.issues.transitions(principal, row.key)).find(
        (entry) => entry.to.id === target && entry.requiredFields.length === 0,
      );
      if (transition) {
        await this.issues.transition(principal, row.key, { transitionId: transition.id });
      }
    }
    return this.one(id);
  }

  /** Withdraws a waiting request: who asked, or a project administrator. */
  async cancel(principal: Principal, id: string): Promise<void> {
    requireIssueScope(principal, true);
    const [row] = await this.database.db
      .select()
      .from(reviewRequests)
      .where(eq(reviewRequests.id, id));
    if (!row) throw new NotFoundException('Review not found');
    if (
      row.requesterId !== principal.userId &&
      !(await this.projectAccess.permissions(principal.userId, row.projectId)).has('administer')
    ) {
      throw new ForbiddenException('Only who asked or a project administrator');
    }
    if (row.status !== 'requested') throw new ConflictException('Already decided');
    await this.database.db
      .update(reviewRequests)
      .set({ status: 'cancelled', decidedAt: new Date() })
      .where(eq(reviewRequests.id, id));
  }

  async forIssue(principal: Principal, key: string): Promise<ReviewRequest[]> {
    requireIssueScope(principal);
    const issue = await this.issues.get(principal, key);
    return this.select(eq(reviewRequests.issueId, issue.id));
  }

  /** What the caller is asked to review, oldest first, only on issues they can see. */
  async queue(principal: Principal, status: ReviewStatus = 'requested'): Promise<ReviewRequest[]> {
    requireIssueScope(principal);
    const browsable = this.database.db
      .select({ id: projects.id })
      .from(projects)
      .where(await this.projectAccess.browsableCondition(principal.userId));
    const visible = this.database.db
      .select({ id: issues.id })
      .from(issues)
      .where(and(inArray(issues.projectId, browsable), securityVisible(principal.userId)));
    return (
      await this.select(
        and(
          eq(reviewRequests.reviewerId, principal.userId),
          eq(reviewRequests.status, status),
          inArray(reviewRequests.issueId, visible),
        ),
      )
    ).reverse();
  }

  /**
   * A reviewer agent of the project: another vendor than the requester first, then the one with
   * the fewest waiting reviews.
   */
  private async pick(projectId: string, requesterId: string, authors: string[]): Promise<string> {
    const [own] = await this.database.db
      .select({ vendor: agentProfiles.vendor })
      .from(agentProfiles)
      .where(eq(agentProfiles.userId, requesterId));
    const candidates = await this.database.db
      .select({
        id: users.id,
        name: users.displayName,
        vendor: agentProfiles.vendor,
        waiting: sql<number>`(select count(*)::int from ${reviewRequests}
          where ${reviewRequests.reviewerId} = ${users.id} and ${reviewRequests.status} = 'requested')`,
      })
      .from(projectAgentRoles)
      .innerJoin(users, eq(users.id, projectAgentRoles.userId))
      .innerJoin(agentProfiles, eq(agentProfiles.userId, users.id))
      .where(
        and(
          eq(projectAgentRoles.projectId, projectId),
          sql`'reviewer' = any(${projectAgentRoles.roles})`,
          eq(users.status, 'active'),
          notInArray(users.id, authors),
        ),
      );
    const ranked = candidates.sort(
      (a, b) =>
        Number(a.vendor === own?.vendor) - Number(b.vendor === own?.vendor) ||
        a.waiting - b.waiting ||
        a.name.localeCompare(b.name),
    );
    const [first] = ranked;
    if (!first) throw new ConflictException('No reviewer agent in this project');
    return first.id;
  }

  private async person(value: string): Promise<string> {
    const [row] = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.status, 'active'),
          UUID.test(value)
            ? or(eq(users.id, value), eq(users.email, value.toLowerCase()))
            : eq(users.email, value.toLowerCase()),
        ),
      );
    if (!row) throw new NotFoundException(`Nobody found for "${value}"`);
    return row.id;
  }

  private async one(id: string): Promise<ReviewRequest> {
    const [review] = await this.select(eq(reviewRequests.id, id));
    if (!review) throw new NotFoundException('Review not found');
    return review;
  }

  private async select(where: SQL | undefined): Promise<ReviewRequest[]> {
    const rows = await this.database.db
      .select({
        review: reviewRequests,
        key: issues.key,
        summary: issues.summary,
        requesterName: requesters.displayName,
        reviewerName: reviewers.displayName,
      })
      .from(reviewRequests)
      .innerJoin(issues, eq(issues.id, reviewRequests.issueId))
      .innerJoin(requesters, eq(requesters.id, reviewRequests.requesterId))
      .innerJoin(reviewers, eq(reviewers.id, reviewRequests.reviewerId))
      .where(where)
      .orderBy(desc(reviewRequests.createdAt));
    const issueIds = [...new Set(rows.map((row) => row.review.issueId))];
    const pulls =
      issueIds.length > 0
        ? await this.database.db
            .select()
            .from(developmentLinks)
            .where(
              and(
                inArray(developmentLinks.issueId, issueIds),
                eq(developmentLinks.kind, 'pull_request'),
              ),
            )
            .orderBy(desc(developmentLinks.updatedAt))
        : [];
    return rows.map(({ review, ...row }) => {
      const pull = pulls.find((link) => link.issueId === review.issueId);
      return {
        id: review.id,
        issue: { key: row.key, summary: row.summary },
        requester: { id: review.requesterId, displayName: row.requesterName },
        reviewer: { id: review.reviewerId, displayName: row.reviewerName },
        status: review.status as ReviewStatus,
        verdict: review.verdict,
        pullRequest: pull
          ? {
              title: pull.title,
              url: pull.url,
              state: pull.state,
              review: typeof pull.data.review === 'string' ? pull.data.review : null,
            }
          : null,
        createdAt: review.createdAt.toISOString(),
        decidedAt: review.decidedAt?.toISOString() ?? null,
      };
    });
  }
}
