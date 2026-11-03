import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  CLAIM_MINUTES,
  type Claim,
  type ClaimConflict,
  type ClaimNextRequest,
  type ClaimRequest,
  type ClaimResult,
} from '@toolvibes/shared';
import { and, eq, gt, inArray, isNull, ne, type SQL, sql } from 'drizzle-orm';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  agentProfiles,
  issueClaims,
  issueLinks,
  issueLinkTypes,
  issues,
  users,
} from '../db/schema/index.js';
import { requireIssueScope, SearchService } from '../search/search.service.js';
import { AgentRoleService } from '../tracking/agent-roles.service.js';
import { IssueService } from '../tracking/issue.service.js';
import { securityVisible } from '../tracking/issue-security.js';
import { ProjectService } from '../tracking/project.service.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';
import { GuardrailService } from './guardrail.service.js';

const LEASE = sql`now() + make_interval(mins => ${CLAIM_MINUTES})`;
const CONFLICT_TYPE = 'urn:lenipo:problem:claim-conflict';

/** `apps/web/**`, `apps/web/` and `apps/web` all name the folder apps/web. */
export function normalizePath(path: string): string {
  return path
    .trim()
    .replace(/^\.\//, '')
    .replace(/(\/\*\*?)+$/, '')
    .replace(/\/+$/, '');
}

/** Two work paths overlap when one is the other or lies inside it. */
export function pathsOverlap(a: string, b: string): boolean {
  const left = normalizePath(a);
  const right = normalizePath(b);
  if (left === '' || right === '') return true;
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

/**
 * Claims on issues (TL-94, E-146): an atomic lease that makes the claimer the assignee, extended
 * by heartbeats and ended by itself. Work areas (branch, paths) of claims in one project must not
 * overlap unless the claim is forced.
 */
@Injectable()
export class ClaimService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(IssueService) private readonly issues: IssueService,
    @Inject(SearchService) private readonly search: SearchService,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(AgentRoleService) private readonly agentRoles: AgentRoleService,
    @Inject(GuardrailService) private readonly guardrails: GuardrailService,
  ) {}

  async get(principal: Principal, key: string): Promise<ClaimResult> {
    requireIssueScope(principal);
    const issue = await this.issues.get(principal, key);
    const [claim] = await this.select(eq(issueClaims.issueId, issue.id));
    return { claim: claim ?? null };
  }

  /** The active claims of a project the caller can see. */
  async list(principal: Principal, projectKey: string): Promise<Claim[]> {
    requireIssueScope(principal);
    const project = await this.projects.findBrowsable(principal, projectKey);
    await this.projectAccess.require(principal, project.id, 'browse');
    return this.select(
      and(eq(issueClaims.projectId, project.id), securityVisible(principal.userId)),
    );
  }

  async claim(principal: Principal, key: string, request: ClaimRequest): Promise<Claim> {
    requireIssueScope(principal, true);
    const visible = await this.issues.get(principal, key);
    if (visible.status.category === 'done') {
      throw new ConflictException('The issue is already done');
    }
    await this.database.atomic(async () => {
      const db = this.database.db;
      // The row lock makes two claims on one issue wait for each other.
      const [issue] = await db
        .select({ id: issues.id, projectId: issues.projectId, assigneeId: issues.assigneeId })
        .from(issues)
        .where(eq(issues.id, visible.id))
        .for('update');
      if (!issue) throw new ConflictException('The issue is gone');
      // Agents take work as implementers or testers (TL-96, E-148).
      await this.agentRoles.require(principal, issue.projectId, ['implementer', 'tester']);
      if (issue.assigneeId && issue.assigneeId !== principal.userId) {
        throw new ConflictException('The issue is assigned to someone else');
      }
      const [held] = await db
        .select({ userId: issueClaims.userId, name: users.displayName })
        .from(issueClaims)
        .innerJoin(users, eq(users.id, issueClaims.userId))
        .where(and(eq(issueClaims.issueId, issue.id), gt(issueClaims.expiresAt, sql`now()`)));
      if (held && held.userId !== principal.userId) {
        throw new ConflictException(`${held.name} works on the issue`);
      }
      // New work only while not paused and within budget (TL-98, E-150).
      const renewing = held?.userId === principal.userId;
      if (!renewing) await this.guardrails.requireActive(principal.userId, issue.projectId);
      const branch = request.branch || null;
      const paths = [...new Set(request.paths.map(normalizePath).filter(Boolean))];
      const conflicts = await this.conflicts(
        issue.projectId,
        issue.id,
        principal.userId,
        branch,
        paths,
      );
      if (conflicts.length > 0 && !request.force) {
        throw new ConflictException({
          type: CONFLICT_TYPE,
          message: 'The work area overlaps with other claims',
          claimConflicts: conflicts,
        });
      }
      const values = {
        projectId: issue.projectId,
        userId: principal.userId,
        branch,
        paths,
        forced: conflicts.length > 0,
        expiresAt: LEASE,
      };
      await db
        .insert(issueClaims)
        .values({ issueId: issue.id, ...values })
        .onConflictDoUpdate({
          target: issueClaims.issueId,
          // A new claimer starts the clock; the same one keeps when it began.
          set: {
            ...values,
            claimedAt: sql`case when ${issueClaims.userId} = ${principal.userId} and ${issueClaims.expiresAt} > now() then ${issueClaims.claimedAt} else now() end`,
          },
        });
      if (!issue.assigneeId) {
        await this.issues.update(principal, key, { assigneeId: principal.userId });
      }
      if (!renewing) await this.guardrails.countClaim(principal.userId);
    });
    const [claim] = await this.select(eq(issueClaims.issueId, visible.id));
    if (!claim) throw new Error('Claim missing after insert');
    return claim;
  }

  /** Ends a claim: one's own, or any as project administrator. The assignee stays. */
  async release(principal: Principal, key: string): Promise<void> {
    requireIssueScope(principal, true);
    const issue = await this.issues.get(principal, key);
    const [claim] = await this.database.db
      .select({ userId: issueClaims.userId, projectId: issueClaims.projectId })
      .from(issueClaims)
      .where(eq(issueClaims.issueId, issue.id));
    if (!claim) return;
    if (
      claim.userId !== principal.userId &&
      !(await this.projectAccess.permissions(principal.userId, claim.projectId)).has('administer')
    ) {
      throw new ForbiddenException('Only the claimer or a project administrator');
    }
    await this.database.db.delete(issueClaims).where(eq(issueClaims.issueId, issue.id));
  }

  /** Heartbeats keep one's claims on unresolved issues alive. */
  async extend(userId: string): Promise<void> {
    await this.database.db
      .update(issueClaims)
      .set({ expiresAt: LEASE })
      .where(
        and(
          eq(issueClaims.userId, userId),
          gt(issueClaims.expiresAt, sql`now()`),
          inArray(
            issueClaims.issueId,
            this.database.db
              .select({ id: issues.id })
              .from(issues)
              .where(and(eq(issues.id, issueClaims.issueId), isNull(issues.resolutionId))),
          ),
        ),
      );
  }

  /**
   * Claims the next fitting issue of a project: one's own open claim first, then the active
   * sprints and then the rest, each in rank order; only unassigned or own issues that are not
   * claimed by others and not blocked by an open issue, within the agent's task filter.
   */
  async claimNext(
    principal: Principal,
    projectKey: string,
    request: ClaimNextRequest,
  ): Promise<ClaimResult> {
    requireIssueScope(principal, true);
    const project = await this.projects.findBrowsable(principal, projectKey);
    await this.projectAccess.require(principal, project.id, 'browse');
    const db = this.database.db;
    const [own] = await db
      .select({ key: issues.key })
      .from(issueClaims)
      .innerJoin(issues, eq(issues.id, issueClaims.issueId))
      .where(
        and(
          eq(issueClaims.projectId, project.id),
          eq(issueClaims.userId, principal.userId),
          gt(issueClaims.expiresAt, sql`now()`),
          isNull(issues.resolutionId),
          isNull(issues.deletedAt),
        ),
      )
      .orderBy(issueClaims.claimedAt)
      .limit(1);
    if (own) return { claim: await this.claim(principal, own.key, request) };
    await this.guardrails.requireActive(principal.userId, project.id);

    const [profile] = await db
      .select({ filter: agentProfiles.taskFilter })
      .from(agentProfiles)
      .where(eq(agentProfiles.userId, principal.userId));
    const conditions = [
      `project = "${project.key}"`,
      'statusCategory != done',
      ...[profile?.filter, request.filter].filter((filter) => filter?.trim()).map((f) => `(${f})`),
    ].join(' AND ');
    const taken = new Set(
      (
        await db
          .select({ issueId: issueClaims.issueId })
          .from(issueClaims)
          .where(
            and(
              eq(issueClaims.projectId, project.id),
              ne(issueClaims.userId, principal.userId),
              gt(issueClaims.expiresAt, sql`now()`),
            ),
          )
      ).map((row) => row.issueId),
    );
    const tried = new Set<string>();
    for (const query of [
      `${conditions} AND sprint in openSprints() ORDER BY rank`,
      `${conditions} ORDER BY rank`,
    ]) {
      const found = await this.search.search(principal, { query, limit: 100, offset: 0 });
      const candidates = found.issues.filter(
        (issue) =>
          !tried.has(issue.id) &&
          !taken.has(issue.id) &&
          (!issue.assignee || issue.assignee.id === principal.userId),
      );
      const blocked = await this.blocked(candidates.map((issue) => issue.id));
      for (const issue of candidates) {
        tried.add(issue.id);
        if (blocked.has(issue.id)) continue;
        try {
          return { claim: await this.claim(principal, issue.key, request) };
        } catch (error) {
          // Overlapping work areas hold for every candidate; a lost race only for this one.
          if (error instanceof ConflictException && !isAreaConflict(error)) continue;
          throw error;
        }
      }
    }
    return { claim: null };
  }

  /** Issues blocked by an issue that is not resolved. */
  private async blocked(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await this.database.db
      .select({ id: issueLinks.targetId })
      .from(issueLinks)
      .innerJoin(issueLinkTypes, eq(issueLinkTypes.id, issueLinks.typeId))
      .innerJoin(issues, eq(issues.id, issueLinks.sourceId))
      .where(
        and(
          eq(issueLinkTypes.key, 'blocks'),
          inArray(issueLinks.targetId, ids),
          isNull(issues.resolutionId),
          isNull(issues.deletedAt),
        ),
      );
    return new Set(rows.map((row) => row.id));
  }

  /** Active claims of others in the project whose branch or paths overlap. */
  private async conflicts(
    projectId: string,
    issueId: string,
    userId: string,
    branch: string | null,
    paths: string[],
  ): Promise<ClaimConflict[]> {
    if (!branch && paths.length === 0) return [];
    const others = await this.database.db
      .select({
        key: issues.key,
        userId: issueClaims.userId,
        name: users.displayName,
        branch: issueClaims.branch,
        paths: issueClaims.paths,
      })
      .from(issueClaims)
      .innerJoin(issues, eq(issues.id, issueClaims.issueId))
      .innerJoin(users, eq(users.id, issueClaims.userId))
      .where(
        and(
          eq(issueClaims.projectId, projectId),
          ne(issueClaims.issueId, issueId),
          ne(issueClaims.userId, userId),
          gt(issueClaims.expiresAt, sql`now()`),
        ),
      );
    return others.flatMap((other) => {
      const overlapping = other.paths.filter((path) =>
        paths.some((mine) => pathsOverlap(mine, path)),
      );
      const sameBranch = branch !== null && other.branch === branch;
      if (!sameBranch && overlapping.length === 0) return [];
      return [
        {
          issueKey: other.key,
          user: { id: other.userId, displayName: other.name },
          branch: other.branch,
          paths: overlapping,
        },
      ];
    });
  }

  private async select(where: SQL | undefined): Promise<Claim[]> {
    const rows = await this.database.db
      .select({
        key: issues.key,
        summary: issues.summary,
        userId: issueClaims.userId,
        name: users.displayName,
        branch: issueClaims.branch,
        paths: issueClaims.paths,
        forced: issueClaims.forced,
        claimedAt: issueClaims.claimedAt,
        expiresAt: issueClaims.expiresAt,
      })
      .from(issueClaims)
      .innerJoin(issues, eq(issues.id, issueClaims.issueId))
      .innerJoin(users, eq(users.id, issueClaims.userId))
      .where(
        and(
          where,
          gt(issueClaims.expiresAt, sql`now()`),
          isNull(issues.deletedAt),
          // A resolved issue needs no claim any more.
          isNull(issues.resolutionId),
        ),
      )
      .orderBy(issueClaims.claimedAt);
    return rows.map((row) => ({
      issue: { key: row.key, summary: row.summary },
      user: { id: row.userId, displayName: row.name },
      branch: row.branch,
      paths: row.paths,
      forced: row.forced,
      claimedAt: row.claimedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    }));
  }
}

function isAreaConflict(error: ConflictException): boolean {
  const body = error.getResponse();
  return typeof body === 'object' && body !== null && 'type' in body && body.type === CONFLICT_TYPE;
}
