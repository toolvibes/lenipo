import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ChangeGroup,
  Comment,
  CreateCommentRequest,
  CreateIssueLinkRequest,
  CreateIssueRequest,
  CreateWorklogRequest,
  Issue,
  TrackingMeta,
  Transition,
  TransitionRequest,
  UpdateCommentRequest,
  UpdateIssueRequest,
  UpdateWorklogRequest,
  Worklog,
} from '@tasklore/shared';
import { z } from 'zod';
import type { AppConfig } from '../core/config.js';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { CONFIG } from '../core/tokens.js';
import { CustomFieldService } from './custom-field.service.js';
import { IssueService } from './issue.service.js';
import { MetaService } from './meta.service.js';
import { WorkingTimeService } from './working-time.service.js';
import { WorklogService } from './worklog.service.js';

/** Unknown and malformed ids of comments and links are both "not found". */
const ChildId = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

@Controller()
export class IssuesController {
  constructor(
    @Inject(IssueService) private readonly issues: IssueService,
    @Inject(MetaService) private readonly meta: MetaService,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(WorklogService) private readonly worklogs: WorklogService,
    @Inject(WorkingTimeService) private readonly workingTime: WorkingTimeService,
    @Inject(CustomFieldService) private readonly customFields: CustomFieldService,
  ) {}

  @Endpoint({
    tag: 'Issues',
    summary: 'List issue types, statuses, priorities, resolutions and link types',
    response: TrackingMeta,
  })
  @Get('tracking/meta')
  async trackingMeta(): Promise<TrackingMeta> {
    const { issueTypes, statuses, priorities, resolutions, linkTypes } = await this.meta.load();
    return {
      issueTypes,
      statuses,
      priorities,
      resolutions,
      linkTypes,
      attachmentMaxBytes: Math.floor(this.config.ATTACHMENT_MAX_MB * 1024 * 1024),
      workingTime: await this.workingTime.get(),
      customFields: await this.customFields.list(),
    };
  }

  @Endpoint({ tag: 'Issues', summary: 'Create an issue', response: Issue })
  @Post('issues')
  @HttpCode(201)
  create(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(CreateIssueRequest) body: CreateIssueRequest,
  ): Promise<Issue> {
    return this.issues.create(principal, body);
  }

  @Endpoint({ tag: 'Issues', summary: 'Get an issue by key', response: Issue })
  @Get('issues/:key')
  get(@CurrentPrincipal() principal: Principal, @Param('key') key: string): Promise<Issue> {
    return this.issues.get(principal, key);
  }

  @Endpoint({
    tag: 'Issues',
    summary: 'Change fields of an issue; every change is recorded in its history',
    response: Issue,
  })
  @Patch('issues/:key')
  update(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(UpdateIssueRequest) body: UpdateIssueRequest,
  ): Promise<Issue> {
    return this.issues.update(principal, key, body);
  }

  @Endpoint({
    tag: 'Issues',
    summary: 'List the workflow transitions available from the current status',
    response: z.array(Transition),
  })
  @Get('issues/:key/transitions')
  transitions(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<Transition[]> {
    return this.issues.transitions(principal, key);
  }

  @Endpoint({ tag: 'Issues', summary: 'Move an issue to another status', response: Issue })
  @Post('issues/:key/transitions')
  @HttpCode(200)
  transition(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(TransitionRequest) body: TransitionRequest,
  ): Promise<Issue> {
    return this.issues.transition(principal, key, body);
  }

  @Endpoint({ tag: 'Issues', summary: 'List the comments of an issue', response: z.array(Comment) })
  @Get('issues/:key/comments')
  comments(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<Comment[]> {
    return this.issues.comments(principal, key);
  }

  @Endpoint({ tag: 'Issues', summary: 'Add a comment to an issue', response: Comment })
  @Post('issues/:key/comments')
  @HttpCode(201)
  addComment(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(CreateCommentRequest) body: CreateCommentRequest,
  ): Promise<Comment> {
    return this.issues.addComment(principal, key, body);
  }

  @Endpoint({
    tag: 'Issues',
    summary: 'List the change history of an issue, newest first',
    response: z.array(ChangeGroup),
  })
  @Get('issues/:key/history')
  history(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<ChangeGroup[]> {
    return this.issues.history(principal, key);
  }

  @Endpoint({ tag: 'Issues', summary: 'Watch an issue' })
  @Put('issues/:key/watching')
  @HttpCode(204)
  watch(@CurrentPrincipal() principal: Principal, @Param('key') key: string): Promise<void> {
    return this.issues.setWatching(principal, key, true);
  }

  @Endpoint({ tag: 'Issues', summary: 'Stop watching an issue' })
  @Delete('issues/:key/watching')
  @HttpCode(204)
  unwatch(@CurrentPrincipal() principal: Principal, @Param('key') key: string): Promise<void> {
    return this.issues.setWatching(principal, key, false);
  }

  @Endpoint({
    tag: 'Issues',
    summary: 'Edit an own comment',
    response: Comment,
  })
  @Patch('issues/:key/comments/:commentId')
  updateComment(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Param('commentId', ChildId) commentId: string,
    @ValidBody(UpdateCommentRequest) body: UpdateCommentRequest,
  ): Promise<Comment> {
    return this.issues.updateComment(principal, key, commentId, body);
  }

  @Endpoint({
    tag: 'Issues',
    summary: 'Delete a comment (own, or any as project administrator)',
  })
  @Delete('issues/:key/comments/:commentId')
  @HttpCode(204)
  deleteComment(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Param('commentId', ChildId) commentId: string,
  ): Promise<void> {
    return this.issues.deleteComment(principal, key, commentId);
  }

  @Endpoint({
    tag: 'Issues',
    summary: 'Link the issue to another issue',
    description: 'Requires `edit-issues` on this issue and browse access to the other one.',
    response: Issue,
  })
  @Post('issues/:key/links')
  @HttpCode(201)
  addLink(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(CreateIssueLinkRequest) body: CreateIssueLinkRequest,
  ): Promise<Issue> {
    return this.issues.addLink(principal, key, body);
  }

  @Endpoint({ tag: 'Issues', summary: 'Remove a link' })
  @Delete('issues/:key/links/:linkId')
  @HttpCode(204)
  removeLink(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Param('linkId', ChildId) linkId: string,
  ): Promise<void> {
    return this.issues.removeLink(principal, key, linkId);
  }

  @Endpoint({
    tag: 'Issues',
    summary: 'List the work logged on an issue, newest first',
    response: z.array(Worklog),
  })
  @Get('issues/:key/worklogs')
  worklogList(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<Worklog[]> {
    return this.worklogs.list(principal, key);
  }

  @Endpoint({
    tag: 'Issues',
    summary: 'Log work on an issue',
    description:
      'Needs `edit-issues`. Durations like "1d 4h" use the instance’s working time (`workingTime` in /tracking/meta). The remaining estimate drops by the logged time unless `remaining` says otherwise.',
    response: Worklog,
  })
  @Post('issues/:key/worklogs')
  @HttpCode(201)
  logWork(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(CreateWorklogRequest) body: CreateWorklogRequest,
  ): Promise<Worklog> {
    return this.worklogs.create(principal, key, body);
  }

  @Endpoint({ tag: 'Issues', summary: 'Change an own worklog', response: Worklog })
  @Patch('issues/:key/worklogs/:worklogId')
  updateWorklog(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Param('worklogId', ChildId) worklogId: string,
    @ValidBody(UpdateWorklogRequest) body: UpdateWorklogRequest,
  ): Promise<Worklog> {
    return this.worklogs.update(principal, key, worklogId, body);
  }

  @Endpoint({
    tag: 'Issues',
    summary: 'Delete a worklog (own, or any as project administrator)',
  })
  @Delete('issues/:key/worklogs/:worklogId')
  @HttpCode(204)
  deleteWorklog(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Param('worklogId', ChildId) worklogId: string,
  ): Promise<void> {
    return this.worklogs.delete(principal, key, worklogId);
  }
}
