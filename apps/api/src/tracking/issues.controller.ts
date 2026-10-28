import { Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Put } from '@nestjs/common';
import {
  ChangeGroup,
  Comment,
  CreateCommentRequest,
  CreateIssueRequest,
  Issue,
  TrackingMeta,
  Transition,
  TransitionRequest,
  UpdateIssueRequest,
} from '@tasklore/shared';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { IssueService } from './issue.service.js';
import { MetaService } from './meta.service.js';

@Controller()
export class IssuesController {
  constructor(
    @Inject(IssueService) private readonly issues: IssueService,
    @Inject(MetaService) private readonly meta: MetaService,
  ) {}

  @Endpoint({
    tag: 'Issues',
    summary: 'List issue types, statuses, priorities and resolutions',
    response: TrackingMeta,
  })
  @Get('tracking/meta')
  async trackingMeta(): Promise<TrackingMeta> {
    const { issueTypes, statuses, priorities, resolutions } = await this.meta.load();
    return { issueTypes, statuses, priorities, resolutions };
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
}
