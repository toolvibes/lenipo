import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  type AddServiceCustomerRequest,
  AUTOMATION_ACTOR_ID,
  CreateIssueRequest,
  type CreatePortalRequest,
  type InboundServiceRequest,
  type InboundServiceResponse,
  type InboundToken,
  type IssueSla,
  type PortalDesk,
  type PortalRequest,
  type PortalRequestDetail,
  type QueueEntry,
  type RequestType,
  type RichText,
  type SaveRequestTypeRequest,
  type ServiceDesk,
  type ServiceDeskSettings,
  type SlaMetric,
} from '@toolvibes/shared';
import { and, asc, count, desc, eq, gt, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  groupMembers,
  groups,
  issueChangeGroups,
  issueChangeItems,
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
import { constantTimeEquals, randomSecret, sha256 } from '../identity/secrets.js';
import { UserService } from '../identity/user.service.js';
import { emitIssueEvent } from '../notifications/events.js';
import { ProviderService } from '../operations/provider.service.js';
import { IssueService } from '../tracking/issue.service.js';
import { securityVisible } from '../tracking/issue-security.js';
import { ProjectService } from '../tracking/project.service.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';
import { mentionedUserIds, plainText } from '../tracking/rich-text.js';
import { WorkingTimeService } from '../tracking/working-time.service.js';
import { type BusinessHours, type Interval, workingMillis } from './sla.js';

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
  acceptUnknownSenders: false,
  allowedDomains: [],
};

/** New contact accounts per desk and hour, and requests per person and hour (E-168). */
const NEW_CONTACTS_PER_HOUR = 30;
const INBOUND_REQUESTS_PER_HOUR = 10;

/** Why a person without an account was not let in. */
export class ContactRefused extends HttpException {}

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
    @Inject(WorkingTimeService) private readonly workingTime: WorkingTimeService,
    @Inject(ProviderService) private readonly provider: ProviderService,
    @Inject(UserService) private readonly users: UserService,
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
      inbound: {
        path: `/api/v1/service-desk/inbound/${project.key}`,
        enabled: desk.inboundTokenHash !== null,
        tokenCreatedAt: desk.inboundTokenCreatedAt?.toISOString() ?? null,
      },
    };
  }

  /** Turns the project into a service desk, or changes its settings. */
  async save(
    principal: Principal,
    key: string,
    settings: ServiceDeskSettings,
  ): Promise<ServiceDesk> {
    const project = await this.administered(principal, key);
    // New service desks only where the plan includes them (TL-103).
    const [existing] = await this.database.db
      .select({ projectId: serviceDesks.projectId })
      .from(serviceDesks)
      .where(eq(serviceDesks.projectId, project.id));
    if (!existing) await this.provider.requireServiceDesk();
    const values = { ...settings };
    await this.database.db
      .insert(serviceDesks)
      .values({ projectId: project.id, ...values })
      .onConflictDoUpdate({ target: serviceDesks.projectId, set: values });
    return this.get(principal, key);
  }

  /** A new token for the inbound endpoint, shown once; the old one stops working at once. */
  async rotateInboundToken(principal: Principal, key: string): Promise<InboundToken> {
    const project = await this.administered(principal, key);
    if (!(await this.desk(project.id)))
      throw new NotFoundException('This project is no service desk');
    const secret = `sdin_${randomSecret()}`;
    await this.database.db
      .update(serviceDesks)
      .set({ inboundTokenHash: sha256(secret), inboundTokenCreatedAt: new Date() })
      .where(eq(serviceDesks.projectId, project.id));
    return { secret, path: `/api/v1/service-desk/inbound/${project.key}` };
  }

  async disableInbound(principal: Principal, key: string): Promise<void> {
    const project = await this.administered(principal, key);
    await this.database.db
      .update(serviceDesks)
      .set({ inboundTokenHash: null, inboundTokenCreatedAt: null })
      .where(eq(serviceDesks.projectId, project.id));
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

  // ---------------------------------------------------------------- people without an account

  /**
   * A request from another system (E-168): the token of the desk decides, the person is found by
   * email or gets a contact account. Missing desks and wrong tokens answer the same.
   */
  async inbound(
    key: string,
    secret: string,
    request: InboundServiceRequest,
  ): Promise<InboundServiceResponse> {
    const [row] = await this.database.db
      .select({ desk: serviceDesks, project: projects })
      .from(serviceDesks)
      .innerJoin(projects, eq(projects.id, serviceDesks.projectId))
      .where(
        and(
          eq(projects.key, key.toUpperCase()),
          isNull(projects.archivedAt),
          isNull(projects.deletedAt),
        ),
      );
    const hash = row?.desk.inboundTokenHash;
    if (!row || !hash || !secret || !constantTimeEquals(sha256(secret), hash)) {
      throw new UnauthorizedException('Unknown service desk or wrong token');
    }
    const userId = await this.contact(row.desk, request.email, request.name, 'inbound');
    const [recent] = await this.database.db
      .select({ value: count() })
      .from(issues)
      .where(
        and(
          eq(issues.projectId, row.project.id),
          eq(issues.reporterId, userId),
          gt(issues.createdAt, sql`now() - interval '1 hour'`),
        ),
      );
    if ((recent?.value ?? 0) >= INBOUND_REQUESTS_PER_HOUR) {
      throw new HttpException('Too many requests from this person', HttpStatus.TOO_MANY_REQUESTS);
    }
    const types = await this.requestTypes(row.project.id);
    const wanted = request.requestType?.toLowerCase();
    const type = wanted
      ? types.find(
          (entry) => entry.id === request.requestType || entry.name.toLowerCase() === wanted,
        )
      : types[0];
    if (!type) {
      throw new BadRequestException(
        wanted ? 'Unknown request type' : 'The service desk has no request types',
      );
    }
    // The person acts as a customer of this desk, like a sender of mail.
    const detail = await this.createRequest(
      { userId, via: 'mail', projectId: row.project.id },
      row.project.key,
      {
        requestTypeId: type.id,
        summary: request.summary,
        ...(request.description ? { description: { markdown: request.description } } : {}),
        ...(request.priority ? { priority: request.priority } : {}),
        ...(request.dueDate ? { dueDate: request.dueDate } : {}),
        ...(request.customFields ? { customFields: request.customFields } : {}),
      },
    );
    return { key: detail.key };
  }

  /** Whether the project is a service desk that lets mail of unknown senders in. */
  async acceptsUnknownSenders(projectId: string): Promise<boolean> {
    return (await this.desk(projectId))?.acceptUnknownSenders ?? false;
  }

  /**
   * Mail from an address without an account (E-168): a contact account if the desk lets unknown
   * senders in. The caller has checked SPF, DKIM or DMARC.
   */
  async contactForMail(
    projectId: string,
    email: string,
    name: string | undefined,
  ): Promise<string> {
    const desk = await this.desk(projectId);
    if (!desk?.acceptUnknownSenders) throw new ContactRefused('unknown-sender', 403);
    const domain = email.split('@').pop()?.toLowerCase() ?? '';
    if (desk.allowedDomains.length > 0 && !desk.allowedDomains.includes(domain)) {
      throw new ContactRefused('domain-not-allowed', 403);
    }
    return this.contact(desk, email, name, 'mail');
  }

  /**
   * The person behind an address, as a customer of the desk: an existing account (listed as a
   * customer if it may not use the desk yet), else a new external account without a password.
   */
  private async contact(
    desk: DeskRow,
    email: string,
    name: string | undefined,
    via: 'mail' | 'inbound',
  ): Promise<string> {
    const address = email.trim().toLowerCase();
    const [existing] = await this.database.db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(eq(users.email, address));
    if (existing) {
      if (existing.status !== 'active' || existing.id === AUTOMATION_ACTOR_ID) {
        throw new ForbiddenException('This person may not file requests');
      }
      if (!(await this.mayUse(existing.id, desk))) {
        await this.database.db
          .insert(serviceCustomers)
          .values({ id: uuidv7(), projectId: desk.projectId, userId: existing.id });
      }
      return existing.id;
    }
    const [created] = await this.database.db
      .select({ value: count() })
      .from(serviceCustomers)
      .innerJoin(users, eq(users.id, serviceCustomers.userId))
      .where(
        and(
          eq(serviceCustomers.projectId, desk.projectId),
          eq(users.external, true),
          gt(users.createdAt, sql`now() - interval '1 hour'`),
        ),
      );
    if ((created?.value ?? 0) >= NEW_CONTACTS_PER_HOUR) {
      throw via === 'mail'
        ? new ContactRefused('too-many-new-contacts', HttpStatus.TOO_MANY_REQUESTS)
        : new HttpException('Too many new people this hour', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.database.atomic(async () => {
      const id = await this.users.create({
        email: address,
        displayName: name?.trim() || address.split('@')[0] || address,
        passwordHash: null,
        groupNames: [],
        external: true,
      });
      await this.database.db
        .insert(serviceCustomers)
        .values({ id: uuidv7(), projectId: desk.projectId, userId: id });
      return id;
    });
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

  // ---------------------------------------------------------------- SLAs (agents)

  /** The SLA clocks of one request; null when the issue is no service desk request. */
  async sla(principal: Principal, key: string): Promise<IssueSla | null> {
    const issue = await this.issues.get(principal, key);
    const [row] = await this.database.db.select().from(issues).where(eq(issues.id, issue.id));
    if (!row?.requestTypeId) return null;
    const desk = await this.desk(row.projectId);
    if (!desk) return null;
    const [result] = await this.slas([row], desk, issue.priority.key);
    return result ?? null;
  }

  /** Open requests of the desk, the one closest to breaching first (TL-47, E-137). */
  async queue(principal: Principal, key: string): Promise<QueueEntry[]> {
    const project = await this.projects.findBrowsable(principal, key);
    const desk = await this.desk(project.id);
    if (!desk) throw new NotFoundException('This project is no service desk');
    const rows = await this.database.db
      .select({ issue: issues, requestTypeName: requestTypes.name })
      .from(issues)
      .innerJoin(requestTypes, eq(requestTypes.id, issues.requestTypeId))
      .innerJoin(statuses, eq(statuses.id, issues.statusId))
      .where(
        and(
          eq(issues.projectId, project.id),
          isNull(issues.deletedAt),
          sql`${statuses.category} <> 'done'`,
          securityVisible(principal.userId),
        ),
      )
      .orderBy(asc(issues.createdAt))
      .limit(500);
    if (rows.length === 0) return [];
    const summaries = new Map(
      (
        await this.issues.summarize(
          principal.userId,
          rows.map((row) => row.issue),
        )
      ).map((summary) => [summary.id, summary]),
    );
    const entries: QueueEntry[] = [];
    for (const row of rows) {
      const summary = summaries.get(row.issue.id);
      if (!summary) continue;
      const [sla] = await this.slas([row.issue], desk, summary.priority.key);
      entries.push({
        key: summary.key,
        summary: summary.summary,
        status: summary.status,
        requestType: row.requestTypeName,
        reporter: summary.reporter,
        assignee: summary.assignee,
        priority: summary.priority.name,
        createdAt: summary.createdAt,
        sla: sla ?? { firstResponse: null, resolution: null },
      });
    }
    const urgency = (entry: QueueEntry) =>
      Math.min(
        ...[entry.sla.firstResponse, entry.sla.resolution]
          .filter((metric): metric is SlaMetric => !!metric && !metric.stopped)
          .map((metric) => metric.remainingHours),
        Number.POSITIVE_INFINITY,
      );
    return entries.sort((a, b) => urgency(a) - urgency(b));
  }

  /** Clocks from creation to the first agent answer and to resolution, without pauses. */
  private async slas(
    rows: Array<typeof issues.$inferSelect>,
    desk: DeskRow,
    priorityKey: string,
  ): Promise<IssueSla[]> {
    const working = await this.workingTime.get();
    const hours: BusinessHours = {
      timeZone: desk.timeZone,
      dayStartHour: desk.dayStartHour,
      hoursPerDay: working.hoursPerDay,
      daysPerWeek: working.daysPerWeek,
    };
    const now = new Date();
    const targets = {
      first: (desk.firstResponseHours as Record<string, number>)[priorityKey],
      resolution: (desk.resolutionHours as Record<string, number>)[priorityKey],
    };
    const result: IssueSla[] = [];
    for (const row of rows) {
      const changes = await this.database.db
        .select({
          at: issueChangeGroups.createdAt,
          from: issueChangeItems.fromValue,
          to: issueChangeItems.toValue,
        })
        .from(issueChangeItems)
        .innerJoin(issueChangeGroups, eq(issueChangeGroups.id, issueChangeItems.groupId))
        .where(and(eq(issueChangeGroups.issueId, row.id), eq(issueChangeItems.field, 'status')))
        .orderBy(asc(issueChangeGroups.createdAt));
      // Status segments from creation until now; the paused ones rest the clocks.
      const paused: Interval[] = [];
      let status = changes[0]?.from ?? row.statusId;
      let since = row.createdAt;
      for (const change of changes) {
        if (status && desk.pauseStatusIds.includes(status))
          paused.push({ start: since, end: change.at });
        status = change.to ?? status;
        since = change.at;
      }
      const pausedNow = !!status && desk.pauseStatusIds.includes(status);
      if (pausedNow) paused.push({ start: since, end: now });
      const [answer] = await this.database.db
        .select({ at: issueComments.createdAt })
        .from(issueComments)
        .where(
          and(
            eq(issueComments.issueId, row.id),
            eq(issueComments.internal, false),
            isNull(issueComments.deletedAt),
            row.reporterId
              ? sql`${issueComments.authorId} is distinct from ${row.reporterId}`
              : undefined,
          ),
        )
        .orderBy(asc(issueComments.createdAt))
        .limit(1);
      const metric = (target: number | undefined, stop: Date | null): SlaMetric | null => {
        if (!target) return null;
        const elapsed = workingMillis(row.createdAt, stop ?? now, hours, paused) / 3_600_000;
        const round = (value: number) => Math.round(value * 100) / 100;
        return {
          targetHours: target,
          elapsedHours: round(elapsed),
          remainingHours: round(target - elapsed),
          breached: elapsed > target,
          stopped: stop !== null,
          paused: stop === null && pausedNow,
        };
      };
      result.push({
        firstResponse: metric(targets.first, answer?.at ?? null),
        resolution: metric(targets.resolution, row.resolvedAt ?? null),
      });
    }
    return result;
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
    acceptUnknownSenders: desk.acceptUnknownSenders,
    allowedDomains: desk.allowedDomains,
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
