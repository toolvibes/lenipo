import {
  type ArgumentsHost,
  Catch,
  Controller,
  type ExceptionFilter,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Param,
  Post,
  Put,
  Req,
  UseFilters,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import type { Principal } from '../core/http/principal.js';
import { toProblem } from '../core/http/problem.filter.js';
import type { Logger } from '../core/logger.js';
import { LOGGER } from '../core/tokens.js';
import { JiraCompatService, JiraFieldError } from './jira-compat.service.js';
import { jiraErrors } from './jira-mapping.js';

/** Where the compatible API lives: the path Jira clients append to the server address. */
export const JIRA_API_PATH = 'rest/api/2';

/** Errors in Jira's shape, which its clients parse (`errorMessages` and `errors` by field). */
@Catch()
@Injectable()
export class JiraErrorFilter implements ExceptionFilter {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof JiraFieldError) {
      response.status(400).json(jiraErrors([], { [exception.field]: exception.message }));
      return;
    }
    if (exception instanceof z.ZodError) {
      const errors = Object.fromEntries(
        exception.issues.map((issue) => [issue.path.join('.') || 'request', issue.message]),
      );
      response.status(400).json(jiraErrors([], errors));
      return;
    }
    const problem = toProblem(exception);
    if (problem.status >= 500) this.logger.error({ err: exception }, 'Unhandled error');
    response.status(problem.status).json(jiraErrors([problem.detail ?? problem.title], {}));
  }
}

const Fields = z.record(z.string(), z.unknown());
const Write = z.looseObject({
  fields: Fields.optional(),
  update: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))).optional(),
});
type Write = z.infer<typeof Write>;
const TransitionWrite = Write.extend({
  transition: z.looseObject({ id: z.union([z.string(), z.number()]) }),
});
type TransitionWrite = z.infer<typeof TransitionWrite>;

const FieldList = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) =>
    (Array.isArray(value) ? value : (value?.split(',') ?? []))
      .map((name) => name.trim())
      .filter(Boolean),
  );
const SearchQuery = z.object({
  jql: z.string().default(''),
  startAt: z.coerce.number().int().min(0).default(0),
  maxResults: z.coerce.number().int().min(0).default(50),
  fields: FieldList,
});
type SearchQuery = z.infer<typeof SearchQuery>;
const SearchBody = z.looseObject({
  jql: z.string().default(''),
  startAt: z.number().int().min(0).default(0),
  maxResults: z.number().int().min(0).default(50),
  fields: FieldList,
});
type SearchBody = z.infer<typeof SearchBody>;
const IssueQuery = z.object({ fields: FieldList });
type IssueQuery = z.infer<typeof IssueQuery>;
const PageQuery = z.object({
  startAt: z.coerce.number().int().min(0).default(0),
  maxResults: z.coerce.number().int().min(0).default(5000),
});
type PageQuery = z.infer<typeof PageQuery>;
const CommentBody = z.looseObject({ body: z.unknown() });
type CommentBody = z.infer<typeof CommentBody>;

/** The address clients use for `self` links; behind a proxy Express reads the forwarded one. */
function baseOf(request: Request): string {
  return `${request.protocol}://${request.get('host')}/${JIRA_API_PATH}`;
}

/**
 * The Jira REST API v2 subset (TL-48, E-138), so scripts and tools written for Jira keep
 * working. Not part of Lenipo's own OpenAPI document: its shapes are Jira's.
 */
@Controller(JIRA_API_PATH)
@UseFilters(JiraErrorFilter)
export class JiraCompatController {
  constructor(@Inject(JiraCompatService) private readonly jira: JiraCompatService) {}

  @Get('serverInfo')
  serverInfo(@Req() request: Request) {
    // Clients such as jira-python read the version when they connect and pick API features by it.
    return {
      baseUrl: `${request.protocol}://${request.get('host')}`,
      version: '9.12.0',
      versionNumbers: [9, 12, 0],
      deploymentType: 'Server',
      buildNumber: 912000,
      serverTitle: 'Lenipo',
    };
  }

  @Get('myself')
  myself(@CurrentPrincipal() principal: Principal) {
    return this.jira.myself(principal);
  }

  @Get('search')
  search(
    @CurrentPrincipal() principal: Principal,
    @Req() request: Request,
    @ValidQuery(SearchQuery) query: SearchQuery,
  ) {
    return this.jira.search(principal, baseOf(request), query);
  }

  @Post('search')
  @HttpCode(200)
  searchByBody(
    @CurrentPrincipal() principal: Principal,
    @Req() request: Request,
    @ValidBody(SearchBody) body: SearchBody,
  ) {
    return this.jira.search(principal, baseOf(request), body);
  }

  @Post('issue')
  @HttpCode(201)
  createIssue(
    @CurrentPrincipal() principal: Principal,
    @Req() request: Request,
    @ValidBody(Write) body: Write,
  ) {
    return this.jira.create(principal, baseOf(request), body);
  }

  @Get('issue/:issue')
  getIssue(
    @CurrentPrincipal() principal: Principal,
    @Req() request: Request,
    @Param('issue') issue: string,
    @ValidQuery(IssueQuery) query: IssueQuery,
  ) {
    return this.jira.issue(principal, baseOf(request), issue, query.fields);
  }

  @Put('issue/:issue')
  @HttpCode(204)
  async editIssue(
    @CurrentPrincipal() principal: Principal,
    @Param('issue') issue: string,
    @ValidBody(Write) body: Write,
  ): Promise<void> {
    await this.jira.update(principal, issue, body);
  }

  @Get('issue/:issue/transitions')
  transitions(@CurrentPrincipal() principal: Principal, @Param('issue') issue: string) {
    return this.jira.transitions(principal, issue);
  }

  @Post('issue/:issue/transitions')
  @HttpCode(204)
  async transition(
    @CurrentPrincipal() principal: Principal,
    @Param('issue') issue: string,
    @ValidBody(TransitionWrite) body: TransitionWrite,
  ): Promise<void> {
    await this.jira.transition(principal, issue, body);
  }

  @Get('issue/:issue/comment')
  comments(
    @CurrentPrincipal() principal: Principal,
    @Req() request: Request,
    @Param('issue') issue: string,
    @ValidQuery(PageQuery) query: PageQuery,
  ) {
    return this.jira.comments(principal, baseOf(request), issue, query.startAt, query.maxResults);
  }

  @Post('issue/:issue/comment')
  @HttpCode(201)
  addComment(
    @CurrentPrincipal() principal: Principal,
    @Req() request: Request,
    @Param('issue') issue: string,
    @ValidBody(CommentBody) body: CommentBody,
  ) {
    return this.jira.addComment(principal, baseOf(request), issue, body.body);
  }

  @Get('project/:key')
  project(
    @CurrentPrincipal() principal: Principal,
    @Req() request: Request,
    @Param('key') key: string,
  ) {
    return this.jira.project(principal, baseOf(request), key);
  }

  @Get('issuetype')
  async issueTypes() {
    return (await this.jira.lists()).issueTypes;
  }

  @Get('priority')
  async priorities() {
    return (await this.jira.lists()).priorities;
  }

  @Get('resolution')
  async resolutions() {
    return (await this.jira.lists()).resolutions;
  }

  @Get('status')
  async statuses() {
    return (await this.jira.lists()).statuses;
  }
}
