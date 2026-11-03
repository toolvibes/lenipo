import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type AddServiceCustomerRequest,
  AUTOMATION_ACTOR_ID,
  CreateIssueRequest,
  type CreatePortalRequest,
  type PortalDesk,
  type PortalRequest,
  type PortalRequestDetail,
  type RequestType,
  type RichText,
  type SaveRequestTypeRequest,
  type ServiceDesk,
  type ServiceDeskSettings,
} from '@toolvibes/shared';
import { and, asc, desc, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  groupMembers,
  groups,
  issueComments,
  issues,
  issueTypes,
  issueWatchers,
  projects,
  requestTypes,
  serviceCustomers,
  serviceDesks,
  statuses,
  users,
} from '../db/schema/index.js';
import { emitIssueEvent } from '../notifications/events.js';
import { IssueService } from '../tracking/issue.service.js';
import { ProjectService } from '../tracking/project.service.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';
import { mentionedUserIds, plainText } from '../tracking/rich-text.js';

/** Portal requests are created by the system actor, on behalf of the customer (E-137). */
const PORTAL: Principal = { userId: AUTOMATION_ACTOR_ID, via: 'automation', ruleId: 'portal' };

const DEFAULTS: ServiceDeskSettings = {
  customerAccess: 'list',
  intro: '',
  firstResponseHours: {},
  resolutionHours: {},
  pauseStatusIds: [],
  timeZone: 'Europe/Berlin',
  dayStartHour: 9,
};

type DeskRow = typeof serviceDesks.$inferSelect;

/**
 * Service desk (TL-47, E-137): project administrators set it up; customers file and follow
 * their own requests in the portal, without any permission in the project itself.
 */
@Injectable()
export class ServiceDeskService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectAccessService) private readonly access: ProjectAccessService,
    @Inject(IssueService) private readonly issues: IssueService,
  ) {}

  // ---------------------------------------------------------------- setup (administer)

  private async administered(principal: Principal, key: string) {
    const project = await this.projects.findBrowsable(principal, key);
    await this.access.require(principal, project.id, 'administer');
    return project;
  }

  async get(principal: Principal, key: string): Promise<ServiceDesk> {
    const project = await this.administered(principal, key);
    const desk = await this.desk(project.id);
    if (!desk) throw new NotFoundException('This project is no service desk');
    return {
      settings: settingsOf(desk),
      requestTypes: await this.requestTypes(project.id),
      customers: await this.customers(project.id),
      portalPath: `/portal/${project.key}`,
    };
  }

  /** Turns the project into a service desk, or changes its settings. */
  async save(
    principal: Principal,
    key: string,
    settings: ServiceDeskSettings,
  ): Promise<ServiceDesk> {
    const project = await this.administered(principal, key);
    const values = { ...settings };
    await this.database.db
      .insert(serviceDesks)
      .values({ projectId: project.id, ...values })
      .onConflictDoUpdate({ target: serviceDesks.projectId, set: values });
    return this.get(principal, key);
  }

  async disable(principal: Principal, key: string): Promise<void> {
    const project = await this.administered(principal, key);
    await this.database.db.delete(serviceDesks).where(eq(serviceDesks.projectId, project.id));
  }

  async saveRequestType(
    principal: Principal,
    key: string,
    request: SaveRequestTypeRequest,
    id?: string,
  ): Promise<ServiceDesk> {
    const project = await this.administered(principal, key);
    if (!(await this.desk(project.id)))
      throw new NotFoundException('This project is no service desk');
    const [type] = await this.database.db
      .select({ id: issueTypes.id })
      .from(issueTypes)
      .where(eq(issueTypes.key, request.issueType));
    if (!type) throw new BadRequestException('Unknown issue type');
    const values = {
      name: request.name,
      description: request.description,
      issueTypeId: type.id,
      fields: request.fields,
    };
    if (id) {
      const [updated] = await this.database.db
        .update(requestTypes)
        .set(values)
        .where(and(eq(requestTypes.id, id), eq(requestTypes.projectId, project.id)))
        .returning({ id: requestTypes.id });
      if (!updated) throw new NotFoundException('Request type not found');
    } else {
      const [last] = await this.database.db
        .select({ position: requestTypes.position })
        .from(requestTypes)
        .where(eq(requestTypes.projectId, project.id))
        .orderBy(desc(requestTypes.position))
        .limit(1);
      await this.database.db.insert(requestTypes).values({
        id: uuidv7(),
        projectId: project.id,
        position: (last?.position ?? 0) + 1,
        ...values,
      });
    }
    return this.get(principal, key);
  }

  async removeRequestType(principal: Principal, key: string, id: string): Promise<void> {
    const project = await this.administered(principal, key);
    await this.database.db
      .delete(requestTypes)
      .where(and(eq(requestTypes.id, id), eq(requestTypes.projectId, project.id)));
  }

  async addCustomer(
    principal: Principal,
    key: string,
    request: AddServiceCustomerRequest,
  ): Promise<ServiceDesk> {
    const project = await this.administered(principal, key);
    if (!(await this.desk(project.id)))
      throw new NotFoundException('This project is no service desk');
    const userId = 'userId' in request ? request.userId : null;
    const groupId = 'groupId' in request ? request.groupId : null;
    const existing = await this.customers(project.id);
    if (existing.some((entry) => entry.user?.id === userId && entry.group?.id === groupId)) {
      throw new ConflictException('Already a customer');
    }
    await this.database.db
      .insert(serviceCustomers)
      .values({ id: uuidv7(), projectId: project.id, userId, groupId });
    return this.get(principal, key);
  }

  async removeCustomer(principal: Principal, key: string, id: string): Promise<void> {
    const project = await this.administered(principal, key);
    await this.database.db
      .delete(serviceCustomers)
      .where(and(eq(serviceCustomers.id, id), eq(serviceCustomers.projectId, project.id)));
  }

  // ---------------------------------------------------------------- portal (customers)

  /** The desks the caller may file requests in. */
  async portalDesks(principal: Principal): Promise<PortalDesk[]> {
    const rows = await this.database.db
      .select({ desk: serviceDesks, key: projects.key, name: projects.name })
      .from(serviceDesks)
      .innerJoin(projects, eq(projects.id, serviceDesks.projectId))
      .where(isNull(projects.archivedAt))
      .orderBy(asc(projects.name));
    const result: PortalDesk[] = [];
    for (const row of rows) {
      if (!(await this.mayUse(principal.userId, row.desk))) continue;
      result.push({
        key: row.key,
        name: row.name,
        intro: row.desk.intro,
        requestTypes: await this.requestTypes(row.desk.projectId),
      });
    }
    return result;
  }

  async portalDesk(principal: Principal, key: string): Promise<PortalDesk> {
    const { desk, project } = await this.usable(principal, key);
    return {
      key: project.key,
      name: project.name,
      intro: desk.intro,
      requestTypes: await this.requestTypes(project.id),
    };
  }

  async createRequest(
    principal: Principal,
    key: string,
    request: CreatePortalRequest,
  ): Promise<PortalRequestDetail> {
    const { project } = await this.usable(principal, key);
    const types = await this.requestTypes(project.id);
    const type = types.find((entry) => entry.id === request.requestTypeId);
    if (!type) throw new BadRequestException('Unknown request type');
    // Only the fields the request type asks for reach the issue.
    const asks = new Set(type.fields);
    const customFields = Object.fromEntries(
      Object.entries(request.customFields ?? {}).filter(([field]) => asks.has(field)),
    );
    const issue = await this.issues.create(
      PORTAL,
      CreateIssueRequest.parse({
        projectKey: project.key,
        issueType: type.issueType.key,
        summary: request.summary,
        ...(request.description ? { description: request.description } : {}),
        ...(asks.has('priority') && request.priority ? { priority: request.priority } : {}),
        ...(asks.has('dueDate') && request.dueDate ? { dueDate: request.dueDate } : {}),
        ...(Object.keys(customFields).length > 0 ? { customFields } : {}),
      }),
      { reporterId: principal.userId, requestTypeId: type.id },
    );
    return this.request(principal, issue.key);
  }

  /** The caller's own requests in every service desk, newest first. */
  async myRequests(principal: Principal): Promise<PortalRequest[]> {
    const rows = await this.requestRows(principal.userId);
    return rows.map(presentRequest);
  }

  async request(principal: Principal, key: string): Promise<PortalRequestDetail> {
    const [row] = await this.requestRows(principal.userId, key.toUpperCase());
    if (!row) throw new NotFoundException('Request not found');
    const comments = await this.database.db
      .select({ comment: issueComments, authorName: users.displayName })
      .from(issueComments)
      .leftJoin(users, eq(users.id, issueComments.authorId))
      .where(
        and(
          eq(issueComments.issueId, row.issue.id),
          isNull(issueComments.deletedAt),
          eq(issueComments.internal, false),
        ),
      )
      .orderBy(asc(issueComments.createdAt));
    return {
      ...presentRequest(row),
      description: (row.issue.description as RichText | null) ?? null,
      comments: comments.map(({ comment, authorName }) => ({
        id: comment.id,
        author: comment.authorId ? { id: comment.authorId, displayName: authorName ?? '' } : null,
        body: comment.body as RichText,
        createdAt: comment.createdAt.toISOString(),
        fromAgent: comment.authorId !== row.issue.reporterId,
      })),
    };
  }

  /** A customer answers in the portal: a public comment by them. */
  async comment(
    principal: Principal,
    key: string,
    body: CreatePortalRequest['description'],
  ): Promise<PortalRequestDetail> {
    const [row] = await this.requestRows(principal.userId, key.toUpperCase());
    if (!row || !body) throw new NotFoundException('Request not found');
    const doc = await this.issues.richText(body, row.issue.projectId);
    const text = plainText(doc);
    if (!text) throw new BadRequestException('The comment is empty');
    const id = uuidv7();
    await this.database.db.transaction(async (tx) => {
      await tx.insert(issueComments).values({
        id,
        issueId: row.issue.id,
        authorId: principal.userId,
        body: doc,
        bodyText: text,
      });
      await tx.update(issues).set({ updatedAt: sql`now()` }).where(eq(issues.id, row.issue.id));
      await tx
        .insert(issueWatchers)
        .values({ issueId: row.issue.id, userId: principal.userId })
        .onConflictDoNothing();
      await emitIssueEvent(tx, row.issue.id, principal.userId, {
        type: 'issue.commented',
        commentId: id,
        excerpt: text.slice(0, 500),
        mentions: mentionedUserIds(doc),
        edited: false,
      });
    });
    return this.request(principal, key);
  }

  // ---------------------------------------------------------------- helpers

  private async desk(projectId: string): Promise<DeskRow | undefined> {
    const [desk] = await this.database.db
      .select()
      .from(serviceDesks)
      .where(eq(serviceDesks.projectId, projectId));
    return desk;
  }

  /** Everyone, listed customers, or people working in the project may use the portal. */
  private async mayUse(userId: string, desk: DeskRow): Promise<boolean> {
    if (desk.customerAccess === 'everyone') return true;
    const [listed] = await this.database.db
      .select({ id: serviceCustomers.id })
      .from(serviceCustomers)
      .where(
        and(
          eq(serviceCustomers.projectId, desk.projectId),
          or(
            eq(serviceCustomers.userId, userId),
            inArray(
              serviceCustomers.groupId,
              this.database.db
                .select({ id: groupMembers.groupId })
                .from(groupMembers)
                .where(eq(groupMembers.userId, userId)),
            ),
          ),
        ),
      )
      .limit(1);
    if (listed) return true;
    return (await this.access.permissions(userId, desk.projectId)).has('browse');
  }

  private async usable(principal: Principal, key: string) {
    const [row] = await this.database.db
      .select({ desk: serviceDesks, project: projects })
      .from(serviceDesks)
      .innerJoin(projects, eq(projects.id, serviceDesks.projectId))
      .where(and(eq(projects.key, key.toUpperCase()), isNull(projects.archivedAt)));
    // Desks one may not use look the same as missing ones.
    if (!row || !(await this.mayUse(principal.userId, row.desk))) {
      throw new NotFoundException('Service desk not found');
    }
    return row;
  }

  private async requestTypes(projectId: string): Promise<RequestType[]> {
    const rows = await this.database.db
      .select({ type: requestTypes, issueTypeKey: issueTypes.key, issueTypeName: issueTypes.name })
      .from(requestTypes)
      .innerJoin(issueTypes, eq(issueTypes.id, requestTypes.issueTypeId))
      .where(eq(requestTypes.projectId, projectId))
      .orderBy(asc(requestTypes.position));
    return rows.map((row) => ({
      id: row.type.id,
      name: row.type.name,
      description: row.type.description,
      issueType: { key: row.issueTypeKey, name: row.issueTypeName },
      fields: row.type.fields,
    }));
  }

  private async customers(projectId: string) {
    const rows = await this.database.db
      .select({
        id: serviceCustomers.id,
        userId: users.id,
        userName: users.displayName,
        groupId: groups.id,
        groupName: groups.name,
      })
      .from(serviceCustomers)
      .leftJoin(users, eq(users.id, serviceCustomers.userId))
      .leftJoin(groups, eq(groups.id, serviceCustomers.groupId))
      .where(eq(serviceCustomers.projectId, projectId))
      .orderBy(asc(users.displayName), asc(groups.name));
    return rows.map((row) => ({
      id: row.id,
      user: row.userId ? { id: row.userId, displayName: row.userName ?? '' } : null,
      group: row.groupId ? { id: row.groupId, name: row.groupName ?? '' } : null,
    }));
  }

  /** Requests the person filed through a portal, optionally one by key. */
  private requestRows(userId: string, key?: string) {
    return this.database.db
      .select({
        issue: issues,
        projectKey: projects.key,
        projectName: projects.name,
        status: statuses,
        requestTypeName: requestTypes.name,
      })
      .from(issues)
      .innerJoin(projects, eq(projects.id, issues.projectId))
      .innerJoin(statuses, eq(statuses.id, issues.statusId))
      .innerJoin(requestTypes, eq(requestTypes.id, issues.requestTypeId))
      .where(
        and(
          eq(issues.reporterId, userId),
          isNotNull(issues.requestTypeId),
          isNull(issues.deletedAt),
          key ? eq(issues.key, key) : undefined,
        ),
      )
      .orderBy(desc(issues.createdAt));
  }
}

function settingsOf(desk: DeskRow): ServiceDeskSettings {
  return {
    ...DEFAULTS,
    customerAccess: desk.customerAccess === 'everyone' ? 'everyone' : 'list',
    intro: desk.intro,
    firstResponseHours: desk.firstResponseHours as Record<string, number>,
    resolutionHours: desk.resolutionHours as Record<string, number>,
    pauseStatusIds: desk.pauseStatusIds,
    timeZone: desk.timeZone,
    dayStartHour: desk.dayStartHour,
  };
}

function presentRequest(row: {
  issue: typeof issues.$inferSelect;
  projectKey: string;
  projectName: string;
  status: typeof statuses.$inferSelect;
  requestTypeName: string;
}): PortalRequest {
  return {
    key: row.issue.key,
    summary: row.issue.summary,
    status: {
      id: row.status.id,
      key: row.status.key,
      name: row.status.name,
      category: row.status.category as PortalRequest['status']['category'],
    },
    requestType: row.requestTypeName,
    project: { key: row.projectKey, name: row.projectName },
    createdAt: row.issue.createdAt.toISOString(),
    updatedAt: row.issue.updatedAt.toISOString(),
  };
}
