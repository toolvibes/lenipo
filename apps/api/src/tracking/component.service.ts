import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  Component,
  ComponentRef,
  CreateComponentRequest,
  UpdateComponentRequest,
  UserRef,
} from '@tasklore/shared';
import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import { type DatabaseHandle, type Executor, isUniqueViolation } from '../db/client.js';
import { issueComponents, issues, projectComponents, users } from '../db/schema/index.js';
import { ProjectService } from './project.service.js';
import { ProjectAccessService } from './project-access.service.js';

type ComponentRow = typeof projectComponents.$inferSelect;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Project components (T-PRJ-06) with lead and default assignee (E-40). */
@Injectable()
export class ComponentService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
  ) {}

  private async present(rows: ComponentRow[]): Promise<Component[]> {
    if (rows.length === 0) return [];
    const db = this.database.db;
    const peopleIds = [
      ...new Set(
        rows.flatMap((row) => [row.leadId, row.defaultAssigneeId]).filter((id) => id !== null),
      ),
    ];
    const [people, counts] = await Promise.all([
      peopleIds.length > 0
        ? db
            .select({ id: users.id, displayName: users.displayName })
            .from(users)
            .where(inArray(users.id, peopleIds))
        : Promise.resolve([] as UserRef[]),
      db
        .select({ componentId: issueComponents.componentId, issues: count() })
        .from(issueComponents)
        .innerJoin(issues, eq(issues.id, issueComponents.issueId))
        .where(
          and(
            inArray(
              issueComponents.componentId,
              rows.map((row) => row.id),
            ),
            isNull(issues.deletedAt),
          ),
        )
        .groupBy(issueComponents.componentId),
    ]);
    const person = new Map(people.map((entry) => [entry.id, entry]));
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      lead: row.leadId ? (person.get(row.leadId) ?? null) : null,
      defaultAssignee: row.defaultAssigneeId ? (person.get(row.defaultAssigneeId) ?? null) : null,
      issueCount: counts.find((entry) => entry.componentId === row.id)?.issues ?? 0,
    }));
  }

  async list(principal: Principal, projectKey: string): Promise<Component[]> {
    const project = await this.projects.findBrowsable(principal, projectKey);
    await this.projectAccess.require(principal, project.id, 'browse');
    const rows = await this.database.db
      .select()
      .from(projectComponents)
      .where(eq(projectComponents.projectId, project.id))
      .orderBy(asc(sql`lower(${projectComponents.name})`));
    return this.present(rows);
  }

  /** Lead and default assignee must be able to work in the project. */
  private async requireMember(projectId: string, userId: string | null | undefined): Promise<void> {
    if (!userId) return;
    const [user] = await this.database.db
      .select({ status: users.status })
      .from(users)
      .where(eq(users.id, userId));
    if (
      user?.status !== 'active' ||
      !(await this.projectAccess.permissions(userId, projectId)).has('browse')
    ) {
      throw new BadRequestException('This person cannot work in the project');
    }
  }

  private async administered(principal: Principal, projectKey: string) {
    const project = await this.projects.findBrowsable(principal, projectKey);
    await this.projectAccess.require(principal, project.id, 'administer');
    return project;
  }

  async create(
    principal: Principal,
    projectKey: string,
    request: CreateComponentRequest,
  ): Promise<Component> {
    const project = await this.administered(principal, projectKey);
    await this.requireMember(project.id, request.leadId);
    await this.requireMember(project.id, request.defaultAssigneeId);
    const id = uuidv7();
    try {
      await this.database.db
        .insert(projectComponents)
        .values({ id, projectId: project.id, ...request });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `${project.key} already has a component named "${request.name}"`,
        );
      }
      throw error;
    }
    return this.get(project.id, id);
  }

  private async get(projectId: string, id: string): Promise<Component> {
    const rows = await this.database.db
      .select()
      .from(projectComponents)
      .where(and(eq(projectComponents.projectId, projectId), eq(projectComponents.id, id)));
    const [component] = await this.present(rows);
    if (!component) throw new NotFoundException('Component not found');
    return component;
  }

  async update(
    principal: Principal,
    projectKey: string,
    id: string,
    request: UpdateComponentRequest,
  ): Promise<Component> {
    const project = await this.administered(principal, projectKey);
    await this.get(project.id, id);
    await this.requireMember(project.id, request.leadId);
    await this.requireMember(project.id, request.defaultAssigneeId);
    try {
      await this.database.db
        .update(projectComponents)
        .set(request)
        .where(eq(projectComponents.id, id));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `${project.key} already has a component named "${request.name}"`,
        );
      }
      throw error;
    }
    return this.get(project.id, id);
  }

  /** Removes the component from every issue as well. */
  async delete(principal: Principal, projectKey: string, id: string): Promise<void> {
    const project = await this.administered(principal, projectKey);
    await this.get(project.id, id);
    await this.database.db.delete(projectComponents).where(eq(projectComponents.id, id));
  }

  /** Resolves component ids or names (case-insensitive) within a project; unknown ones fail. */
  async resolve(projectId: string, values: string[]): Promise<ComponentRow[]> {
    if (values.length === 0) return [];
    const rows = await this.database.db
      .select()
      .from(projectComponents)
      .where(eq(projectComponents.projectId, projectId));
    const found = new Map<string, ComponentRow>();
    for (const value of values) {
      const wanted = value.toLowerCase();
      const row = rows.find(
        (entry) => (UUID.test(value) && entry.id === wanted) || entry.name.toLowerCase() === wanted,
      );
      if (!row)
        throw new BadRequestException(`The component "${value}" does not exist in this project`);
      found.set(row.id, row);
    }
    return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Default assignee from the first component (by name) that has one and who can still work here. */
  async defaultAssignee(projectId: string, components: ComponentRow[]): Promise<string | null> {
    for (const component of components) {
      const candidate = component.defaultAssigneeId;
      if (!candidate) continue;
      const [user] = await this.database.db
        .select({ status: users.status })
        .from(users)
        .where(eq(users.id, candidate));
      if (
        user?.status === 'active' &&
        (await this.projectAccess.permissions(candidate, projectId)).has('browse')
      ) {
        return candidate;
      }
    }
    return null;
  }

  async refsFor(issueId: string, db: Executor = this.database.db): Promise<ComponentRef[]> {
    return db
      .select({ id: projectComponents.id, name: projectComponents.name })
      .from(issueComponents)
      .innerJoin(projectComponents, eq(projectComponents.id, issueComponents.componentId))
      .where(eq(issueComponents.issueId, issueId))
      .orderBy(asc(sql`lower(${projectComponents.name})`));
  }

  /** Components of many issues in one query, keyed by issue id. */
  async refsForMany(issueIds: string[]): Promise<Map<string, ComponentRef[]>> {
    const byIssue = new Map<string, ComponentRef[]>();
    if (issueIds.length === 0) return byIssue;
    const rows = await this.database.db
      .select({
        issueId: issueComponents.issueId,
        id: projectComponents.id,
        name: projectComponents.name,
      })
      .from(issueComponents)
      .innerJoin(projectComponents, eq(projectComponents.id, issueComponents.componentId))
      .where(inArray(issueComponents.issueId, issueIds))
      .orderBy(asc(sql`lower(${projectComponents.name})`));
    for (const { issueId, ...ref } of rows) {
      byIssue.set(issueId, [...(byIssue.get(issueId) ?? []), ref]);
    }
    return byIssue;
  }

  async replaceOnIssue(tx: Executor, issueId: string, componentIds: string[]): Promise<void> {
    await tx.delete(issueComponents).where(eq(issueComponents.issueId, issueId));
    if (componentIds.length > 0) {
      await tx
        .insert(issueComponents)
        .values(componentIds.map((componentId) => ({ issueId, componentId })));
    }
  }
}
