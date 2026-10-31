import { and, eq, inArray, or, type SQL, sql } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { groupMembers, pageRestrictions, pages } from '../db/schema/index.js';

/** Groups the user belongs to, as a subquery. */
function groupsOf(userId: string): SQL {
  return sql`(select ${groupMembers.groupId} from ${groupMembers} where ${groupMembers.userId} = ${userId})`;
}

/**
 * Pages the user may see under page restrictions (TL-14, E-95): neither the page nor any page
 * above it has a view list that leaves the user out. Space permissions are checked separately;
 * nobody bypasses a restriction, administrators included.
 */
export function pageVisible(userId: string): SQL {
  return sql`not exists (
    with recursive chain(id, parent_id) as (
      select p.id, p.parent_id from pages p where p.id = ${pages.id}
      union all
      select p.id, p.parent_id from pages p join chain on p.id = chain.parent_id
    )
    select 1 from chain
    where exists (
        select 1 from ${pageRestrictions} r where r.page_id = chain.id and r.kind = 'view'
      )
      and not exists (
        select 1 from ${pageRestrictions} r
        where r.page_id = chain.id and r.kind = 'view'
          and (r.user_id = ${userId} or r.group_id in ${groupsOf(userId)})
      )
  )`;
}

/** Whether the page's own edit list, if any, includes the user. */
export async function passesEditList(
  db: Executor,
  userId: string,
  pageId: string,
): Promise<boolean> {
  const rows = await db
    .select({ userId: pageRestrictions.userId, groupId: pageRestrictions.groupId })
    .from(pageRestrictions)
    .where(and(eq(pageRestrictions.pageId, pageId), eq(pageRestrictions.kind, 'edit')));
  if (rows.length === 0) return true;
  const [match] = await db
    .select({ id: pageRestrictions.id })
    .from(pageRestrictions)
    .where(
      and(
        eq(pageRestrictions.pageId, pageId),
        eq(pageRestrictions.kind, 'edit'),
        or(
          eq(pageRestrictions.userId, userId),
          inArray(pageRestrictions.groupId, groupsOf(userId)),
        ),
      ),
    );
  return !!match;
}

/** Whether the user may see this one page under page restrictions. */
export async function seesPage(db: Executor, userId: string, pageId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.id, pageId), pageVisible(userId)));
  return !!row;
}
