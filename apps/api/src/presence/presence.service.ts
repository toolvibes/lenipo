import { Inject, Injectable } from '@nestjs/common';
import {
  AUTOMATION_ACTOR_ID,
  HEARTBEAT_MINUTES,
  ONLINE_MINUTES,
  type Presence,
  type PresenceState,
  type TeamMember,
  type UpdatePresenceRequest,
} from '@toolvibes/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { issues, presence } from '../db/schema/index.js';
import { requireIssueScope } from '../search/search.service.js';
import { IssueService } from '../tracking/issue.service.js';
import { securityVisible } from '../tracking/issue-security.js';
import { ProjectService } from '../tracking/project.service.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';
import { ClaimService } from './claim.service.js';
import { GuardrailService } from './guardrail.service.js';

/** How far back changes in a project make someone part of its team. */
const TEAM_DAYS = 30;

interface TeamRow extends Record<string, unknown> {
  id: string;
  display_name: string;
  kind: string;
  issue_id: string | null;
  state: string | null;
  heartbeat_at: Date | string | null;
  branch: string | null;
  note: string | null;
  issue_key: string | null;
  issue_summary: string | null;
  changed_at: Date | string | null;
  seen_at: Date | string | null;
  open_issues: number;
}

const iso = (value: Date | string | null) => (value ? new Date(value).toISOString() : null);

/**
 * Who is working and on what (TL-93, E-145): heartbeats from agents (and people who send them),
 * and per project the people and agents active there.
 */
@Injectable()
export class PresenceService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(IssueService) private readonly issues: IssueService,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(ClaimService) private readonly claims: ClaimService,
    @Inject(GuardrailService) private readonly guardrails: GuardrailService,
  ) {}

  /** A heartbeat: the state, and the issue and branch if given; an issue must be visible. */
  async beat(principal: Principal, request: UpdatePresenceRequest): Promise<Presence> {
    requireIssueScope(principal);
    const issueId =
      request.issueKey === undefined
        ? undefined
        : request.issueKey === null
          ? null
          : (await this.issues.get(principal, request.issueKey)).id;
    const changes = {
      state: request.state,
      ...(issueId !== undefined ? { issueId } : {}),
      ...(request.branch !== undefined ? { branch: request.branch || null } : {}),
      ...(request.note !== undefined ? { note: request.note } : {}),
      updatedAt: new Date(),
    };
    const [previous] = await this.database.db
      .select({ updatedAt: presence.updatedAt })
      .from(presence)
      .where(eq(presence.userId, principal.userId));
    // Claimed time counts toward the budget (TL-98, E-150).
    await this.guardrails.heartbeat(principal.userId, previous?.updatedAt ?? null);
    await this.database.db
      .insert(presence)
      .values({ userId: principal.userId, ...changes })
      .onConflictDoUpdate({ target: presence.userId, set: changes });
    // A heartbeat also keeps the claims of a working agent (TL-94).
    if (request.state !== 'offline') await this.claims.extend(principal.userId);
    return this.mine(principal);
  }

  async mine(principal: Principal): Promise<Presence> {
    requireIssueScope(principal);
    const [row] = await this.database.db
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
      .where(eq(presence.userId, principal.userId));
    if (!row) return { state: 'offline', issue: null, branch: null, note: '', heartbeatAt: null };
    const fresh = Date.now() - row.updatedAt.getTime() < HEARTBEAT_MINUTES * 60_000;
    return {
      state: fresh ? (row.state as PresenceState) : 'offline',
      issue: row.key && row.summary !== null ? { key: row.key, summary: row.summary } : null,
      branch: row.branch,
      note: row.note,
      heartbeatAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * The project's team: who changed something there in the last 30 days, has open issues there
   * or a fresh heartbeat on one of its issues. Agents first, then by last activity.
   */
  async team(principal: Principal, projectKey: string): Promise<TeamMember[]> {
    requireIssueScope(principal);
    const project = await this.projects.findBrowsable(principal, projectKey);
    await this.projectAccess.require(principal, project.id, 'browse');
    const since = sql`now() - make_interval(days => ${TEAM_DAYS})`;
    const fresh = sql`now() - make_interval(mins => ${HEARTBEAT_MINUTES})`;
    const rows = (await this.database.db.execute<TeamRow>(sql`
      with changes as (
        select a.actor_id, max(a.at) as at from (
          select i.reporter_id as actor_id, i.created_at as at from issues i
            where i.project_id = ${project.id} and i.deleted_at is null and i.created_at > ${since}
          union all
          select g.author_id, g.created_at from issue_change_groups g join issues i on i.id = g.issue_id
            where i.project_id = ${project.id} and i.deleted_at is null and g.created_at > ${since}
          union all
          select c.author_id, c.created_at from issue_comments c join issues i on i.id = c.issue_id
            where i.project_id = ${project.id} and i.deleted_at is null and c.deleted_at is null
              and c.created_at > ${since}
        ) a where a.actor_id is not null group by a.actor_id
      ),
      open as (
        select assignee_id, count(*)::int as n from issues
        where project_id = ${project.id} and deleted_at is null and resolution_id is null
          and assignee_id is not null
        group by assignee_id
      ),
      here as (
        select p.user_id from presence p join issues i on i.id = p.issue_id
        where i.project_id = ${project.id} and p.updated_at > ${fresh}
      )
      select u.id, u.display_name, u.kind,
             p.state, p.updated_at as heartbeat_at, p.branch, p.note,
             pi.id as issue_id, pi.key as issue_key, pi.summary as issue_summary,
             c.at as changed_at,
             greatest(
               (select max(s.last_seen_at) from sessions s where s.user_id = u.id),
               (select max(t.last_used_at) from personal_access_tokens t where t.user_id = u.id)
             ) as seen_at,
             coalesce(o.n, 0) as open_issues
      from users u
      left join changes c on c.actor_id = u.id
      left join open o on o.assignee_id = u.id
      left join presence p on p.user_id = u.id
      left join issues pi on pi.id = p.issue_id and pi.deleted_at is null
        and pi.project_id = ${project.id}
      where u.status = 'active' and u.id <> ${AUTOMATION_ACTOR_ID}
        and (c.actor_id is not null or o.assignee_id is not null or u.id in (select user_id from here))
    `)) as TeamRow[];
    // Only issues of this project the caller may see under issue security.
    const issueIds = rows.flatMap((row) => (row.issue_id ? [row.issue_id] : []));
    const visible = new Set(
      issueIds.length > 0
        ? (
            await this.database.db
              .select({ id: issues.id })
              .from(issues)
              .where(and(inArray(issues.id, issueIds), securityVisible(principal.userId)))
          ).map((row) => row.id)
        : [],
    );
    const now = Date.now();
    const members = rows.map((row): TeamMember => {
      const heartbeat = row.heartbeat_at ? new Date(row.heartbeat_at).getTime() : null;
      const seen = row.seen_at ? new Date(row.seen_at).getTime() : null;
      const freshBeat = heartbeat !== null && now - heartbeat < HEARTBEAT_MINUTES * 60_000;
      const state: PresenceState = freshBeat
        ? (row.state as PresenceState)
        : seen !== null && now - seen < ONLINE_MINUTES * 60_000
          ? 'active'
          : 'offline';
      const times = [row.heartbeat_at, row.changed_at, row.seen_at]
        .filter((value) => value !== null)
        .map((value) => new Date(value as Date | string).getTime());
      return {
        user: { id: row.id, displayName: row.display_name },
        agent: row.kind === 'agent',
        state,
        issue:
          freshBeat && row.issue_id && visible.has(row.issue_id) && row.issue_summary !== null
            ? { key: row.issue_key ?? '', summary: row.issue_summary }
            : null,
        branch: freshBeat ? row.branch : null,
        note: freshBeat ? (row.note ?? '') : '',
        heartbeatAt: iso(row.heartbeat_at),
        lastActivityAt: times.length > 0 ? new Date(Math.max(...times)).toISOString() : null,
        openIssues: Number(row.open_issues),
      };
    });
    return members.sort(
      (a, b) =>
        Number(b.agent) - Number(a.agent) ||
        (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''),
    );
  }
}
