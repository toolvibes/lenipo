import { Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import {
  Page,
  PageAnalytics,
  PendingApproval,
  RejectSubmissionRequest,
  SetApprovalModeRequest,
} from '@toolvibes/shared';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { RequireModule } from '../operations/operations.guard.js';
import { PageService } from './page.service.js';
import { PageAnalyticsService } from './page-analytics.service.js';

const PageId = new ParseUUIDPipe({ errorHttpStatusCode: 404 });
const AnalyticsQuery = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });
type AnalyticsQuery = z.infer<typeof AnalyticsQuery>;

/** Approval of page versions and page analytics (W-PAG-12, W-PAG-14, TL-51, E-135). */
@RequireModule('wiki')
@Controller()
export class PageApprovalController {
  constructor(
    @Inject(PageService) private readonly pages: PageService,
    @Inject(PageAnalyticsService) private readonly analytics: PageAnalyticsService,
  ) {}

  @Endpoint({
    tag: 'Pages',
    summary: 'Approve the version waiting for approval',
    description: 'Requires the space permission `approve`; the author stays the author.',
    response: Page,
  })
  @Post('pages/:id/approval/approve')
  @HttpCode(200)
  approvePage(@CurrentPrincipal() principal: Principal, @Param('id', PageId) id: string) {
    return this.pages.approve(principal, id);
  }

  @Endpoint({
    tag: 'Pages',
    summary: 'Reject the version waiting for approval, with a comment',
    response: Page,
  })
  @Post('pages/:id/approval/reject')
  @HttpCode(200)
  rejectPage(
    @CurrentPrincipal() principal: Principal,
    @Param('id', PageId) id: string,
    @ValidBody(RejectSubmissionRequest) body: RejectSubmissionRequest,
  ) {
    return this.pages.reject(principal, id, body.comment);
  }

  @Endpoint({
    tag: 'Pages',
    summary: 'Whether new versions of the page need approval',
    description: '`space` follows the space setting. Requires the space permission `approve`.',
    response: Page,
  })
  @Put('pages/:id/approval-mode')
  setApprovalMode(
    @CurrentPrincipal() principal: Principal,
    @Param('id', PageId) id: string,
    @ValidBody(SetApprovalModeRequest) body: SetApprovalModeRequest,
  ) {
    return this.pages.setApprovalMode(principal, id, body.mode);
  }

  @Endpoint({
    tag: 'Spaces',
    summary: 'Pages of the space waiting for approval',
    response: z.array(PendingApproval),
  })
  @Get('spaces/:key/approvals')
  pendingApprovals(@CurrentPrincipal() principal: Principal, @Param('key') key: string) {
    return this.pages.pendingApprovals(principal, key.toUpperCase());
  }

  @Endpoint({
    tag: 'Pages',
    summary: 'Views and readers of a page per day',
    description:
      'Counts for everyone who sees the page; the list of readers only for space administrators. Per-person data covers the last 90 days.',
    response: PageAnalytics,
  })
  @Get('pages/:id/analytics')
  pageAnalytics(
    @CurrentPrincipal() principal: Principal,
    @Param('id', PageId) id: string,
    @ValidQuery(AnalyticsQuery) query: AnalyticsQuery,
  ) {
    return this.analytics.analytics(principal, id, query.days);
  }
}
