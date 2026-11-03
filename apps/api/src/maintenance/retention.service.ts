import { Inject, Injectable } from '@nestjs/common';
import { RetentionResult, RetentionSettings } from '@toolvibes/shared';
import { eq, sql } from 'drizzle-orm';
import type { Logger } from '../core/logger.js';
import { DATABASE, FILE_STORE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { systemSettings } from '../db/schema/index.js';
import type { FileStore } from '../storage/file-store.js';
import { anonymizeOldPageViews } from '../wiki/page-analytics.service.js';

const KEY = 'retention';

/**
 * Retention (TL-39, E-120): deletes what has been in the trash long enough, thins out old page
 * versions and drops old audit entries. Runs hourly in the worker.
 */
@Injectable()
export class RetentionService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(FILE_STORE) private readonly store: FileStore,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  async settings(): Promise<RetentionSettings> {
    const [row] = await this.database.db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, KEY));
    return RetentionSettings.parse(row?.value ?? {});
  }

  async setSettings(settings: RetentionSettings): Promise<RetentionSettings> {
    await this.database.db
      .insert(systemSettings)
      .values({ key: KEY, value: settings })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: settings, updatedAt: new Date() },
      });
    return settings;
  }

  async run(now = new Date()): Promise<RetentionResult> {
    const settings = await this.settings();
    const before = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
    const result: RetentionResult = {
      issues: 0,
      pages: 0,
      comments: 0,
      versions: 0,
      auditEntries: 0,
      files: 0,
      pageViews: 0,
    };
    const keys: string[] = [];
    const db = this.database.db;

    if (settings.trashDays > 0) {
      const cutoff = before(settings.trashDays);
      await db.transaction(async (tx) => {
        const issueFiles = await tx.execute<{ storage_key: string }>(sql`
          select a.storage_key from issue_attachments a join issues i on i.id = a.issue_id
          where i.deleted_at < ${cutoff}`);
        const deletedIssues = await tx.execute(sql`
          delete from issues where deleted_at < ${cutoff} returning id`);
        // A trashed page whose subtree still holds live pages stays, since deleting it would
        // take them along.
        const candidates = sql`
          with recursive below(root, id) as (
            select id, id from pages where deleted_at < ${cutoff}
            union all
            select below.root, p.id from pages p join below on p.parent_id = below.id
          )
          select root from below
          group by root
          having bool_and(exists (
            select 1 from pages q where q.id = below.id and q.deleted_at is not null
          ))`;
        const pageFiles = await tx.execute<{ storage_key: string }>(sql`
          select a.storage_key from page_attachments a
          where a.page_id in (
            with recursive below(id) as (
              select root from (${candidates}) c
              union all
              select p.id from pages p join below on p.parent_id = below.id
            )
            select id from below
          )`);
        const deletedPages = await tx.execute(sql`
          delete from pages where id in (${candidates}) returning id`);
        const issueComments = await tx.execute(sql`
          delete from issue_comments where deleted_at < ${cutoff} returning id`);
        const pageComments = await tx.execute(sql`
          delete from page_comments where deleted_at < ${cutoff} returning id`);
        result.issues = deletedIssues.length;
        result.pages = deletedPages.length;
        result.comments = issueComments.length + pageComments.length;
        keys.push(...issueFiles.map((row) => row.storage_key));
        keys.push(...pageFiles.map((row) => row.storage_key));
      });
    }

    if (settings.versionDays > 0) {
      const deleted = await db.execute(sql`
        delete from page_versions v
        where v.created_at < ${before(settings.versionDays)}
          and exists (
            select 1 from page_versions w
            where w.page_id = v.page_id and w.number > v.number
              and date_trunc('day', w.created_at) = date_trunc('day', v.created_at))
        returning id`);
      result.versions = deleted.length;
    }

    if (settings.auditDays > 0) {
      const deleted = await db.execute(sql`
        delete from audit_log where at < ${before(settings.auditDays)} returning id`);
      result.auditEntries = deleted.length;
    }

    // The request log of agents is kept 90 days (TL-98, E-150).
    await db.execute(sql`delete from agent_requests where at < ${before(90)}`);

    // Page views per person last 90 days; older days keep anonymous counts (E-135).
    result.pageViews = await anonymizeOldPageViews(db);

    // Files go after the rows: a failed delete leaves an orphan, never a broken link.
    for (const key of keys) {
      try {
        await this.store.delete(key);
        result.files += 1;
      } catch (error) {
        this.logger.warn({ err: error, key }, 'Could not delete a file of purged content');
      }
    }
    if (Object.values(result).some((count: number) => count > 0))
      this.logger.info(result, 'Retention clean-up');
    return result;
  }
}
