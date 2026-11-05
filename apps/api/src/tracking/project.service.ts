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
  ProjectFieldSetting,
  ProjectSummary,
  ProjectTemplate,
} from '@toolvibes/shared';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import { type DatabaseHandle, type Executor, isUniqueViolation } from '../db/client.js';
import {
  DEFAULT_NOTIFICATION_SCHEME_ID,
  DEFAULT_PERMISSION_SCHEME_ID,
  favourites,
  groups,
  issues,
  notificationSchemes,
  permissionSchemes,
  projectHiddenIssueTypes,
  projectRoleMembers,
  projects,
  projectTypeWorkflows,
  securityLevels,
  securitySchemes,
  users,
  workflowVersions,
} from '../db/schema/index.js';
import { USERS_GROUP } from '../identity/group.service.js';
import { builtInId, PROJECT_TEMPLATES } from './builtins.js';
import { CustomFieldService } from './custom-field.service.js';
import { MetaService } from './meta.service.js';
import { ProjectAccessService } from './project-access.service.js';
import { readDefinition, type WorkflowDefinition } from './workflow.js';

export type ProjectRow = typeof projects.$inferSelect;

/** Runs inside the transaction that creates a project (see ProjectService.onCreated). */
export type ProjectCreatedHook = (
  tx: Executor,
  project: { id: string; key: string; name: string; template: ProjectTemplate },
) => Promise<void>;

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

  private readonly createdHooks: ProjectCreatedHook[] = [];

  /**
   * Lets another module add rows to a project created here, in the same transaction, e.g. the
   * first board of a Scrum or Kanban project. The welcome steps add their own and skip these.
   */
  onCreated(hook: ProjectCreatedHook): void {
    this.createdHooks.push(hook);
  }

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
      await this.database.db.transaction(async (tx) => {
        await this.insertProject(tx, principal.userId, id, request);
        for (const hook of this.createdHooks) {
          await hook(tx, { id, key: request.key, name: request.name, template: request.template });
        }
      });
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
    const statusIds = await this.statusIds(project);
    const fieldConfig = await this.customFields.projectFieldConfig(project.id);
    const security = await this.projectLevels(project.id);
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
    const [notices] = await this.database.db
      .select({ id: notificationSchemes.id, name: notificationSchemes.name })
      .from(notificationSchemes)
      .where(
        eq(notificationSchemes.id, project.notificationSchemeId ?? DEFAULT_NOTIFICATION_SCHEME_ID),
      );
    return {
      ...this.summary(project, lead?.name ?? null, issueCount?.total ?? 0, !!favourite),
      permissionScheme: scheme ?? { id: DEFAULT_PERMISSION_SCHEME_ID, name: '' },
      notificationScheme: notices ?? { id: DEFAULT_NOTIFICATION_SCHEME_ID, name: '' },
      securityScheme: security.scheme,
      securityLevels: security.levels,
      securityDefaultLevelId: security.defaultLevelId,
      issueTypes: meta.issueTypes.filter((type) => !hidden.has(type.id)),
      statuses: statusIds.flatMap((statusId) => meta.status.get(statusId) ?? []),
      permissions: [...permissions].sort(),
      customFieldIds: fieldConfig.filter((entry) => !entry.hidden).map((entry) => entry.fieldId),
      customFieldSettings: fieldConfig,
    };
  }

  /** Switches custom fields on for a project, in this order (E-50); needs `administer`. */
  async setCustomFields(
    principal: Principal,
    key: string,
    fieldIds: string[],
    settings: Record<string, ProjectFieldSetting> = {},
  ) {
    const project = await this.findBrowsable(principal, key);
    await this.customFields.setProjectFields(principal, project.id, fieldIds, settings);
    return this.details(principal, key);
  }

  async hiddenIssueTypeIds(projectId: string): Promise<string[]> {
    const rows = await this.database.db
      .select({ id: projectHiddenIssueTypes.issueTypeId })
      .from(projectHiddenIssueTypes)
      .where(eq(projectHiddenIssueTypes.projectId, projectId));
    return rows.map((row) => row.id);
  }

  /** The levels a project's issues can take, and the default for new ones. */
  async projectLevels(projectId: string) {
    const [project] = await this.database.db
      .select({ schemeId: projects.securitySchemeId, name: securitySchemes.name })
      .from(projects)
      .leftJoin(securitySchemes, eq(securitySchemes.id, projects.securitySchemeId))
      .where(eq(projects.id, projectId));
    if (!project?.schemeId) return { scheme: null, levels: [], defaultLevelId: null };
    const levels = await this.database.db
      .select({
        id: securityLevels.id,
        name: securityLevels.name,
        isDefault: securityLevels.isDefault,
      })
      .from(securityLevels)
      .where(eq(securityLevels.schemeId, project.schemeId))
      .orderBy(asc(securityLevels.position));
    return {
      scheme: { id: project.schemeId, name: project.name ?? '' },
      levels: levels.map(({ id, name }) => ({ id, name })),
      defaultLevelId: levels.find((level) => level.isDefault)?.id ?? null,
    };
  }

  /** Workflow version by issue type, for the types with a workflow of their own (TL-76). */
  async typeWorkflows(projectId: string, db: Executor = this.database.db) {
    const rows = await db
      .select({
        issueTypeId: projectTypeWorkflows.issueTypeId,
        workflowVersionId: projectTypeWorkflows.workflowVersionId,
      })
      .from(projectTypeWorkflows)
      .where(eq(projectTypeWorkflows.projectId, projectId));
    return new Map(rows.map((row) => [row.issueTypeId, row.workflowVersionId]));
  }

  /** The workflow version new issues of a type get. */
  async workflowVersionFor(
    project: { id: string; workflowVersionId: string },
    issueTypeId: string,
  ): Promise<string> {
    const [row] = await this.database.db
      .select({ workflowVersionId: projectTypeWorkflows.workflowVersionId })
      .from(projectTypeWorkflows)
      .where(
        and(
          eq(projectTypeWorkflows.projectId, project.id),
          eq(projectTypeWorkflows.issueTypeId, issueTypeId),
        ),
      );
    return row?.workflowVersionId ?? project.workflowVersionId;
  }

  /** Every status of the project's workflows: the standard one's first, then the types'. */
  async statusIds(
    project: { id: string; workflowVersionId: string },
    db: Executor = this.database.db,
  ): Promise<string[]> {
    const versions = [
      project.workflowVersionId,
      ...(await this.typeWorkflows(project.id, db)).values(),
    ];
    const ids: string[] = [];
    for (const versionId of versions) {
      const [version] = await db
        .select({ definition: workflowVersions.definition })
        .from(workflowVersions)
        .where(eq(workflowVersions.id, versionId));
      for (const id of readDefinition(version?.definition ?? { statusIds: [], transitions: [] })
        .statusIds) {
        if (!ids.includes(id)) ids.push(id);
      }
    }
    return ids;
  }

  async workflow(versionId: string): Promise<WorkflowDefinition> {
    const [version] = await this.database.db
      .select({ definition: workflowVersions.definition })
      .from(workflowVersions)
      .where(eq(workflowVersions.id, versionId));
    if (!version) throw new Error(`Workflow version ${versionId} missing`);
    return readDefinition(version.definition);
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
