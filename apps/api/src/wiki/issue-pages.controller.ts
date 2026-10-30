import { Controller, Get, Inject, Param } from '@nestjs/common';
import { IssuePageRef } from '@tasklore/shared';
import { and, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { CurrentPrincipal } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { pageIssueRefs, pages, spaces } from '../db/schema/index.js';
import { IssueService } from '../tracking/issue.service.js';
import { SpaceAccessService } from './space-access.service.js';

/** "Wiki-Seiten" on an issue (W-INT-03, E-73). */
@Controller()
export class IssuePagesController {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(IssueService) private readonly issues: IssueService,
    @Inject(SpaceAccessService) private readonly spaceAccess: SpaceAccessService,
  ) {}

  @Endpoint({
    tag: 'Issues',
    summary: 'Wiki pages that refer to an issue',
    description:
      'Published pages whose latest version names the issue key or embeds it as a macro, only in spaces the caller may view; newest first.',
    response: z.array(IssuePageRef),
  })
  @Get('issues/:key/pages')
  async pages(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<IssuePageRef[]> {
    const issue = await this.issues.get(principal, key);
    const viewable = this.database.db
      .select({ id: spaces.id })
      .from(spaces)
      .where(await this.spaceAccess.viewableCondition(principal.userId));
    const rows = await this.database.db
      .select({
        id: pages.id,
        title: pages.title,
        spaceKey: spaces.key,
        spaceName: spaces.name,
        kind: pageIssueRefs.kind,
        publishedAt: pages.publishedAt,
      })
      .from(pageIssueRefs)
      .innerJoin(pages, eq(pages.id, pageIssueRefs.pageId))
      .innerJoin(spaces, eq(spaces.id, pages.spaceId))
      .where(
        and(
          eq(pageIssueRefs.issueId, issue.id),
          isNull(pages.deletedAt),
          gt(pages.version, 0),
          inArray(spaces.id, viewable),
        ),
      )
      .orderBy(desc(pages.publishedAt));
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      space: { key: row.spaceKey, name: row.spaceName },
      kind: row.kind === 'macro' ? 'macro' : 'mention',
      publishedAt: row.publishedAt?.toISOString() ?? null,
    }));
  }
}
