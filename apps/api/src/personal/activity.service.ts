import { Inject, Injectable } from '@nestjs/common';
import type { ActivityEntry, ActivityPage, ActivityQuery, UserRef } from '@tasklore/shared';
import { inArray, sql } from 'drizzle-orm';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { issueChangeItems, projects, users } from '../db/schema/index.js';
import { requireIssueScope } from '../search/search.service.js';
import { ProjectService } from '../tracking/project.service.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';

interface Row extends Record<string, unknown> {
  kind: 'created' | 'updated' | 'commented';
  id: string;
  actor_id: string | null;
  at: Date | string;
  group_id: string | null;
  excerpt: string | null;
  issue_key: string;
  issue_summary: string;
  project_key: string;
  project_name: string;
}

/**
 * The activity stream (P-GEN-01) straight from the permanent tables (E-46): issue creation,
 * change groups and comments, limited in SQL to projects the caller may browse.
 */
@Injectable()
export class ActivityService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
  ) {}

  async stream(principal: Principal, query: ActivityQuery): Promise<ActivityPage> {
    requireIssueScope(principal);
    const db = this.database.db;
    const visible = db
      .select({ id: projects.id })
      .from(projects)
      .where(await this.projectAccess.browsableCondition(principal.userId));
    const project = query.project
      ? await this.projects.findBrowsable(principal, query.project)
      : null;
    const filters = [
      sql`i.deleted_at is null`,
      sql`i.project_id in ${visible}`,
      project ? sql`i.project_id = ${project.id}` : undefined,
      query.user ? sql`a.actor_id = ${query.user}` : undefined,
      query.before ? sql`a.at < ${query.before}` : undefined,
    ].filter((condition) => condition !== undefined);

    const rows = (await db.execute<Row>(sql`
      select a.kind, a.id, a.actor_id, a.at, a.group_id, a.excerpt,
             i.key as issue_key, i.summary as issue_summary, p.key as project_key, p.name as project_name
      from (
        select 'created' as kind, 'issue:' || i.id as id, i.reporter_id as actor_id, i.created_at as at,
               i.id as issue_id, null::bigint as group_id, null::text as excerpt
        from issues i
        union all
        select 'updated', 'change:' || g.id, g.author_id, g.created_at, g.issue_id, g.id, null
        from issue_change_groups g
        union all
        select 'commented', 'comment:' || c.id, c.author_id, c.created_at, c.issue_id, null, left(c.body_text, 300)
        from issue_comments c where c.deleted_at is null
      ) a
      join issues i on i.id = a.issue_id
      join projects p on p.id = i.project_id
      where ${sql.join(filters, sql` and `)}
      order by a.at desc, a.id desc
      limit ${query.limit + 1}
    `)) as Row[];

    const page = rows.slice(0, query.limit);
    const groupIds = page.flatMap((row) => (row.group_id ? [Number(row.group_id)] : []));
    const items =
      groupIds.length > 0
        ? await db
            .select()
            .from(issueChangeItems)
            .where(inArray(issueChangeItems.groupId, groupIds))
            .orderBy(issueChangeItems.id)
        : [];
    const actorIds = [...new Set(page.flatMap((row) => (row.actor_id ? [row.actor_id] : [])))];
    const actors =
      actorIds.length > 0
        ? await db
            .select({ id: users.id, displayName: users.displayName })
            .from(users)
            .where(inArray(users.id, actorIds))
        : [];
    const actorOf = new Map<string, UserRef>(actors.map((actor) => [actor.id, actor]));

    const entries: ActivityEntry[] = page.map((row) => ({
      id: row.id,
      kind: row.kind,
      actor: row.actor_id ? (actorOf.get(row.actor_id) ?? null) : null,
      issue: { key: row.issue_key, summary: row.issue_summary },
      project: { key: row.project_key, name: row.project_name },
      items: items
        .filter((item) => row.group_id !== null && item.groupId === Number(row.group_id))
        .map((item) => ({ field: item.field, from: item.fromDisplay, to: item.toDisplay })),
      ...(row.excerpt ? { excerpt: row.excerpt } : {}),
      at: new Date(row.at).toISOString(),
    }));
    const last = page.at(-1);
    return {
      entries,
      next: rows.length > query.limit && last ? new Date(last.at).toISOString() : null,
    };
  }
}
