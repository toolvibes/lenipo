import { Inject, Injectable } from '@nestjs/common';
import type { PageAnalytics } from '@toolvibes/shared';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle, Executor } from '../db/client.js';
import { pageViewCounts, pageViews, users } from '../db/schema/index.js';
import { PageService } from './page.service.js';

/** Days for which page views stay per person; older days keep only anonymous counts (E-135). */
export const PAGE_VIEW_DAYS = 90;

/** Counts a view of a page by a person for today (W-PAG-14, TL-51). */
export async function recordPageView(db: Executor, pageId: string, userId: string): Promise<void> {
  await db
    .insert(pageViews)
    .values({ pageId, userId, day: sql`current_date` })
    .onConflictDoUpdate({
      target: [pageViews.pageId, pageViews.day, pageViews.userId],
      set: { views: sql`${pageViews.views} + 1` },
    });
}

/**
 * Turns per-person rows older than {@link PAGE_VIEW_DAYS} into anonymous daily counts, then
 * deletes them (E-135). Runs with the other retention jobs.
 */
export async function anonymizeOldPageViews(db: Executor): Promise<number> {
  const cutoff = sql`current_date - ${PAGE_VIEW_DAYS}::int`;
  await db.execute(sql`
    insert into ${pageViewCounts} (page_id, day, views, readers)
    select page_id, day, sum(views), count(*) from ${pageViews}
    where day < ${cutoff}
    group by page_id, day
    on conflict (page_id, day) do update
      set views = ${pageViewCounts.views} + excluded.views,
          readers = ${pageViewCounts.readers} + excluded.readers`);
  const deleted = await db
    .delete(pageViews)
    .where(sql`${pageViews.day} < ${cutoff}`)
    .returning({ pageId: pageViews.pageId });
  return deleted.length;
}

/** Page analytics (W-PAG-14, TL-51, E-135): counts for every reader, names for administrators. */
@Injectable()
export class PageAnalyticsService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(PageService) private readonly pages: PageService,
  ) {}

  async analytics(principal: Principal, id: string, days: number): Promise<PageAnalytics> {
    const { page, permissions } = await this.pages.authorize(principal, id, 'view');
    const db = this.database.db;
    const since = sql`current_date - ${days - 1}::int`;
    const recent = await db
      .select({
        day: pageViews.day,
        views: sql<number>`sum(${pageViews.views})::int`,
        readers: sql<number>`count(*)::int`,
      })
      .from(pageViews)
      .where(and(eq(pageViews.pageId, page.id), gte(pageViews.day, since)))
      .groupBy(pageViews.day);
    const older = await db
      .select({
        day: pageViewCounts.day,
        views: pageViewCounts.views,
        readers: pageViewCounts.readers,
      })
      .from(pageViewCounts)
      .where(and(eq(pageViewCounts.pageId, page.id), gte(pageViewCounts.day, since)));
    const byDay = new Map<string, { views: number; readers: number }>();
    for (const row of [...older, ...recent]) {
      const entry = byDay.get(row.day) ?? { views: 0, readers: 0 };
      byDay.set(row.day, { views: entry.views + row.views, readers: entry.readers + row.readers });
    }
    const daily = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, counts]) => ({ day, ...counts }));
    // Distinct readers over the whole period; days past the per-person rows only count.
    const [distinct] = await db
      .select({ readers: sql<number>`count(distinct ${pageViews.userId})::int` })
      .from(pageViews)
      .where(and(eq(pageViews.pageId, page.id), gte(pageViews.day, since)));
    const anonymousReaders = older.reduce((sum, row) => sum + row.readers, 0);
    const readerList = permissions.has('administer')
      ? (
          await db
            .select({
              id: users.id,
              displayName: users.displayName,
              views: sql<number>`sum(${pageViews.views})::int`,
              lastViewed: sql<string>`max(${pageViews.day})::text`,
            })
            .from(pageViews)
            .innerJoin(users, eq(users.id, pageViews.userId))
            .where(and(eq(pageViews.pageId, page.id), gte(pageViews.day, since)))
            .groupBy(users.id, users.displayName)
            .orderBy(desc(sql`sum(${pageViews.views})`))
        ).map((row) => ({
          user: { id: row.id, displayName: row.displayName },
          views: row.views,
          lastViewed: row.lastViewed,
        }))
      : null;
    return {
      days,
      views: daily.reduce((sum, entry) => sum + entry.views, 0),
      readers: (distinct?.readers ?? 0) + anonymousReaders,
      daily,
      readerList,
    };
  }
}
