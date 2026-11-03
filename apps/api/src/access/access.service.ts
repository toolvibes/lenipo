import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AUTOMATION_ACTOR_ID, type GlobalPermission } from '@toolvibes/shared';
import { eq, sql } from 'drizzle-orm';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle, Executor } from '../db/client.js';
import { globalPermissionGrants, groupMembers, users } from '../db/schema/index.js';

/** Why an agent only reads (TL-98, E-150): its own Not-Aus or the project's. */
export interface AgentPauseState {
  scope: 'agent' | 'project';
  reason: string;
}

/** 423 with the reason, so the agent stops instead of retrying. */
export function pausedError(pause: AgentPauseState): HttpException {
  const what =
    pause.scope === 'agent' ? 'This agent is paused' : 'Agents are paused in this project';
  return new HttpException(
    {
      type: 'urn:lenipo:problem:agent-paused',
      message: pause.reason ? `${what}: ${pause.reason}` : what,
    },
    HttpStatus.LOCKED,
  );
}

/**
 * The single place that answers "may this user do that?". UI, API, MCP, search and
 * notifications all ask here; nothing decides permissions on its own.
 */
@Injectable()
export class AccessService {
  /** The kind of an account never changes, so it is asked once per user. */
  private readonly agents = new Map<string, boolean>();

  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  async isAgent(userId: string): Promise<boolean> {
    const known = this.agents.get(userId);
    if (known !== undefined) return known;
    const [row] = await this.database.db
      .select({ kind: users.kind })
      .from(users)
      .where(eq(users.id, userId));
    const agent = row?.kind === 'agent';
    if (row) this.agents.set(userId, agent);
    return agent;
  }

  /** Whether an agent is held by its Not-Aus or by its project's; null for people. */
  async agentPause(userId: string, projectId?: string): Promise<AgentPauseState | null> {
    if (!(await this.isAgent(userId))) return null;
    const rows = await this.database.db.execute<{
      agent_paused: boolean;
      agent_reason: string;
      project_paused: boolean | null;
      project_reason: string | null;
    }>(sql`select a.paused_at is not null as agent_paused, a.pause_reason as agent_reason,
        p.agents_paused_at is not null as project_paused, p.agents_pause_reason as project_reason
      from agent_profiles a
      left join projects p on p.id = ${projectId ?? null}::uuid
      where a.user_id = ${userId}`);
    const [row] = [...rows];
    if (!row) return null;
    if (row.agent_paused) return { scope: 'agent', reason: row.agent_reason };
    if (row.project_paused) return { scope: 'project', reason: row.project_reason ?? '' };
    return null;
  }

  async globalPermissions(
    userId: string,
    db: Executor = this.database.db,
  ): Promise<GlobalPermission[]> {
    // External collaborators hold no global permission, whatever their groups (TL-66, E-131).
    const [account] = await db
      .select({ external: users.external })
      .from(users)
      .where(eq(users.id, userId));
    if (account?.external) return [];
    const rows = await db
      .selectDistinct({ permission: globalPermissionGrants.permission })
      .from(globalPermissionGrants)
      .innerJoin(groupMembers, eq(groupMembers.groupId, globalPermissionGrants.groupId))
      .where(eq(groupMembers.userId, userId));
    return rows.map((row) => row.permission as GlobalPermission).sort();
  }

  /** System administrators hold every global permission implicitly. */
  async hasGlobal(userId: string, permission: GlobalPermission): Promise<boolean> {
    // The automation actor may do anything; each rule limits it to its projects (E-103).
    if (userId === AUTOMATION_ACTOR_ID) return true;
    const granted = await this.globalPermissions(userId);
    return granted.includes(permission) || granted.includes('system-admin');
  }

  /**
   * Administration in the caller's name: the permission, and for tokens also the `admin` scope,
   * as the route guard checks it (TL-44, E-125). OAuth tokens never carry that scope.
   */
  async isAdmin(principal: Principal): Promise<boolean> {
    if ('scopes' in principal && !principal.scopes.includes('admin')) return false;
    return this.hasGlobal(principal.userId, 'admin');
  }
}
