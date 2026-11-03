import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AgentRole,
  CompleteSprintRequest,
  DecideApprovalRequest,
  SprintApproval,
  StartSprintRequest,
} from '@toolvibes/shared';
import { and, desc, eq, inArray, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { v7 as uuidv7 } from 'uuid';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { boards, projects, sprintApprovals, sprints, users } from '../db/schema/index.js';
import { NotificationService } from '../notifications/notification.service.js';
import { AgentRoleService } from '../tracking/agent-roles.service.js';
import { ProjectService } from '../tracking/project.service.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';
import { SprintService } from './sprint.service.js';

type Action = SprintApproval['action'];
const ROLES: Record<Action, AgentRole[]> = {
  start: ['planner'],
  complete: ['coordinator', 'planner'],
};
const deciders = alias(users, 'deciders');

/**
 * Agents start and complete sprints only after a person approved it, where the project wants
 * that (TL-96, E-148). The request waits with its body; approving runs it in the agent's name.
 */
@Injectable()
export class SprintApprovalService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(SprintService) private readonly sprints: SprintService,
    @Inject(AgentRoleService) private readonly agentRoles: AgentRoleService,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(NotificationService) private readonly notifications: NotificationService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /**
   * For an agent in a project that wants approval: the waiting request (a new one, or the one
   * already waiting). Null when the action may run right away.
   */
  async gate(
    principal: Principal,
    sprintId: string,
    action: Action,
    request: StartSprintRequest | CompleteSprintRequest,
  ): Promise<SprintApproval | null> {
    const [row] = await this.database.db
      .select({
        state: sprints.state,
        name: sprints.name,
        projectId: boards.projectId,
        approval: projects.agentSprintApproval,
      })
      .from(sprints)
      .innerJoin(boards, eq(boards.id, sprints.boardId))
      .innerJoin(projects, eq(projects.id, boards.projectId))
      .where(eq(sprints.id, sprintId));
    if (!row?.approval || !(await this.agentRoles.isAgent(principal.userId))) return null;
    await this.projectAccess.require(principal, row.projectId, 'edit-issues');
    await this.agentRoles.require(principal, row.projectId, ROLES[action]);
    if (row.state !== (action === 'start' ? 'future' : 'active')) {
      throw new ConflictException(
        action === 'start' ? 'This sprint is not planned' : 'This sprint is not running',
      );
    }
    const [waiting] = await this.select(
      and(
        eq(sprintApprovals.sprintId, sprintId),
        eq(sprintApprovals.action, action),
        eq(sprintApprovals.status, 'pending'),
      ),
    );
    if (waiting) return waiting;
    const id = uuidv7();
    await this.database.atomic(async () => {
      const db = this.database.db;
      await db.insert(sprintApprovals).values({
        id,
        sprintId,
        projectId: row.projectId,
        action,
        request,
        requestedById: principal.userId,
      });
      await this.notifications.notifySprint(
        db,
        await this.approvers(row.projectId),
        sprintId,
        principal.userId,
        '',
        { field: action, from: null, to: 'requested' },
      );
    });
    await this.audit.record({
      action: `sprint.${action}-requested`,
      actorId: principal.userId,
      via: principal.via,
      targetType: 'sprint',
      targetId: sprintId,
      details: { approvalId: id },
    });
    const [created] = await this.select(eq(sprintApprovals.id, id));
    if (!created) throw new Error('Approval missing after insert');
    return created;
  }

  async list(
    principal: Principal,
    projectKey: string,
    status?: SprintApproval['status'],
  ): Promise<SprintApproval[]> {
    const project = await this.projects.findBrowsable(principal, projectKey);
    await this.projectAccess.require(principal, project.id, 'browse');
    return this.select(
      and(
        eq(sprintApprovals.projectId, project.id),
        status ? eq(sprintApprovals.status, status) : undefined,
      ),
    );
  }

  /** A person with `edit-issues` approves (the action runs as the agent) or rejects. */
  async decide(
    principal: Principal,
    id: string,
    request: DecideApprovalRequest,
  ): Promise<SprintApproval> {
    const [approval] = await this.database.db
      .select()
      .from(sprintApprovals)
      .where(eq(sprintApprovals.id, id));
    if (!approval) throw new NotFoundException('Approval not found');
    await this.projectAccess.require(principal, approval.projectId, 'edit-issues');
    if (await this.agentRoles.isAgent(principal.userId)) {
      throw new ForbiddenException('Only people approve the requests of agents');
    }
    if (approval.status !== 'pending') throw new ConflictException('Already decided');
    if (request.approve) {
      // In the agent's name: its rights count, and history shows the agent.
      const agent: Principal = {
        userId: approval.requestedById,
        via: 'token',
        tokenId: `approval:${approval.id}`,
        scopes: ['issues:read', 'issues:write'],
      };
      if (approval.action === 'start') {
        await this.sprints.start(agent, approval.sprintId, approval.request as StartSprintRequest);
      } else {
        await this.sprints.complete(
          agent,
          approval.sprintId,
          approval.request as CompleteSprintRequest,
        );
      }
    }
    const status = request.approve ? 'approved' : 'rejected';
    await this.database.atomic(async () => {
      const db = this.database.db;
      await db
        .update(sprintApprovals)
        .set({
          status,
          decidedById: principal.userId,
          decidedAt: new Date(),
          reason: request.approve ? '' : request.reason,
        })
        .where(eq(sprintApprovals.id, id));
      await this.notifications.notifySprint(
        db,
        [approval.requestedById],
        approval.sprintId,
        principal.userId,
        request.approve ? '' : request.reason,
        { field: approval.action, from: null, to: status },
      );
    });
    await this.audit.record({
      action: `sprint.${approval.action}-${status}`,
      actorId: principal.userId,
      via: principal.via,
      targetType: 'sprint',
      targetId: approval.sprintId,
      details: { approvalId: id, agentId: approval.requestedById },
    });
    const [decided] = await this.select(eq(sprintApprovals.id, id));
    if (!decided) throw new Error('Approval missing');
    return decided;
  }

  /** People who may approve: those with `edit-issues` in the project. */
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
      if ((await this.projectAccess.permissions(id, projectId)).has('edit-issues')) {
        allowed.push(id);
      }
    }
    return allowed;
  }

  private async select(where: SQL | undefined): Promise<SprintApproval[]> {
    const rows = await this.database.db
      .select({
        approval: sprintApprovals,
        sprintName: sprints.name,
        boardId: sprints.boardId,
        projectKey: projects.key,
        requesterName: users.displayName,
        deciderName: deciders.displayName,
      })
      .from(sprintApprovals)
      .innerJoin(sprints, eq(sprints.id, sprintApprovals.sprintId))
      .innerJoin(projects, eq(projects.id, sprintApprovals.projectId))
      .innerJoin(users, eq(users.id, sprintApprovals.requestedById))
      .leftJoin(deciders, eq(deciders.id, sprintApprovals.decidedById))
      .where(where)
      .orderBy(desc(sprintApprovals.createdAt));
    return rows.map(({ approval, ...row }) => ({
      id: approval.id,
      action: approval.action as Action,
      sprint: { id: approval.sprintId, name: row.sprintName, boardId: row.boardId },
      projectKey: row.projectKey,
      requestedBy: { id: approval.requestedById, displayName: row.requesterName },
      status: approval.status as SprintApproval['status'],
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
