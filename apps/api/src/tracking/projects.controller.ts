import { Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { CreateProjectRequest, IssueList, ProjectDetails, ProjectSummary } from '@tasklore/shared';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { IssueService } from './issue.service.js';
import { ProjectService } from './project.service.js';

const ListIssuesQuery = z.object({
  status: z.enum(['todo', 'in_progress', 'done', 'unresolved']).optional(),
  /** "me", "unassigned" or a user id. */
  assignee: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
type ListIssuesQuery = z.infer<typeof ListIssuesQuery>;

@Controller('projects')
export class ProjectsController {
  constructor(
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(IssueService) private readonly issues: IssueService,
  ) {}

  @Endpoint({
    tag: 'Projects',
    summary: 'List the projects the caller can see',
    response: z.array(ProjectSummary),
  })
  @Get()
  list(@CurrentPrincipal() principal: Principal): Promise<ProjectSummary[]> {
    return this.projects.list(principal);
  }

  @Endpoint({
    tag: 'Projects',
    summary: 'Create a project from a template',
    description:
      'Requires the global permission `create-projects`. The creator becomes project administrator.',
    response: ProjectDetails,
  })
  @Post()
  @HttpCode(201)
  create(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(CreateProjectRequest) body: CreateProjectRequest,
  ): Promise<ProjectDetails> {
    return this.projects.create(principal, body);
  }

  @Endpoint({
    tag: 'Projects',
    summary: 'Get a project with its issue types, statuses and the caller’s permissions',
    response: ProjectDetails,
  })
  @Get(':key')
  get(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<ProjectDetails> {
    return this.projects.details(principal, key);
  }

  @Endpoint({
    tag: 'Projects',
    summary: 'List the issues of a project in rank order',
    response: IssueList,
  })
  @Get(':key/issues')
  listIssues(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidQuery(ListIssuesQuery) query: ListIssuesQuery,
  ): Promise<IssueList> {
    return this.issues.list(principal, key, {
      statusCategory: query.status,
      assignee: query.assignee,
      issueType: query.type,
      query: query.q,
      limit: query.limit,
      offset: query.offset,
    });
  }
}
