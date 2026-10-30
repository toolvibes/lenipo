import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateProjectRequest,
  ProjectDetails,
  ProjectSummary,
  ProjectTemplate,
} from '@tasklore/shared';
import { and, count, eq, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import { type DatabaseHandle, type Executor, isUniqueViolation } from '../db/client.js';
import {
  DEFAULT_PERMISSION_SCHEME_ID,
  favourites,
  groups,
  issues,
  permissionSchemes,
  projectHiddenIssueTypes,
  projectRoleMembers,
  projects,
  users,
  workflowVersions,
} from '../db/schema/index.js';
import { USERS_GROUP } from '../identity/group.service.js';
import { builtInId, PROJECT_TEMPLATES } from './builtins.js';
import { CustomFieldService } from './custom-field.service.js';
import { MetaService } from './meta.service.js';
import { ProjectAccessService } from './project-access.service.js';
import type { WorkflowDefinition } from './workflow.js';

export type ProjectRow = typeof projects.$inferSelect;

@Injectable()
export class ProjectService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(MetaService) private readonly meta: MetaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CustomFieldService) private readonly customFields: CustomFieldService,
  ) {}

  /** Creates a project from a template. The creator administers it; everyone in "users" may work in it. */
  async create(principal: Principal, request: CreateProjectRequest): Promise<ProjectDetails> {
    if ('scopes' in principal && !principal.scopes.includes('admin')) {
      throw new ForbiddenException('Creating projects with a token requires the admin scope');
    }
    if (!(await this.access.hasGlobal(principal.userId, 'create-projects'))) {
      throw new ForbiddenException('Requires the global permission "create-projects"');
    }
    const id = uuidv7();
    try {
      await this.database.db.transaction((tx) =>
        this.insertProject(tx, principal.userId, id, request),
      );
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException(`The project key "${request.key}" is already taken`);
      throw error;
    }
    await this.audit.record({
      action: 'project.created',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'project',
      targetId: id,
      details: { key: request.key, template: request.template },
    });
    return this.details(principal, request.key);
  }

  /**
   * The rows of a new project inside a transaction: the creator administers it, everyone in
   * "users" may work in it. Also used by the welcome steps (E-71).
   */
  async insertProject(tx: Executor, userId: string, id: string, request: CreateProjectRequest) {
    const template = PROJECT_TEMPLATES[request.template];
    await tx.insert(projects).values({
      id,
      key: request.key,
      name: request.name,
      description: request.description,
      template: request.template,
      leadId: userId,
      workflowVersionId: builtInId('workflow-version', `${template.workflow}:1`),
    });
    if (template.hiddenIssueTypes.length > 0) {
      await tx.insert(projectHiddenIssueTypes).values(
        template.hiddenIssueTypes.map((key) => ({
          projectId: id,
          issueTypeId: builtInId('issue-type', key),
        })),
      );
    }
    await tx.insert(projectRoleMembers).values({
      id: uuidv7(),
      projectId: id,
      role: 'administrators',
      userId,
    });
    const [everyone] = await tx
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.name, USERS_GROUP));
    if (everyone) {
      await tx
        .insert(projectRoleMembers)
        .values({ id: uuidv7(), projectId: id, role: 'users', groupId: everyone.id });
    }
  }

  async list(principal: Principal): Promise<ProjectSummary[]> {
    const rows = await this.database.db
      .select({
        project: projects,
        leadName: users.displayName,
        issueCount: sql<number>`(select count(*)::int from ${issues} where ${issues.projectId} = ${projects.id} and ${issues.deletedAt} is null)`,
        favourite: sql<boolean>`exists (select 1 from ${favourites} where ${favourites.userId} = ${principal.userId} and ${favourites.kind} = 'project' and ${favourites.targetId} = ${projects.id})`,
      })
      .from(projects)
      .leftJoin(users, eq(users.id, projects.leadId))
      .where(await this.projectAccess.browsableCondition(principal.userId))
      .orderBy(projects.name);
    return rows.map((row) =>
      this.summary(row.project, row.leadName, row.issueCount, row.favourite),
    );
  }

  /** Finds a project the principal may browse; otherwise 404. */
  async findBrowsable(principal: Principal, key: string): Promise<ProjectRow> {
    const [project] = await this.database.db
      .select()
      .from(projects)
      .where(eq(projects.key, key.toUpperCase()));
    if (!project || project.archivedAt) throw new NotFoundException('Project not found');
    await this.projectAccess.require(principal, project.id, 'browse');
    return project;
  }

  async details(principal: Principal, key: string): Promise<ProjectDetails> {
    const project = await this.findBrowsable(principal, key);
    const permissions = await this.projectAccess.permissions(principal.userId, project.id);
    const meta = await this.meta.load();
    const [lead] = project.leadId
      ? await this.database.db
          .select({ name: users.displayName })
          .from(users)
          .where(eq(users.id, project.leadId))
      : [];
    const [issueCount] = await this.database.db
      .select({ total: count() })
      .from(issues)
      .where(and(eq(issues.projectId, project.id), sql`${issues.deletedAt} is null`));
    const definition = await this.workflow(project.workflowVersionId);
    const hidden = new Set(await this.hiddenIssueTypeIds(project.id));
    const [favourite] = await this.database.db
      .select({ targetId: favourites.targetId })
      .from(favourites)
      .where(
        and(
          eq(favourites.userId, principal.userId),
          eq(favourites.kind, 'project'),
          eq(favourites.targetId, project.id),
        ),
      );
    const [scheme] = await this.database.db
      .select({ id: permissionSchemes.id, name: permissionSchemes.name })
      .from(permissionSchemes)
      .where(eq(permissionSchemes.id, project.permissionSchemeId ?? DEFAULT_PERMISSION_SCHEME_ID));
    return {
      ...this.summary(project, lead?.name ?? null, issueCount?.total ?? 0, !!favourite),
      permissionScheme: scheme ?? { id: DEFAULT_PERMISSION_SCHEME_ID, name: '' },
      issueTypes: meta.issueTypes.filter((type) => !hidden.has(type.id)),
      statuses: definition.statusIds.flatMap((statusId) => meta.status.get(statusId) ?? []),
      permissions: [...permissions].sort(),
      customFieldIds: await this.customFields.projectFieldIds(project.id),
    };
  }

  /** Switches custom fields on for a project, in this order (E-50); needs `administer`. */
  async setCustomFields(principal: Principal, key: string, fieldIds: string[]) {
    const project = await this.findBrowsable(principal, key);
    await this.customFields.setProjectFields(principal, project.id, fieldIds);
    return this.details(principal, key);
  }

  async hiddenIssueTypeIds(projectId: string): Promise<string[]> {
    const rows = await this.database.db
      .select({ id: projectHiddenIssueTypes.issueTypeId })
      .from(projectHiddenIssueTypes)
      .where(eq(projectHiddenIssueTypes.projectId, projectId));
    return rows.map((row) => row.id);
  }

  async workflow(versionId: string): Promise<WorkflowDefinition> {
    const [version] = await this.database.db
      .select({ definition: workflowVersions.definition })
      .from(workflowVersions)
      .where(eq(workflowVersions.id, versionId));
    if (!version) throw new Error(`Workflow version ${versionId} missing`);
    return version.definition as WorkflowDefinition;
  }

  private summary(
    project: ProjectRow,
    leadName: string | null,
    issueCount: number,
    favourite: boolean,
  ): ProjectSummary {
    return {
      id: project.id,
      key: project.key,
      name: project.name,
      description: project.description,
      template: project.template as ProjectTemplate,
      lead: project.leadId && leadName ? { id: project.leadId, displayName: leadName } : null,
      issueCount,
      createdAt: project.createdAt.toISOString(),
      favourite,
    };
  }
}
