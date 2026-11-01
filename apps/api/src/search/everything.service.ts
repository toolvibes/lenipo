import { Inject, Injectable } from '@nestjs/common';
import type {
  EverythingQuery,
  EverythingResult,
  PageHit,
  SearchMatch,
  Snippet,
} from '@toolvibes/shared';
import { and, count, desc, eq, gt, ilike, inArray, isNull, or, type SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { escapeLike } from '../db/like.js';
import {
  issueAttachments,
  issueComments,
  issues,
  pageAttachments,
  pageComments,
  pages,
  pageVersions,
  projects,
  spaces,
  users,
} from '../db/schema/index.js';
import { OperationsService } from '../operations/operations.service.js';
import { IssueService } from '../tracking/issue.service.js';
import { securityVisible } from '../tracking/issue-security.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';
import { pageVisible } from '../wiki/page-restrictions.js';
import { SpaceAccessService } from '../wiki/space-access.service.js';

/** Marks around hits in ts_headline output; control characters never occur in page text. */
const START = '\u0001';
const STOP = '\u0002';
const ISSUE_KEY = /^[A-Za-z][A-Za-z0-9]{1,9}-[1-9][0-9]*$/;

/**
 * The text search for one language: plain words become an AND query whose last word also
 * matches as a prefix (search as you type); quotes, OR and -word go through
 * websearch_to_tsquery.
 */
export function tsQuery(config: 'german' | 'english', text: string): SQL {
  // Split like the Postgres parser, so "Offline-Sy" searches "offline" and "sy…".
  const words = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const plain = !/["]|(^|\s)-|\bor\b/i.test(text);
  if (plain && words.length > 0) {
    const terms = words.map((word, index) => (index === words.length - 1 ? `${word}:*` : word));
    return sql`to_tsquery(${config}::regconfig, ${terms.join(' & ')})`;
  }
  return sql`websearch_to_tsquery(${config}::regconfig, ${text})`;
}

/** Splits ts_headline output at the hit marks. */
export function snippet(headline: string): Snippet {
  const parts: Snippet = [];
  for (const [index, chunk] of headline.split(new RegExp(`[${START}${STOP}]`)).entries()) {
    if (chunk) parts.push({ text: chunk, hit: index % 2 === 1 });
  }
  return parts;
}

/**
 * Search across issues, wiki pages, projects and spaces (T-QRY, W-SRC, E-69), limited in SQL
 * to what the caller may see. Pages are searched in their latest published version only.
 */
@Injectable()
export class EverythingService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(SpaceAccessService) private readonly spaceAccess: SpaceAccessService,
    @Inject(IssueService) private readonly issueService: IssueService,
    @Inject(OperationsService) private readonly operations: OperationsService,
  ) {}

  async search(principal: Principal, query: EverythingQuery): Promise<EverythingResult> {
    const db = this.database.db;
    const text = query.q;
    const [browsable, viewable] = await Promise.all([
      this.projectAccess.browsableCondition(principal.userId),
      this.spaceAccess.viewableCondition(principal.userId),
    ]);
    const projectFilter = query.project
      ? sql`lower(${projects.key}) = lower(${query.project})`
      : undefined;
    const projectIds = db
      .select({ id: projects.id })
      .from(projects)
      .where(and(browsable, projectFilter));
    // Without the wiki module, no pages or spaces are found (TL-40).
    const wiki = await this.operations.moduleEnabled('wiki');
    const spaceIds = db
      .select({ id: spaces.id })
      .from(spaces)
      .where(
        and(
          viewable,
          query.project ? inArray(spaces.projectId, projectIds) : undefined,
          wiki ? undefined : sql`false`,
        ),
      );

    const german = tsQuery('german', text);
    const english = tsQuery('english', text);
    const like = `%${escapeLike(text)}%`;
    const wants = (type: EverythingQuery['type'] & string) => !query.type || query.type === type;
    const limit = (type: EverythingQuery['type'] & string) =>
      query.type === type ? query.limit : Math.min(query.limit, type === 'issue' ? 10 : 5);

    // Issues: full text or the exact key, or one of their comments or attachment names (TL-3).
    const keyMatch = ISSUE_KEY.test(text) ? sql`lower(${issues.key}) = lower(${text})` : null;
    const issueDirect = or(
      sql`${issues.searchVector} @@ ${german}`,
      sql`${issues.searchVector} @@ ${english}`,
      keyMatch ?? undefined,
    ) as SQL;
    const issueWhere = and(
      inArray(issues.projectId, projectIds),
      isNull(issues.deletedAt),
      securityVisible(principal.userId),
      or(
        issueDirect,
        sql`exists (select 1 from ${issueComments} where ${issueComments.issueId} = ${issues.id} and ${issueComments.deletedAt} is null and (${issueComments.searchVector} @@ ${german} or ${issueComments.searchVector} @@ ${english}))`,
        sql`exists (select 1 from ${issueAttachments} where ${issueAttachments.issueId} = ${issues.id} and ${issueAttachments.fileName} ilike ${like})`,
      ),
    );
    const issueRank = sql`greatest(ts_rank_cd(${issues.searchVector}, ${german}), ts_rank_cd(${issues.searchVector}, ${english}))`;

    // Pages: the latest published version of pages outside the trash.
    const parent = alias(pages, 'parent');
    const pageDirect = or(
      sql`${pageVersions.searchVector} @@ ${german}`,
      sql`${pageVersions.searchVector} @@ ${english}`,
    ) as SQL;
    const pageWhere = and(
      inArray(pages.spaceId, spaceIds),
      isNull(pages.deletedAt),
      pageVisible(principal.userId),
      gt(pages.version, 0),
      or(
        pageDirect,
        sql`exists (select 1 from ${pageComments} where ${pageComments.pageId} = ${pages.id} and ${pageComments.deletedAt} is null and (${pageComments.searchVector} @@ ${german} or ${pageComments.searchVector} @@ ${english}))`,
        sql`exists (select 1 from ${pageAttachments} where ${pageAttachments.pageId} = ${pages.id} and ${pageAttachments.fileName} ilike ${like})`,
      ),
    );
    const pageJoin = and(eq(pageVersions.pageId, pages.id), eq(pageVersions.number, pages.version));
    const pageRank = sql`greatest(ts_rank_cd(${pageVersions.searchVector}, ${german}), ts_rank_cd(${pageVersions.searchVector}, ${english}))`;

    const projectWhere = and(
      browsable,
      projectFilter,
      or(ilike(projects.name, like), ilike(projects.key, `${escapeLike(text)}%`)),
    );
    const spaceWhere = and(
      inArray(spaces.id, spaceIds),
      or(ilike(spaces.name, like), ilike(spaces.key, `${escapeLike(text)}%`)),
    );

    const [
      issueCount,
      pageCount,
      projectCount,
      spaceCount,
      issueRows,
      pageRows,
      projectRows,
      spaceRows,
    ] = await Promise.all([
      db.select({ n: count() }).from(issues).where(issueWhere),
      db.select({ n: count() }).from(pages).innerJoin(pageVersions, pageJoin).where(pageWhere),
      db.select({ n: count() }).from(projects).where(projectWhere),
      db.select({ n: count() }).from(spaces).where(spaceWhere),
      wants('issue')
        ? db
            .select({ issue: issues, direct: sql<boolean>`${issueDirect}` })
            .from(issues)
            .where(issueWhere)
            .orderBy(
              ...(keyMatch ? [desc(keyMatch)] : []),
              desc(sql`lower(${issues.summary}) = lower(${text})`),
              // Hits in the issue itself before hits only in its comments or attachments.
              desc(issueDirect),
              desc(issueRank),
              desc(issues.updatedAt),
            )
            .limit(limit('issue'))
        : Promise.resolve([]),
      wants('page')
        ? db
            .select({
              id: pages.id,
              title: pages.title,
              spaceKey: spaces.key,
              spaceName: spaces.name,
              parentTitle: parent.title,
              publishedAt: pages.publishedAt,
              direct: sql<boolean>`${pageDirect}`,
              headline: sql<string>`ts_headline('german', ${pageVersions.text}, ${german} || ${english}, ${`StartSel=${START}, StopSel=${STOP}, MaxWords=32, MinWords=12, ShortWord=2, MaxFragments=1, FragmentDelimiter=" … "`})`,
            })
            .from(pages)
            .innerJoin(pageVersions, pageJoin)
            .innerJoin(spaces, eq(spaces.id, pages.spaceId))
            .leftJoin(parent, eq(parent.id, pages.parentId))
            .where(pageWhere)
            .orderBy(
              desc(sql`lower(${pages.title}) = lower(${text})`),
              desc(pageDirect),
              desc(pageRank),
              desc(pages.publishedAt),
            )
            .limit(limit('page'))
        : Promise.resolve([]),
      wants('project')
        ? db
            .select({ key: projects.key, name: projects.name, description: projects.description })
            .from(projects)
            .where(projectWhere)
            .orderBy(projects.name)
            .limit(limit('project'))
        : Promise.resolve([]),
      wants('space')
        ? db
            .select({ key: spaces.key, name: spaces.name, description: spaces.description })
            .from(spaces)
            .where(spaceWhere)
            .orderBy(spaces.name)
            .limit(limit('space'))
        : Promise.resolve([]),
    ]);

    const headline = (column: SQL | typeof issueComments.bodyText) =>
      sql<string>`ts_headline('german', ${column}, ${german} || ${english}, ${`StartSel=${START}, StopSel=${STOP}, MaxWords=24, MinWords=8, ShortWord=2, MaxFragments=1, FragmentDelimiter=" … "`})`;
    const [issueMatches, pageMatches] = await Promise.all([
      this.matches(
        issueRows.filter((row) => !row.direct).map((row) => row.issue.id),
        {
          comments: issueComments,
          owner: issueComments.issueId,
          attachments: issueAttachments,
          attachmentOwner: issueAttachments.issueId,
        },
        { german, english, like, headline },
      ),
      this.matches(
        pageRows.filter((row) => !row.direct).map((row) => row.id),
        {
          comments: pageComments,
          owner: pageComments.pageId,
          attachments: pageAttachments,
          attachmentOwner: pageAttachments.pageId,
        },
        { german, english, like, headline },
      ),
    ]);
    const summaries = await this.issueService.summarize(
      principal.userId,
      issueRows.map((row) => row.issue),
    );

    return {
      counts: {
        issue: issueCount[0]?.n ?? 0,
        page: pageCount[0]?.n ?? 0,
        project: projectCount[0]?.n ?? 0,
        space: spaceCount[0]?.n ?? 0,
      },
      issues: summaries.map((issue) => {
        const match = issueMatches.get(issue.id);
        return match ? { ...issue, match } : issue;
      }),
      pages: pageRows.map(
        (row): PageHit => ({
          id: row.id,
          title: row.title,
          space: { key: row.spaceKey, name: row.spaceName },
          parentTitle: row.parentTitle,
          publishedAt: row.publishedAt?.toISOString() ?? null,
          snippet: snippet(row.headline),
          ...(pageMatches.has(row.id) ? { match: pageMatches.get(row.id) } : {}),
        }),
      ),
      projects: projectRows,
      spaces: spaceRows,
    };
  }

  /**
   * For results found only through a comment or an attachment: the newest matching comment with
   * its author and marked words, otherwise the first matching file name.
   */
  private async matches(
    ids: string[],
    tables: {
      comments: typeof issueComments | typeof pageComments;
      owner: typeof issueComments.issueId | typeof pageComments.pageId;
      attachments: typeof issueAttachments | typeof pageAttachments;
      attachmentOwner: typeof issueAttachments.issueId | typeof pageAttachments.pageId;
    },
    terms: {
      german: SQL;
      english: SQL;
      like: string;
      headline: (column: SQL) => SQL<string>;
    },
  ): Promise<Map<string, SearchMatch>> {
    const found = new Map<string, SearchMatch>();
    if (ids.length === 0) return found;
    const db = this.database.db;
    const { comments, owner, attachments, attachmentOwner } = tables;
    const commentRows = await db
      .selectDistinctOn([owner], {
        owner: owner,
        author: users.displayName,
        headline: terms.headline(sql`${comments.bodyText}`),
      })
      .from(comments)
      .leftJoin(users, eq(users.id, comments.authorId))
      .where(
        and(
          inArray(owner, ids),
          isNull(comments.deletedAt),
          or(
            sql`${comments.searchVector} @@ ${terms.german}`,
            sql`${comments.searchVector} @@ ${terms.english}`,
          ),
        ),
      )
      .orderBy(owner, desc(comments.createdAt));
    for (const row of commentRows) {
      found.set(row.owner, { in: 'comment', author: row.author, snippet: snippet(row.headline) });
    }
    const rest = ids.filter((id) => !found.has(id));
    if (rest.length === 0) return found;
    const fileRows = await db
      .selectDistinctOn([attachmentOwner], {
        owner: attachmentOwner,
        fileName: attachments.fileName,
        author: users.displayName,
      })
      .from(attachments)
      .leftJoin(users, eq(users.id, attachments.authorId))
      .where(and(inArray(attachmentOwner, rest), ilike(attachments.fileName, terms.like)))
      .orderBy(attachmentOwner, attachments.fileName);
    for (const row of fileRows) {
      found.set(row.owner, {
        in: 'attachment',
        author: row.author,
        snippet: [{ text: row.fileName, hit: true }],
      });
    }
    return found;
  }
}
