import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  DecideApprovalRequest,
  IssueApproval,
  PendingApprovals,
  TransitionRequest,
} from '@toolvibes/shared';
import { and, desc, eq, inArray, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { v7 as uuidv7 } from 'uuid';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SprintApprovalService } from '../boards/sprint-approval.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { issueApprovals, issues, projects, statuses, users } from '../db/schema/index.js';
import { NotificationService } from '../notifications/notification.service.js';
import { requireIssueScope } from '../search/search.service.js';
import { IssueService } from '../tracking/issue.service.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';

const requesters = alias(users, 'requesters');
const deciders = alias(users, 'deciders');

/**
 * Approval points (TL-98, E-150): a project names statuses agents do not set themselves. The
 * agent's transition then waits as a request, and a person approves it (it runs in the agent's
 * name) or rejects it with a reason, like sprint approvals (E-148).
 */
@Injectable()
export class IssueApprovalService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(IssueService) private readonly issues: IssueService,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(NotificationService) private readonly notifications: NotificationService,
    @Inject(SprintApprovalService) private readonly sprintApprovals: SprintApprovalService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** For an agent moving into a kept status: the waiting request; null when it may move. */
  async gate(
    principal: Principal,
    key: string,
    request: TransitionRequest,
  ): Promise<IssueApproval | null> {
    if (!(await this.access.isAgent(principal.userId))) return null;
    requireIssueScope(principal, true);
    const visible = await this.issues.get(principal, key);
    const transition = (await this.issues.transitions(principal, key)).find(
      (entry) => entry.id === request.transitionId,
    );
    if (!transition) return null;
    const [issue] = await this.database.db
      .select({ id: issues.id, projectId: issues.projectId })
      .from(issues)
      .where(eq(issues.id, visible.id));
    if (!issue) throw new NotFoundException('Issue not found');
    if (!(await this.projectAccess.needsApproval(principal, issue.projectId, transition.to.id))) {
      return null;
    }
    await this.projectAccess.require(principal, issue.projectId, 'transition-issues');
    const [waiting] = await this.select(
      and(eq(issueApprovals.issueId, issue.id), eq(issueApprovals.status, 'pending')),
    );
    if (waiting) {
      if (waiting.toStatus.id === transition.to.id) return waiting;
      throw new ConflictException(`A move to ${waiting.toStatus.name} waits for approval`);
    }
    const id = uuidv7();
    await this.database.atomic(async () => {
      const db = this.database.db;
      await db.insert(issueApprovals).values({
        id,
        issueId: issue.id,
        projectId: issue.projectId,
        toStatusId: transition.to.id,
        request,
        requestedById: principal.userId,
      });
      await this.notifications.notifyIssueApproval(
        db,
        await this.approvers(issue.projectId),
        issue.id,
        principal.userId,
        'requested',
        transition.to.name,
      );
    });
    await this.audit.record({
      action: 'issue.transition-requested',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'issue',
      targetId: issue.id,
      details: { approvalId: id, toStatusId: transition.to.id },
    });
    return this.one(id);
  }

  /** A person who may move issues approves (the move runs as the agent) or rejects. */
  async decide(
    principal: Principal,
    id: string,
    request: DecideApprovalRequest,
  ): Promise<IssueApproval> {
    const [row] = await this.database.db
      .select({ approval: issueApprovals, key: issues.key })
      .from(issueApprovals)
      .innerJoin(issues, eq(issues.id, issueApprovals.issueId))
      .where(eq(issueApprovals.id, id));
    if (!row) throw new NotFoundException('Approval not found');
    const { approval } = row;
    await this.projectAccess.require(principal, approval.projectId, 'transition-issues');
    if (await this.access.isAgent(principal.userId)) {
      throw new ForbiddenException('Only people approve the requests of agents');
    }
    if (approval.status !== 'pending') throw new ConflictException('Already decided');
    if (!request.approve && !request.reason) {
      throw new BadRequestException('Say why the move is rejected');
    }
    if (request.approve) {
      // In the agent's name: its rights count, and history shows the agent.
      const agent: Principal = {
        userId: approval.requestedById,
        via: 'token',
        tokenId: `approval:${approval.id}`,
        scopes: ['issues:read', 'issues:write'],
      };
      await this.issues.transition(agent, row.key, approval.request as TransitionRequest);
    }
    const status = request.approve ? 'approved' : 'rejected';
    await this.database.atomic(async () => {
      const db = this.database.db;
      await db
        .update(issueApprovals)
        .set({
          status,
          decidedById: principal.userId,
          decidedAt: new Date(),
          reason: request.approve ? '' : request.reason,
        })
        .where(eq(issueApprovals.id, id));
      await this.notifications.notifyIssueApproval(
        db,
        [approval.requestedById],
        approval.issueId,
        principal.userId,
        status,
        request.approve ? '' : request.reason,
      );
    });
    await this.audit.record({
      action: `issue.transition-${status}`,
      actorId: principal.userId,
      via: principal.via,
      targetType: 'issue',
      targetId: approval.issueId,
      details: { approvalId: id, agentId: approval.requestedById },
    });
    return this.one(id);
  }

  async forIssue(principal: Principal, key: string): Promise<IssueApproval[]> {
    requireIssueScope(principal);
    const issue = await this.issues.get(principal, key);
    return this.select(eq(issueApprovals.issueId, issue.id));
  }

  /** Everything waiting where the caller may decide: sprints and transitions. */
  async pending(principal: Principal): Promise<PendingApprovals> {
    requireIssueScope(principal);
    const browsable = await this.database.db
      .select({ id: projects.id, key: projects.key })
      .from(projects)
      .where(await this.projectAccess.browsableCondition(principal.userId));
    const allowed = { sprints: new Set<string>(), issues: new Set<string>() };
    for (const project of browsable) {
      const granted = await this.projectAccess.permissions(principal.userId, project.id);
      if (granted.has('edit-issues')) allowed.sprints.add(project.key);
      if (granted.has('transition-issues')) allowed.issues.add(project.id);
    }
    const sprints = [];
    for (const key of allowed.sprints) {
      sprints.push(...(await this.sprintApprovals.list(principal, key, 'pending')));
    }
    const waiting =
      allowed.issues.size > 0
        ? await this.select(
            and(
              eq(issueApprovals.status, 'pending'),
              inArray(issueApprovals.projectId, [...allowed.issues]),
            ),
          )
        : [];
    // Hidden issues stay hidden, even with the right to move issues in the project.
    const issueList: IssueApproval[] = [];
    for (const approval of waiting) {
      try {
        await this.issues.get(principal, approval.issue.key);
        issueList.push(approval);
      } catch (error) {
        if (!(error instanceof NotFoundException)) throw error;
      }
    }
    return {
      sprints: sprints.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      issues: issueList.reverse(),
    };
  }

  /** People who may approve: those who may move issues in the project. */
  private async approvers(projectId: string): Promise<string[]> {
    const candidates = await this.projectAccess.browsingUsers(projectId, '', 500);
    if (candidates.length === 0) return [];
    const people = await this.database.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          inArray(
            users.id,
            candidates.map((candidate) => candidate.id),
          ),
          eq(users.kind, 'person'),
        ),
      );
    const allowed: string[] = [];
    for (const { id } of people) {
      if ((await this.projectAccess.permissions(id, projectId)).has('transition-issues')) {
        allowed.push(id);
      }
    }
    return allowed;
  }

  private async one(id: string): Promise<IssueApproval> {
    const [approval] = await this.select(eq(issueApprovals.id, id));
    if (!approval) throw new NotFoundException('Approval not found');
    return approval;
  }

  private async select(where: SQL | undefined): Promise<IssueApproval[]> {
    const rows = await this.database.db
      .select({
        approval: issueApprovals,
        key: issues.key,
        summary: issues.summary,
        projectKey: projects.key,
        statusName: statuses.name,
        requesterName: requesters.displayName,
        deciderName: deciders.displayName,
      })
      .from(issueApprovals)
      .innerJoin(issues, eq(issues.id, issueApprovals.issueId))
      .innerJoin(projects, eq(projects.id, issueApprovals.projectId))
      .innerJoin(statuses, eq(statuses.id, issueApprovals.toStatusId))
      .innerJoin(requesters, eq(requesters.id, issueApprovals.requestedById))
      .leftJoin(deciders, eq(deciders.id, issueApprovals.decidedById))
      .where(where)
      .orderBy(desc(issueApprovals.createdAt));
    return rows.map(({ approval, ...row }) => ({
      id: approval.id,
      issue: { key: row.key, summary: row.summary },
      projectKey: row.projectKey,
      toStatus: { id: approval.toStatusId, name: row.statusName },
      requestedBy: { id: approval.requestedById, displayName: row.requesterName },
      status: approval.status as IssueApproval['status'],
      decidedBy:
        approval.decidedById && row.deciderName !== null
          ? { id: approval.decidedById, displayName: row.deciderName }
          : null,
      reason: approval.reason,
      createdAt: approval.createdAt.toISOString(),
      decidedAt: approval.decidedAt?.toISOString() ?? null,
    }));
  }
}
