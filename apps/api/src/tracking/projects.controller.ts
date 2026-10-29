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
} from '@nestjs/common';
import {
  Component,
  CreateComponentRequest,
  CreateProjectRequest,
  IssueList,
  ProjectDetails,
  ProjectSummary,
  UpdateComponentRequest,
  UserRef,
} from '@tasklore/shared';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { ComponentService } from './component.service.js';
import { IssueService } from './issue.service.js';
import { ProjectService } from './project.service.js';
import { ProjectAccessService } from './project-access.service.js';

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

const ProjectUsersQuery = z.object({
  query: z.string().max(100).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
type ProjectUsersQuery = z.infer<typeof ProjectUsersQuery>;

/** Unknown and malformed component ids are both "not found". */
const ComponentId = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

@Controller('projects')
export class ProjectsController {
  constructor(
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(IssueService) private readonly issues: IssueService,
    @Inject(ComponentService) private readonly components: ComponentService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
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

  @Endpoint({
    tag: 'Projects',
    summary: 'Find people who can work in the project',
    description:
      'For assignees and @-mentions: active users who may browse the project. Needs no global `browse-users`.',
    response: z.array(UserRef),
  })
  @Get(':key/users')
  async users(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidQuery(ProjectUsersQuery) query: ProjectUsersQuery,
  ): Promise<UserRef[]> {
    const project = await this.projects.findBrowsable(principal, key);
    await this.projectAccess.require(principal, project.id, 'browse');
    return this.projectAccess.browsingUsers(project.id, query.query.trim(), query.limit);
  }

  @Endpoint({
    tag: 'Projects',
    summary: 'List the components of a project',
    response: z.array(Component),
  })
  @Get(':key/components')
  listComponents(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<Component[]> {
    return this.components.list(principal, key);
  }

  @Endpoint({
    tag: 'Projects',
    summary: 'Create a component',
    description: 'Requires the project permission `administer`.',
    response: Component,
  })
  @Post(':key/components')
  @HttpCode(201)
  createComponent(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(CreateComponentRequest) body: CreateComponentRequest,
  ): Promise<Component> {
    return this.components.create(principal, key, body);
  }

  @Endpoint({
    tag: 'Projects',
    summary: 'Change a component',
    description: 'Requires the project permission `administer`.',
    response: Component,
  })
  @Patch(':key/components/:id')
  updateComponent(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Param('id', ComponentId) id: string,
    @ValidBody(UpdateComponentRequest) body: UpdateComponentRequest,
  ): Promise<Component> {
    return this.components.update(principal, key, id, body);
  }

  @Endpoint({
    tag: 'Projects',
    summary: 'Delete a component; issues lose it',
    description: 'Requires the project permission `administer`.',
  })
  @Delete(':key/components/:id')
  @HttpCode(204)
  deleteComponent(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Param('id', ComponentId) id: string,
  ): Promise<void> {
    return this.components.delete(principal, key, id);
  }
}
