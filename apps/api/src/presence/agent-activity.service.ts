import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  type AgentActivity,
  type AgentActivityPage,
  type AgentActivityQuery,
  type AgentOverview,
  type AgentRights,
  type AgentRole,
  HEARTBEAT_MINUTES,
  type PresenceState,
  type ProjectPermission,
} from '@toolvibes/shared';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { AccessService } from '../access/access.service.js';
import type { Principal } from '../core/http/principal.js';
import type { Logger } from '../core/logger.js';
import { DATABASE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  agentRequests,
  groupMembers,
  groups,
  issues,
  personalAccessTokens,
  presence,
  projects,
} from '../db/schema/index.js';
import { AgentService } from '../identity/agent.service.js';
import { AgentRoleService } from '../tracking/agent-roles.service.js';
import { IssueService } from '../tracking/issue.service.js';
import { securityVisible } from '../tracking/issue-security.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';
import { GuardrailService } from './guardrail.service.js';

const ISSUE_KEY = /\/issues\/([A-Za-z][A-Za-z0-9_]*-\d+)(?:\/|$|\?)/;
const WEEK = sql`now() - interval '7 days'`;

export interface AgentRequestEntry {
  userId: string;
  via: 'rest' | 'mcp';
  method: string;
  path: string;
  status: number;
  durationMs: number;
  issueKey?: string | null;
  problem?: string;
}

interface ActivityRow extends Record<string, unknown> {
  at: Date | string;
  kind: AgentActivity['kind'];
  key: string | null;
  summary: string | null;
  title: string;
  status: number | null;
  ok: boolean;
  detail: string | null;
}

/**
 * The history and dashboard of agents (TL-98, E-150): Lenipo keeps every writing and every
 * rejected request of an agent for 90 days, next to its changes, comments, reviews and approvals.
 */
@Injectable()
export class AgentActivityService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(AgentService) private readonly agents: AgentService,
    @Inject(AgentRoleService) private readonly agentRoles: AgentRoleService,
    @Inject(IssueService) private readonly issues: IssueService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(GuardrailService) private readonly guardrails: GuardrailService,
  ) {}

  /** Writes one request of an agent; never fails the request it describes. */
  async record(entry: AgentRequestEntry): Promise<void> {
    try {
      if (!(await this.access.isAgent(entry.userId))) return;
      const path = entry.path.replace(/^\/api\/v1/, '').slice(0, 300);
      const issueKey = entry.issueKey ?? ISSUE_KEY.exec(path)?.[1] ?? null;
      await this.database.db.insert(agentRequests).values({
        userId: entry.userId,
        via: entry.via,
        method: entry.method.slice(0, 60),
        path,
        status: entry.status,
        durationMs: Math.round(entry.durationMs),
        issueKey: issueKey?.toUpperCase().slice(0, 40) ?? null,
        problem: (entry.problem ?? '').slice(0, 300),
      });
    } catch (error) {
      this.logger.warn({ err: error }, 'Could not record an agent request');
    }
  }

  /** The agent itself, its responsible person and administrators. */
  async requireViewer(principal: Principal, agentId: string): Promise<void> {
    if (principal.userId === agentId) return;
    if (await this.agents.isOwner(agentId, principal.userId)) return;
    if (await this.access.isAdmin(principal)) return;
    throw new ForbiddenException('Only the agent, its responsible person or an administrator');
  }

  async history(
    principal: Principal,
    agentId: string,
    query: z.infer<typeof AgentActivityQuery>,
  ): Promise<AgentActivityPage> {
    await this.requireViewer(principal, agentId);
    await this.agents.get(agentId);
    const before = query.before ?? new Date(Date.now() + 60_000).toISOString();
    const browsable = (
      await this.database.db
        .select({ id: projects.id })
        .from(projects)
        .where(await this.projectAccess.browsableCondition(principal.userId))
    ).map((row) => row.id);
    // Changes and comments only on issues the viewer can see.
    const seen = sql`${issues.deletedAt} is null
      and ${issues.projectId} = any(${sql.param(browsable)}::uuid[])
      and ${securityVisible(principal.userId)}`;
    const failures = query.failures;
    const parts = [
      sql`select r.at, 'request' as kind, r.issue_key as key, null::text as summary,
          case when r.via = 'mcp' then r.method else r.method || ' ' || r.path end as title,
          r.status, r.status < 400 as ok, r.problem as detail
        from agent_requests r
        where r.user_id = ${agentId} and r.at < ${before} ${failures ? sql`and r.status >= 400` : sql``}`,
      sql`select coalesce(v.decided_at, v.created_at), 'review', issues.key, issues.summary,
          case when v.reviewer_id = ${agentId} then 'review.given' else 'review.received' end || '.' || v.status,
          null::int, v.status <> 'changes_requested', left(v.verdict, 300)
        from review_requests v join issues on issues.id = v.issue_id
        where (v.requester_id = ${agentId} or v.reviewer_id = ${agentId})
          and coalesce(v.decided_at, v.created_at) < ${before} and ${seen}
          ${failures ? sql`and v.requester_id = ${agentId} and v.status = 'changes_requested'` : sql``}`,
    ];
    if (!failures) {
      parts.push(
        sql`select g.created_at, 'change', issues.key, issues.summary,
            string_agg(c.field || ': ' || coalesce(c.from_display, '–') || ' → ' || coalesce(c.to_display, '–'), '; ' order by c.id),
            null::int, true, ''
          from issue_change_groups g
          join issues on issues.id = g.issue_id
          join issue_change_items c on c.group_id = g.id
          where g.author_id = ${agentId} and g.created_at < ${before} and ${seen}
          group by g.id, g.created_at, issues.key, issues.summary`,
        sql`select m.created_at, 'comment', issues.key, issues.summary, 'comment.' || m.kind,
            null::int, true, left(m.body_text, 300)
          from issue_comments m join issues on issues.id = m.issue_id
          where m.author_id = ${agentId} and m.deleted_at is null and m.created_at < ${before}
            and ${seen}`,
        sql`select coalesce(a.decided_at, a.created_at), 'approval', issues.key, issues.summary,
            'approval.transition.' || a.status, null::int, a.status <> 'rejected', a.reason
          from issue_approvals a join issues on issues.id = a.issue_id
          where a.requested_by_id = ${agentId} and coalesce(a.decided_at, a.created_at) < ${before}
            and ${seen}`,
        sql`select coalesce(a.decided_at, a.created_at), 'approval', null, s.name,
            'approval.' || a.action || '.' || a.status, null::int, a.status <> 'rejected', a.reason
          from sprint_approvals a join sprints s on s.id = a.sprint_id
          where a.requested_by_id = ${agentId} and coalesce(a.decided_at, a.created_at) < ${before}
            and a.project_id = any(${sql.param(browsable)}::uuid[])`,
      );
    }
    const rows = [
      ...(await this.database.db.execute<ActivityRow>(sql`
        select * from (${sql.join(parts, sql` union all `)}) x(at, kind, key, summary, title, status, ok, detail)
        order by at desc limit ${query.limit + 1}`)),
    ];
    const page = rows.slice(0, query.limit);
    const entries = page.map(
      (row): AgentActivity => ({
        at: new Date(row.at).toISOString(),
        kind: row.kind,
        issue: row.key ? { key: row.key, summary: row.summary ?? '' } : null,
        title:
          row.kind === 'approval' && !row.key ? `${row.title}:${row.summary ?? ''}` : row.title,
        status: row.status === null ? null : Number(row.status),
        ok: row.ok,
        detail: row.detail ?? '',
      }),
    );
    return {
      entries,
      next: rows.length > query.limit ? (entries.at(-1)?.at ?? null) : null,
    };
  }

  /** Every agent with what it works on, its budget, throughput and failures of the last week. */
  async overview(principal: Principal): Promise<AgentOverview[]> {
    const list = await this.agents.list();
    const result: AgentOverview[] = [];
    for (const agent of list) {
      const [beat] = await this.database.db
        .select({
          state: presence.state,
          branch: presence.branch,
          note: presence.note,
          updatedAt: presence.updatedAt,
          key: issues.key,
          summary: issues.summary,
        })
        .from(presence)
        .leftJoin(issues, eq(issues.id, presence.issueId))
        .where(eq(presence.userId, agent.id));
      const fresh = beat && Date.now() - beat.updatedAt.getTime() < HEARTBEAT_MINUTES * 60_000;
      const state: PresenceState = fresh ? (beat.state as PresenceState) : 'offline';
      // A stale heartbeat says nothing about the work any more.
      const issue =
        fresh && beat.key ? await this.visible(principal, beat.key, beat.summary) : null;
      const [counts] = [
        ...(await this.database.db.execute<{ throughput: number; failures: number }>(sql`
          select
            (select count(*)::int from issues i where i.assignee_id = ${agent.id}
              and i.resolved_at > ${WEEK} and i.deleted_at is null) as throughput,
            (select count(*)::int from agent_requests r where r.user_id = ${agent.id}
              and r.at > ${WEEK} and r.status >= 400)
            + (select count(*)::int from review_requests v where v.requester_id = ${agent.id}
              and v.status = 'changes_requested' and v.decided_at > ${WEEK}) as failures`)),
      ];
      result.push({
        agent,
        presence: {
          state,
          issue,
          branch: fresh ? beat.branch : null,
          note: fresh ? beat.note : '',
          heartbeatAt: beat?.updatedAt.toISOString() ?? null,
        },
        usage: await this.guardrails.usage(agent.id),
        throughput: counts?.throughput ?? 0,
        failures: counts?.failures ?? 0,
        question:
          fresh && (state === 'waiting' || state === 'blocked')
            ? { state, issue, note: beat.note, since: beat.updatedAt.toISOString() }
            : null,
      });
    }
    return result;
  }

  /** Groups, projects with their permissions and agent roles, and live tokens. */
  async rights(principal: Principal, agentId: string): Promise<AgentRights> {
    await this.requireViewer(principal, agentId);
    await this.agents.get(agentId);
    const db = this.database.db;
    const memberOf = await db
      .select({ name: groups.name })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(eq(groupMembers.userId, agentId))
      .orderBy(groups.name);
    const all = await db
      .select({
        id: projects.id,
        key: projects.key,
        name: projects.name,
        paused: projects.agentsPausedAt,
      })
      .from(projects)
      .where(isNull(projects.archivedAt))
      .orderBy(projects.key);
    const projectRights: AgentRights['projects'] = [];
    for (const project of all) {
      const granted = await this.projectAccess.granted(agentId, project.id);
      if (!granted.has('browse')) continue;
      projectRights.push({
        key: project.key,
        name: project.name,
        permissions: [...granted].sort() as ProjectPermission[],
        roles: ((await this.agentRoles.rolesOf(project.id, agentId)) ?? []) as AgentRole[],
        paused: project.paused !== null,
      });
    }
    const tokens = await db
      .select({
        name: personalAccessTokens.name,
        scopes: personalAccessTokens.scopes,
        expiresAt: personalAccessTokens.expiresAt,
        lastUsedAt: personalAccessTokens.lastUsedAt,
      })
      .from(personalAccessTokens)
      .where(
        and(
          eq(personalAccessTokens.userId, agentId),
          isNull(personalAccessTokens.revokedAt),
          gt(personalAccessTokens.expiresAt, sql`now()`),
        ),
      )
      .orderBy(personalAccessTokens.createdAt);
    return {
      groups: memberOf.map((row) => row.name),
      projects: projectRights,
      tokens: tokens.map((token) => ({
        name: token.name,
        scopes: token.scopes,
        expiresAt: token.expiresAt.toISOString(),
        lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
      })),
    };
  }

  private async visible(principal: Principal, key: string, summary: string | null) {
    try {
      await this.issues.get(principal, key);
      return { key, summary: summary ?? '' };
    } catch {
      return null;
    }
  }
}
