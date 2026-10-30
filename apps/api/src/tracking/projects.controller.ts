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
  AddProjectMemberRequest,
  Component,
  CreateComponentRequest,
  CreateProjectRequest,
  CreateVersionRequest,
  IssueList,
  ProjectCustomFieldsRequest,
  ProjectDetails,
  ProjectMember,
  ProjectSummary,
  ProjectWorkflow,
  PublishWorkflowRequest,
  ReleaseVersionRequest,
  Timeline,
  UpdateComponentRequest,
  UpdateVersionRequest,
  UserRef,
  Version,
} from '@tasklore/shared';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { ComponentService } from './component.service.js';
import { IssueService } from './issue.service.js';
import { ProjectService } from './project.service.js';
import { ProjectAccessService } from './project-access.service.js';
import { ProjectMemberService } from './project-member.service.js';
import { TimelineService } from './timeline.service.js';
import { VersionService } from './version.service.js';
import { WorkflowService } from './workflow.service.js';

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
    @Inject(VersionService) private readonly versions: VersionService,
    @Inject(TimelineService) private readonly timelines: TimelineService,
    @Inject(WorkflowService) private readonly workflows: WorkflowService,
    @Inject(ProjectMemberService) private readonly members: ProjectMemberService,
  ) {}

  @Endpoint({
    tag: 'Projects',
    summary: 'List the role assignments of a project',
    description:
      'People and groups per project role. Requires the project permission `administer`.',
    response: z.array(ProjectMember),
  })
  @Get(':key/members')
  listMembers(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<ProjectMember[]> {
    return this.members.list(principal, key);
  }

  @Endpoint({
    tag: 'Projects',
    summary: 'Give a user or group a role in a project',
    response: z.array(ProjectMember),
  })
  @Post(':key/members')
  @HttpCode(201)
  addMember(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(AddProjectMemberRequest) body: AddProjectMemberRequest,
  ): Promise<ProjectMember[]> {
    return this.members.add(principal, key, body);
  }

  @Endpoint({
    tag: 'Projects',
    summary: 'Remove a role assignment; the last administrator stays',
  })
  @Delete(':key/members/:id')
  @HttpCode(204)
  removeMember(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 404 })) id: string,
  ): Promise<void> {
    return this.members.remove(principal, key, id);
  }

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
    summary: 'Epics with their children and milestones for the timeline',
    description:
      'Bars use the start and due date; without them, epics cover their children and children their latest sprint (`derived`). Milestones are versions with a release date.',
    response: Timeline,
  })
  @Get(':key/timeline')
  timeline(@CurrentPrincipal() principal: Principal, @Param('key') key: string): Promise<Timeline> {
    return this.timelines.get(principal, key);
  }

  @Endpoint({
    tag: 'Workflows',
    summary: "The project's workflow for the editor",
    description:
      'Statuses in order, the initial status, allowed moves and how many issues use each status.',
    response: ProjectWorkflow,
  })
  @Get(':key/workflow')
  workflow(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<ProjectWorkflow> {
    return this.workflows.get(principal, key);
  }

  @Endpoint({
    tag: 'Workflows',
    summary: 'Publish a new version of the project workflow',
    description:
      'Needs project administration. The first edit gives the project its own copy of a shared workflow. All issues of the project move to the new version; issues on removed statuses take the status given in `migrate` (history entry, no notifications); boards of the project adjust their columns. Answers 409 when `baseVersionId` is no longer current.',
    response: ProjectWorkflow,
  })
  @Post(':key/workflow')
  @HttpCode(200)
  publishWorkflow(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(PublishWorkflowRequest) body: PublishWorkflowRequest,
  ): Promise<ProjectWorkflow> {
    return this.workflows.publish(principal, key, body);
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
    summary: 'List the versions of a project (unreleased first)',
    response: z.array(Version),
  })
  @Get(':key/versions')
  listVersions(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<Version[]> {
    return this.versions.list(principal, key);
  }

  @Endpoint({
    tag: 'Projects',
    summary: 'Create a version',
    description: 'Requires the project permission `administer` (E-57).',
    response: Version,
  })
  @Post(':key/versions')
  @HttpCode(201)
  createVersion(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(CreateVersionRequest) body: CreateVersionRequest,
  ): Promise<Version> {
    return this.versions.create(principal, key, body);
  }

  @Endpoint({
    tag: 'Projects',
    summary: 'Change, archive or unrelease a version',
    description: 'Requires the project permission `administer`.',
    response: Version,
  })
  @Patch(':key/versions/:id')
  updateVersion(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Param('id', ComponentId) id: string,
    @ValidBody(UpdateVersionRequest) body: UpdateVersionRequest,
  ): Promise<Version> {
    return this.versions.update(principal, key, id, body);
  }

  @Endpoint({
    tag: 'Projects',
    summary: 'Release a version',
    description:
      'Sets the release date (default today); `moveOpenTo` moves unfinished issues to another unreleased version (T-REL-03).',
    response: Version,
  })
  @Post(':key/versions/:id/release')
  @HttpCode(200)
  releaseVersion(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Param('id', ComponentId) id: string,
    @ValidBody(ReleaseVersionRequest) body: ReleaseVersionRequest,
  ): Promise<Version> {
    return this.versions.release(principal, key, id, body);
  }

  @Endpoint({ tag: 'Projects', summary: 'Delete an unused version (used ones are archived)' })
  @Delete(':key/versions/:id')
  @HttpCode(204)
  deleteVersion(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Param('id', ComponentId) id: string,
  ): Promise<void> {
    return this.versions.delete(principal, key, id);
  }

  @Endpoint({
    tag: 'Projects',
    summary: 'Choose the custom fields a project uses, in display order',
    description:
      'Requires the project permission `administer`. Values of fields switched off stay stored but are hidden (E-50).',
    response: ProjectDetails,
  })
  @Put(':key/custom-fields')
  setCustomFields(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(ProjectCustomFieldsRequest) body: ProjectCustomFieldsRequest,
  ): Promise<ProjectDetails> {
    return this.projects.setCustomFields(principal, key, body.fieldIds);
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
