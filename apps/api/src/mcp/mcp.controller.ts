import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  All,
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service.js';
import { BoardService } from '../boards/board.service.js';
import { ReportService } from '../boards/report.service.js';
import { SprintService } from '../boards/sprint.service.js';
import { SprintApprovalService } from '../boards/sprint-approval.service.js';
import { CurrentPrincipal } from '../core/http/decorators.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { UserService } from '../identity/user.service.js';
import { NotificationService } from '../notifications/notification.service.js';
import { OperationsService } from '../operations/operations.service.js';
import { ClaimService } from '../presence/claim.service.js';
import { HandoverService } from '../presence/handover.service.js';
import { PresenceService } from '../presence/presence.service.js';
import { ReviewService } from '../presence/review.service.js';
import { EverythingService } from '../search/everything.service.js';
import { SearchService } from '../search/search.service.js';
import { ComponentService } from '../tracking/component.service.js';
import { CustomFieldService } from '../tracking/custom-field.service.js';
import { EstimationService } from '../tracking/estimation.service.js';
import { IssueService } from '../tracking/issue.service.js';
import { ProjectService } from '../tracking/project.service.js';
import { VersionService } from '../tracking/version.service.js';
import { WorklogService } from '../tracking/worklog.service.js';
import { DraftService } from '../wiki/draft.service.js';
import { PageService } from '../wiki/page.service.js';
import { PageCommentService } from '../wiki/page-comment.service.js';
import { SpaceService } from '../wiki/space.service.js';
import { registerPrompts, registerResources } from './resources.js';
import { registerTools, type ToolServices } from './tools.js';

/**
 * The built-in MCP server (D-MCP-01, E-52): stateless Streamable HTTP with JSON answers, so
 * every instance can serve every request. Only Personal Access Tokens sign in.
 */
@Controller('mcp')
export class McpController {
  private readonly services: ToolServices;

  constructor(
    @Inject(DATABASE) database: DatabaseHandle,
    @Inject(IssueService) issues: IssueService,
    @Inject(SearchService) search: SearchService,
    @Inject(ProjectService) projects: ProjectService,
    @Inject(ComponentService) components: ComponentService,
    @Inject(WorklogService) worklogs: WorklogService,
    @Inject(CustomFieldService) customFields: CustomFieldService,
    @Inject(UserService) users: UserService,
    @Inject(AuditService) audit: AuditService,
    @Inject(BoardService) boards: BoardService,
    @Inject(SprintService) sprints: SprintService,
    @Inject(ReportService) reports: ReportService,
    @Inject(VersionService) versions: VersionService,
    @Inject(SpaceService) spaces: SpaceService,
    @Inject(PageService) pages: PageService,
    @Inject(DraftService) drafts: DraftService,
    @Inject(PageCommentService) pageComments: PageCommentService,
    @Inject(EverythingService) everything: EverythingService,
    @Inject(OperationsService) private readonly operations: OperationsService,
    @Inject(PresenceService) presence: PresenceService,
    @Inject(ClaimService) claims: ClaimService,
    @Inject(HandoverService) handovers: HandoverService,
    @Inject(NotificationService) notifications: NotificationService,
    @Inject(SprintApprovalService) approvals: SprintApprovalService,
    @Inject(EstimationService) estimation: EstimationService,
    @Inject(ReviewService) reviews: ReviewService,
  ) {
    this.services = {
      database,
      boards,
      sprints,
      reports,
      versions,
      issues,
      search,
      projects,
      components,
      worklogs,
      customFields,
      users,
      audit,
      spaces,
      pages,
      drafts,
      pageComments,
      everything,
      presence,
      claims,
      handovers,
      notifications,
      approvals,
      estimation,
      reviews,
    };
  }

  @Post()
  async handle(
    @CurrentPrincipal() principal: Principal,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    if (principal.via === 'session' || principal.via === 'automation' || principal.via === 'mail') {
      throw new UnauthorizedException('MCP clients sign in with a Personal Access Token');
    }
    const server = new McpServer({ name: 'lenipo', version: '1.0.0' });
    const caller: Principal = { ...principal, via: 'mcp' };
    const { modules } = await this.operations.snapshot();
    const handlers = registerTools(server, caller, this.services, modules);
    registerResources(server, caller, handlers, this.services.search);
    registerPrompts(server, handlers);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    response.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
  }

  /** Without sessions there is no event stream to open and nothing to end. */
  @All()
  @HttpCode(405)
  other(@Res() response: Response): void {
    response
      .status(405)
      .set('Allow', 'POST')
      .json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed' },
        id: null,
      });
  }
}
