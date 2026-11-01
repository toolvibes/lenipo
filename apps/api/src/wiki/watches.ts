import type { PageWatchState } from '@toolvibes/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { Executor } from '../db/client.js';
import { pages, pageWatches } from '../db/schema/index.js';

/** The page and every page above it, nearest first. */
function chain(pageId: string) {
  return sql`
    with recursive chain(id, parent_id) as (
      select p.id, p.parent_id from pages p where p.id = ${pageId}
      union all
      select p.id, p.parent_id from pages p join chain c on p.id = c.parent_id
    )
    select id from chain`;
}

/**
 * Everyone who follows a page (E-65): watches on the page itself, on it or a page above it
 * with its subtree, or on its space. Permissions are checked by whoever sends to them.
 */
export async function pageWatcherIds(db: Executor, pageId: string): Promise<string[]> {
  const rows = await db.execute<{ user_id: string }>(sql`
    select distinct w.user_id from page_watches w
    join pages p on p.id = ${pageId}
    where (w.kind = 'page' and w.page_id = p.id)
       or (w.kind = 'subtree' and w.page_id in (${chain(pageId)}))
       or (w.kind = 'space' and w.space_id = p.space_id)`);
  return [...rows].map((row) => row.user_id);
}

/** How the user follows the page, for the page view. */
export async function watchState(
  db: Executor,
  userId: string,
  pageId: string,
): Promise<PageWatchState> {
  const rows = await db.execute<{ kind: string; own: boolean }>(sql`
    select w.kind, w.page_id = p.id as own from page_watches w
    join pages p on p.id = ${pageId}
    where w.user_id = ${userId}
      and ((w.kind in ('page', 'subtree') and w.page_id in (${chain(pageId)}))
        or (w.kind = 'space' and w.space_id = p.space_id))`);
  const list = [...rows];
  return {
    page: list.some((row) => row.kind === 'page' && row.own),
    subtree: list.some((row) => row.kind === 'subtree' && row.own),
    inherited: list.some((row) => row.kind === 'space')
      ? 'space'
      : list.some((row) => row.kind === 'subtree' && !row.own)
        ? 'ancestor'
        : null,
  };
}

/** Creating, publishing and commenting follow the page from then on (E-65). */
export async function autoWatch(db: Executor, userId: string, pageId: string): Promise<void> {
  const [page] = await db
    .select({ spaceId: pages.spaceId })
    .from(pages)
    .where(eq(pages.id, pageId));
  if (!page) return;
  await db
    .insert(pageWatches)
    .values({ id: uuidv7(), userId, kind: 'page', spaceId: page.spaceId, pageId })
    .onConflictDoNothing();
}

export async function setWatch(
  db: Executor,
  userId: string,
  target:
    | { kind: 'page' | 'subtree'; spaceId: string; pageId: string }
    | { kind: 'space'; spaceId: string },
  on: boolean,
): Promise<void> {
  const pageId = 'pageId' in target ? target.pageId : null;
  if (on) {
    await db
      .insert(pageWatches)
      .values({ id: uuidv7(), userId, kind: target.kind, spaceId: target.spaceId, pageId })
      .onConflictDoNothing();
    return;
  }
  await db
    .delete(pageWatches)
    .where(
      and(
        eq(pageWatches.userId, userId),
        eq(pageWatches.kind, target.kind),
        eq(pageWatches.spaceId, target.spaceId),
        pageId ? eq(pageWatches.pageId, pageId) : isNull(pageWatches.pageId),
      ),
    );
}
