import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { markdownToDoc, reviewMentions } from '@tasklore/editor';
import type {
  ChangeGroup,
  Comment,
  ComponentRef,
  CreateCommentRequest,
  CreateIssueLinkRequest,
  CreateIssueRequest,
  CustomFieldValue,
  Issue,
  IssueList,
  IssueSummary,
  ProjectPermission,
  RichText,
  RichTextInput,
  Transition,
  TransitionRequest,
  UpdateCommentRequest,
  UpdateIssueRequest,
  UserRef,
} from '@tasklore/shared';
import { formatDuration } from '@tasklore/tql';
import { and, asc, count, desc, eq, inArray, isNull, max, type SQL, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle, Executor } from '../db/client.js';
import {
  issueChangeGroups,
  issueChangeItems,
  issueComments,
  issues,
  issueWatchers,
  projects,
  users,
} from '../db/schema/index.js';
import { emitIssueEvent } from '../notifications/events.js';
import { builtInId } from './builtins.js';
import { ComponentService } from './component.service.js';
import { CustomFieldService, type StoredValues } from './custom-field.service.js';
import { durationSeconds } from './duration.js';
import { type Change, displayText, recordChanges } from './history.js';
import { LinkService } from './link.service.js';
import { type MetaIndex, MetaService } from './meta.service.js';
import { type ProjectRow, ProjectService } from './project.service.js';
import { ProjectAccessService } from './project-access.service.js';
import { rankBetween } from './rank.js';
import { mentionedUserIds, plainText } from './rich-text.js';
import { transitionsFrom } from './workflow.js';
import { WorkingTimeService } from './working-time.service.js';

/** Issue columns without the search vector, which only the database reads. */
type IssueRow = Omit<typeof issues.$inferSelect, 'searchVector'>;

interface SummaryContext {
  meta: MetaIndex;
  people: Map<string, UserRef>;
  components: Map<string, ComponentRef[]>;
  projects: Map<string, { key: string; name: string }>;
  rights: Map<string, Set<ProjectPermission>>;
  /** Shown custom field values by issue id (E-50). */
  custom: Map<string, Record<string, CustomFieldValue>>;
}

export interface IssueListFilter {
  statusCategory?: 'todo' | 'in_progress' | 'done' | 'unresolved';
  assignee?: string;
  issueType?: string;
  query?: string;
  limit: number;
  offset: number;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

@Injectable()
export class IssueService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(ProjectService) private readonly projectService: ProjectService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(MetaService) private readonly meta: MetaService,
    @Inject(ComponentService) private readonly components: ComponentService,
    @Inject(LinkService) private readonly links: LinkService,
    @Inject(WorkingTimeService) private readonly workingTime: WorkingTimeService,
    @Inject(CustomFieldService) private readonly customFields: CustomFieldService,
  ) {}

  // ---------------------------------------------------------------- reading

  /** Loads an issue for another tracking service, with the same permission rules. */
  authorize(principal: Principal, key: string, permission: ProjectPermission) {
    return this.load(principal, key, permission);
  }

  /** Loads an issue by key and checks the permission; unknown and invisible issues are both 404. */
  private async load(principal: Principal, key: string, permission: ProjectPermission) {
    const [row] = await this.database.db
      .select({ issue: issues, project: projects })
      .from(issues)
      .innerJoin(projects, eq(projects.id, issues.projectId))
      .where(and(eq(issues.key, key.toUpperCase()), isNull(issues.deletedAt)));
    if (!row || row.project.archivedAt) throw new NotFoundException('Issue not found');
    try {
      const permissions = await this.projectAccess.require(principal, row.project.id, permission);
      return { ...row, permissions };
    } catch (error) {
      if (error instanceof NotFoundException) throw new NotFoundException('Issue not found');
      throw error;
    }
  }

  private async userRefs(
    ids: Array<string | null>,
    db: Executor = this.database.db,
  ): Promise<Map<string, UserRef>> {
    const unique = [...new Set(ids.filter((id): id is string => id !== null))];
    if (unique.length === 0) return new Map();
    const rows = await db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(inArray(users.id, unique));
    return new Map(rows.map((row) => [row.id, row]));
  }

  private toSummary(row: IssueRow, context: SummaryContext): IssueSummary {
    const { meta, people, components } = context;
    const issueType = meta.issueType.get(row.issueTypeId);
    const status = meta.status.get(row.statusId);
    const priority = meta.priority.get(row.priorityId);
    const project = context.projects.get(row.projectId);
    if (!issueType || !status || !priority || !project)
      throw new Error(`Issue ${row.key} references unknown metadata`);
    const rights = context.rights.get(row.projectId) ?? new Set();
    return {
      id: row.id,
      key: row.key,
      project,
      summary: row.summary,
      issueType,
      status,
      priority,
      assignee: row.assigneeId ? (people.get(row.assigneeId) ?? null) : null,
      storyPoints: row.storyPoints,
      labels: row.labels,
      rank: row.rank,
      updatedAt: row.updatedAt.toISOString(),
      reporter: row.reporterId ? (people.get(row.reporterId) ?? null) : null,
      resolution: row.resolutionId ? (meta.resolution.get(row.resolutionId) ?? null) : null,
      dueDate: row.dueDate,
      createdAt: row.createdAt.toISOString(),
      components: components.get(row.id) ?? [],
      timeTracking: {
        originalEstimateSeconds: row.originalEstimateSeconds,
        remainingEstimateSeconds: row.remainingEstimateSeconds,
        timeSpentSeconds: row.timeSpentSeconds,
      },
      customFields: context.custom.get(row.id) ?? {},
      canEdit: rights.has('edit-issues'),
      canAssign: rights.has('assign-issues'),
      canTransition: rights.has('transition-issues'),
    };
  }

  /**
   * What summaries of these rows need, one query per kind; `viewer` decides the rights
   * flags (E-49), null (e.g. webhook payloads) has none.
   */
  private async summaryContext(viewer: string | null, rows: IssueRow[]): Promise<SummaryContext> {
    const projectIds = [...new Set(rows.map((row) => row.projectId))];
    const [meta, people, components, projectRows, rights, custom] = await Promise.all([
      this.meta.load(),
      this.userRefs(rows.flatMap((row) => [row.assigneeId, row.reporterId])),
      this.components.refsForMany(rows.map((row) => row.id)),
      projectIds.length > 0
        ? this.database.db
            .select({ id: projects.id, key: projects.key, name: projects.name })
            .from(projects)
            .where(inArray(projects.id, projectIds))
        : [],
      Promise.all(
        projectIds.map(
          async (id) =>
            [
              id,
              viewer
                ? await this.projectAccess.permissions(viewer, id)
                : new Set<ProjectPermission>(),
            ] as const,
        ),
      ),
      this.customFields.presentAll(
        rows.map((row) => ({ projectId: row.projectId, values: row.customFields as StoredValues })),
      ),
    ]);
    return {
      meta,
      people,
      components,
      projects: new Map(projectRows.map(({ id, ...project }) => [id, project])),
      rights: new Map(rights),
      custom: new Map(rows.map((row, index) => [row.id, custom[index] ?? {}])),
    };
  }

  /** Summaries of issue rows in their order, as `viewer` sees them. */
  async summarize(viewer: string | null, rows: IssueRow[]): Promise<IssueSummary[]> {
    const context = await this.summaryContext(viewer, rows);
    return rows.map((row) => this.toSummary(row, context));
  }

  async get(principal: Principal, key: string): Promise<Issue> {
    const { issue } = await this.load(principal, key, 'browse');
    return this.present(principal, issue.id);
  }

  /** Full issue representation, read fresh from the database. */
  private present(principal: Principal, issueId: string): Promise<Issue> {
    return this.presentFor(principal.userId, issueId);
  }

  /** The issue as the API shows it to administrators, e.g. for webhook payloads (E-45). */
  snapshot(issueId: string): Promise<Issue> {
    return this.presentFor(null, issueId);
  }

  /** `viewer` decides "watching" and which links show; null sees all links. */
  private async presentFor(viewer: string | null, issueId: string): Promise<Issue> {
    const db = this.database.db;
    const [issue] = await db.select().from(issues).where(eq(issues.id, issueId));
    if (!issue) throw new NotFoundException('Issue not found');
    const [parent] = issue.parentId
      ? await db
          .select({ key: issues.key, summary: issues.summary })
          .from(issues)
          .where(eq(issues.id, issue.parentId))
      : [];
    const children = await db
      .select()
      .from(issues)
      .where(and(eq(issues.parentId, issue.id), isNull(issues.deletedAt)))
      .orderBy(asc(issues.rank));
    const watchers = await db
      .select({ userId: issueWatchers.userId })
      .from(issueWatchers)
      .where(eq(issueWatchers.issueId, issue.id));
    const [context, links] = await Promise.all([
      this.summaryContext(viewer, [issue, ...children]),
      this.links.linksFor(viewer, issue.id),
    ]);
    return {
      ...this.toSummary(issue, context),
      description: (issue.description as RichText | null) ?? null,
      parent: parent ?? null,
      children: children.map((child) => this.toSummary(child, context)),
      resolvedAt: issue.resolvedAt?.toISOString() ?? null,
      watching: watchers.some((watcher) => watcher.userId === viewer),
      watcherCount: watchers.length,
      links,
    };
  }

  async list(
    principal: Principal,
    projectKey: string,
    filter: IssueListFilter,
  ): Promise<IssueList> {
    const project = await this.projectService.findBrowsable(principal, projectKey);
    const meta = await this.meta.load();
    const conditions: SQL[] = [eq(issues.projectId, project.id), isNull(issues.deletedAt)];
    if (filter.statusCategory) {
      const wanted =
        filter.statusCategory === 'unresolved'
          ? meta.statuses.filter((status) => status.category !== 'done')
          : meta.statuses.filter((status) => status.category === filter.statusCategory);
      conditions.push(
        inArray(
          issues.statusId,
          wanted.map((status) => status.id),
        ),
      );
    }
    if (filter.assignee === 'me') conditions.push(eq(issues.assigneeId, principal.userId));
    else if (filter.assignee === 'unassigned') conditions.push(isNull(issues.assigneeId));
    else if (filter.assignee) conditions.push(eq(issues.assigneeId, filter.assignee));
    if (filter.issueType) {
      const type = meta.issueTypes.find((entry) => entry.key === filter.issueType);
      conditions.push(eq(issues.issueTypeId, type?.id ?? builtInId('issue-type', '__none__')));
    }
    if (filter.query?.trim()) {
      const pattern = `%${escapeLike(filter.query.trim())}%`;
      conditions.push(sql`(${issues.summary} ilike ${pattern} or ${issues.key} ilike ${pattern})`);
    }
    const where = and(...conditions);
    const [rows, [total]] = await Promise.all([
      this.database.db
        .select()
        .from(issues)
        .where(where)
        .orderBy(asc(issues.rank), asc(issues.id))
        .limit(filter.limit)
        .offset(filter.offset),
      this.database.db.select({ total: count() }).from(issues).where(where),
    ]);
    return {
      issues: await this.summarize(principal.userId, rows),
      total: total?.total ?? 0,
    };
  }

  // ---------------------------------------------------------------- validation helpers

  private async requireAssignable(projectId: string, userId: string): Promise<UserRef> {
    const [user] = await this.database.db
      .select({ id: users.id, displayName: users.displayName, status: users.status })
      .from(users)
      .where(eq(users.id, userId));
    if (
      user?.status !== 'active' ||
      !(await this.projectAccess.permissions(userId, projectId)).has('browse')
    ) {
      throw new BadRequestException('The assignee cannot work in this project');
    }
    return { id: user.id, displayName: user.displayName };
  }

  private async visibleType(project: ProjectRow, key: string, meta: MetaIndex) {
    const type = meta.issueTypes.find((entry) => entry.key === key);
    const hidden = await this.projectService.hiddenIssueTypeIds(project.id);
    if (!type || hidden.includes(type.id)) {
      throw new BadRequestException(`The issue type "${key}" is not available in ${project.key}`);
    }
    return type;
  }

  private priorityByKey(meta: MetaIndex, key: string | undefined) {
    const priority = key ? meta.priorities.find((entry) => entry.key === key) : undefined;
    if (key && !priority) throw new BadRequestException(`Unknown priority "${key}"`);
    return (
      priority ?? meta.priorities.find((entry) => entry.key === 'medium') ?? meta.priorities[0]
    );
  }

  /** Parent rules: sub-tasks sit under standard issues, standard issues under epics. */
  /**
   * Rich text as stored: Markdown becomes a document (E-51). Mentions stay only for active
   * people who can see the project; `@email` finds them by address, others become text.
   */
  private async richText<T extends RichTextInput | null>(
    input: T,
    projectId: string,
  ): Promise<Exclude<T, { markdown: string }>> {
    // A document has `type: "doc"`; the Markdown form is the strict `{ markdown }` object.
    if (input === null || 'type' in input) return input as Exclude<T, { markdown: string }>;
    const { markdown } = input as { markdown: string };
    const doc = await reviewMentions(markdownToDoc(markdown), async ({ id, label }) => {
      const [person] = await this.database.db
        .select({ id: users.id, displayName: users.displayName, status: users.status })
        .from(users)
        .where(id ? eq(users.id, id) : eq(sql`lower(${users.email})`, label.toLowerCase()));
      if (person?.status !== 'active') return null;
      const visible = (await this.projectAccess.permissions(person.id, projectId)).has('browse');
      return visible ? { id: person.id, label: id ? label : person.displayName } : null;
    });
    return doc as Exclude<T, { markdown: string }>;
  }

  private async resolveParent(
    project: ProjectRow,
    childLevel: number,
    parentKey: string | null,
    meta: MetaIndex,
    selfId?: string,
  ) {
    if (parentKey === null) {
      if (childLevel < 0) throw new BadRequestException('A sub-task needs a parent issue');
      return null;
    }
    const [parent] = await this.database.db
      .select()
      .from(issues)
      .where(and(eq(issues.key, parentKey.toUpperCase()), isNull(issues.deletedAt)));
    if (!parent || parent.projectId !== project.id || parent.id === selfId) {
      throw new BadRequestException(`The parent issue "${parentKey}" is not in ${project.key}`);
    }
    const parentLevel = meta.issueType.get(parent.issueTypeId)?.hierarchyLevel;
    if (parentLevel !== childLevel + 1) {
      throw new BadRequestException(
        childLevel < 0
          ? 'A sub-task can only belong to a standard issue'
          : 'Only epics can be parents of standard issues',
      );
    }
    return parent;
  }

  // ---------------------------------------------------------------- writing

  async create(principal: Principal, input: CreateIssueRequest): Promise<Issue> {
    const project = await this.projectService.findBrowsable(principal, input.projectKey);
    const permissions = await this.projectAccess.require(principal, project.id, 'create-issues');
    const request = { ...input, description: await this.richText(input.description, project.id) };
    const meta = await this.meta.load();
    const type = await this.visibleType(project, request.issueType, meta);
    const priority = this.priorityByKey(meta, request.priority);
    if (!priority) throw new Error('No priorities configured');
    const parent = await this.resolveParent(project, type.hierarchyLevel, request.parentKey, meta);
    if (request.assigneeId) {
      if (request.assigneeId !== principal.userId && !permissions.has('assign-issues')) {
        throw new ForbiddenException('Requires the project permission "assign-issues"');
      }
      await this.requireAssignable(project.id, request.assigneeId);
    }
    const components = await this.components.resolve(project.id, request.components);
    // Without an explicit assignee, the components' default assignee takes over (E-40).
    const assigneeId =
      request.assigneeId ?? (await this.components.defaultAssignee(project.id, components));
    const workflow = await this.projectService.workflow(project.workflowVersionId);
    const custom = await this.customFields.apply(project.id, {}, request.customFields);
    const id = uuidv7();

    await this.database.db.transaction(async (tx) => {
      // The row lock on the project serializes numbering within a project.
      const [counter] = await tx
        .update(projects)
        .set({ issueCounter: sql`${projects.issueCounter} + 1` })
        .where(eq(projects.id, project.id))
        .returning({ number: projects.issueCounter });
      if (!counter) throw new Error('Project vanished during issue creation');
      const [last] = await tx.select({ rank: max(issues.rank) }).from(issues);
      await tx.insert(issues).values({
        id,
        projectId: project.id,
        number: counter.number,
        key: `${project.key}-${counter.number}`,
        issueTypeId: type.id,
        statusId: workflow.initialStatusId,
        workflowVersionId: project.workflowVersionId,
        priorityId: priority.id,
        summary: request.summary,
        description: request.description,
        descriptionText: plainText(request.description),
        assigneeId,
        reporterId: principal.userId,
        parentId: parent?.id ?? null,
        labels: [...new Set(request.labels)],
        storyPoints: request.storyPoints,
        dueDate: request.dueDate,
        customFields: custom.next,
        rank: rankBetween(last?.rank ?? null, null),
      });
      const watchers = [
        ...new Set([principal.userId, assigneeId].filter((user): user is string => !!user)),
      ];
      await tx.insert(issueWatchers).values(watchers.map((userId) => ({ issueId: id, userId })));
      await this.components.replaceOnIssue(
        tx,
        id,
        components.map((component) => component.id),
      );
      await emitIssueEvent(tx, id, principal.userId, {
        type: 'issue.created',
        mentions: mentionedUserIds(request.description),
      });
    });
    return this.present(principal, id);
  }

  async update(principal: Principal, key: string, request: UpdateIssueRequest): Promise<Issue> {
    // Jira semantics: editing fields needs edit-issues, changing the assignee needs assign-issues.
    const editsFields = Object.keys(request).some((field) => field !== 'assigneeId');
    const { issue, project, permissions } = await this.load(
      principal,
      key,
      editsFields ? 'edit-issues' : 'assign-issues',
    );
    const meta = await this.meta.load();
    if (request.description !== undefined) {
      request.description = await this.richText(request.description, issue.projectId);
    }
    const changes: Change[] = [];
    const patch: Partial<typeof issues.$inferInsert> = {};
    const track = (
      field: string,
      from: string | null,
      to: string | null,
      fromDisplay = from,
      toDisplay = to,
    ) => {
      if (from !== to)
        changes.push({
          field,
          fromValue: from,
          toValue: to,
          fromDisplay: displayText(fromDisplay),
          toDisplay: displayText(toDisplay),
        });
    };

    if (request.summary !== undefined) {
      track('summary', issue.summary, request.summary);
      patch.summary = request.summary;
    }
    if (request.description !== undefined) {
      const text = plainText(request.description);
      if (JSON.stringify(issue.description) !== JSON.stringify(request.description)) {
        changes.push({
          field: 'description',
          fromValue: null,
          toValue: null,
          fromDisplay: displayText(issue.descriptionText),
          toDisplay: displayText(text),
        });
      }
      patch.description = request.description;
      patch.descriptionText = text;
    }
    if (request.issueType !== undefined) {
      const type = await this.visibleType(project, request.issueType, meta);
      const current = meta.issueType.get(issue.issueTypeId);
      if (type.hierarchyLevel !== current?.hierarchyLevel) {
        throw new BadRequestException(
          'The issue type can only change within the same hierarchy level',
        );
      }
      track('issuetype', issue.issueTypeId, type.id, current?.name ?? null, type.name);
      patch.issueTypeId = type.id;
    }
    if (request.priority !== undefined) {
      const priority = this.priorityByKey(meta, request.priority);
      if (priority) {
        track(
          'priority',
          issue.priorityId,
          priority.id,
          meta.priority.get(issue.priorityId)?.name ?? null,
          priority.name,
        );
        patch.priorityId = priority.id;
      }
    }
    if (request.assigneeId !== undefined && request.assigneeId !== issue.assigneeId) {
      if (!permissions.has('assign-issues')) {
        throw new ForbiddenException('Requires the project permission "assign-issues"');
      }
      const next = request.assigneeId
        ? await this.requireAssignable(project.id, request.assigneeId)
        : null;
      const previous = (await this.userRefs([issue.assigneeId])).get(issue.assigneeId ?? '');
      track(
        'assignee',
        issue.assigneeId,
        next?.id ?? null,
        previous?.displayName ?? null,
        next?.displayName ?? null,
      );
      patch.assigneeId = next?.id ?? null;
    }
    if (request.parentKey !== undefined) {
      const level = meta.issueType.get(patch.issueTypeId ?? issue.issueTypeId)?.hierarchyLevel ?? 0;
      const parent = await this.resolveParent(project, level, request.parentKey, meta, issue.id);
      if ((parent?.id ?? null) !== issue.parentId) {
        const [previous] = issue.parentId
          ? await this.database.db
              .select({ key: issues.key })
              .from(issues)
              .where(eq(issues.id, issue.parentId))
          : [];
        track(
          'parent',
          issue.parentId,
          parent?.id ?? null,
          previous?.key ?? null,
          parent?.key ?? null,
        );
        patch.parentId = parent?.id ?? null;
      }
    }
    if (request.labels !== undefined) {
      const labels = [...new Set(request.labels)].sort();
      track('labels', [...issue.labels].sort().join(' ') || null, labels.join(' ') || null);
      patch.labels = labels;
    }
    if (request.storyPoints !== undefined) {
      track(
        'storyPoints',
        issue.storyPoints?.toString() ?? null,
        request.storyPoints?.toString() ?? null,
      );
      patch.storyPoints = request.storyPoints;
    }
    if (request.dueDate !== undefined) {
      track('dueDate', issue.dueDate, request.dueDate);
      patch.dueDate = request.dueDate;
    }
    // People mentioned in the new description but not in the old one get told (E-38, E-44).
    const newMentions =
      request.description !== undefined
        ? mentionedUserIds(request.description).filter(
            (id) => !mentionedUserIds(issue.description).includes(id),
          )
        : [];
    if (request.originalEstimate !== undefined || request.remainingEstimate !== undefined) {
      const time = await this.workingTime.get();
      const show = (seconds: number | null) =>
        seconds === null ? null : formatDuration(seconds, time);
      const parse = (text: string | null, field: string) =>
        text === null ? null : durationSeconds(text, time, field);
      if (request.originalEstimate !== undefined) {
        const next = parse(request.originalEstimate, 'originalEstimate');
        track(
          'originalEstimate',
          issue.originalEstimateSeconds?.toString() ?? null,
          next?.toString() ?? null,
          show(issue.originalEstimateSeconds),
          show(next),
        );
        patch.originalEstimateSeconds = next;
        // A first estimate also becomes the remaining estimate, as in Jira.
        if (
          request.remainingEstimate === undefined &&
          issue.remainingEstimateSeconds === null &&
          next !== null
        ) {
          track('remainingEstimate', null, next.toString(), null, show(next));
          patch.remainingEstimateSeconds = next;
        }
      }
      if (request.remainingEstimate !== undefined) {
        const next = parse(request.remainingEstimate, 'remainingEstimate');
        track(
          'remainingEstimate',
          issue.remainingEstimateSeconds?.toString() ?? null,
          next?.toString() ?? null,
          show(issue.remainingEstimateSeconds),
          show(next),
        );
        patch.remainingEstimateSeconds = next;
      }
    }
    if (request.customFields !== undefined) {
      const custom = await this.customFields.apply(
        project.id,
        issue.customFields as StoredValues,
        request.customFields,
      );
      changes.push(...custom.changes);
      patch.customFields = custom.next;
    }
    let componentIds: string[] | undefined;
    if (request.components !== undefined) {
      const next = await this.components.resolve(project.id, request.components);
      const current = await this.components.refsFor(issue.id);
      const names = (list: Array<{ name: string }>) =>
        list.map((component) => component.name).join(', ') || null;
      track('components', names(current), names(next));
      componentIds = next.map((component) => component.id);
    }

    if (changes.length > 0) {
      await this.database.db.transaction(async (tx) => {
        await tx
          .update(issues)
          .set({ ...patch, updatedAt: sql`now()` })
          .where(eq(issues.id, issue.id));
        if (componentIds) await this.components.replaceOnIssue(tx, issue.id, componentIds);
        await recordChanges(tx, issue.id, principal, changes, newMentions);
        if (patch.assigneeId) {
          await tx
            .insert(issueWatchers)
            .values({ issueId: issue.id, userId: patch.assigneeId })
            .onConflictDoNothing();
        }
      });
    }
    return this.present(principal, issue.id);
  }

  async transitions(principal: Principal, key: string): Promise<Transition[]> {
    const { issue } = await this.load(principal, key, 'browse');
    const meta = await this.meta.load();
    const definition = await this.projectService.workflow(issue.workflowVersionId);
    return transitionsFrom(definition, issue.statusId).flatMap((transition) => {
      const to = meta.status.get(transition.to);
      return to
        ? [{ id: transition.id, name: transition.name, to, setsResolution: to.category === 'done' }]
        : [];
    });
  }

  /** Moves an issue along its workflow. Entering a done status sets a resolution, leaving it clears it. */
  async transition(principal: Principal, key: string, request: TransitionRequest): Promise<Issue> {
    const { issue } = await this.load(principal, key, 'transition-issues');
    const meta = await this.meta.load();
    const definition = await this.projectService.workflow(issue.workflowVersionId);
    const transition = transitionsFrom(definition, issue.statusId).find(
      (entry) => entry.id === request.transitionId,
    );
    if (!transition)
      throw new BadRequestException('This transition is not available from the current status');
    const from = meta.status.get(issue.statusId);
    const to = meta.status.get(transition.to);
    if (!from || !to) throw new Error('Workflow references unknown statuses');

    const changes: Change[] = [
      {
        field: 'status',
        fromValue: from.id,
        fromDisplay: from.name,
        toValue: to.id,
        toDisplay: to.name,
      },
    ];
    const patch: Partial<typeof issues.$inferInsert> = { statusId: to.id };
    const previousResolution = issue.resolutionId
      ? meta.resolution.get(issue.resolutionId)
      : undefined;
    if (to.category === 'done') {
      const resolution = request.resolution
        ? meta.resolutions.find((entry) => entry.key === request.resolution)
        : meta.resolution.get(builtInId('resolution', 'done'));
      if (!resolution) throw new BadRequestException(`Unknown resolution "${request.resolution}"`);
      patch.resolutionId = resolution.id;
      patch.resolvedAt = new Date();
      if (resolution.id !== issue.resolutionId) {
        changes.push({
          field: 'resolution',
          fromValue: issue.resolutionId,
          fromDisplay: previousResolution?.name ?? null,
          toValue: resolution.id,
          toDisplay: resolution.name,
        });
      }
    } else if (issue.resolutionId) {
      patch.resolutionId = null;
      patch.resolvedAt = null;
      changes.push({
        field: 'resolution',
        fromValue: issue.resolutionId,
        fromDisplay: previousResolution?.name ?? null,
        toValue: null,
        toDisplay: null,
      });
    }
    await this.database.db.transaction(async (tx) => {
      await tx
        .update(issues)
        .set({ ...patch, updatedAt: sql`now()` })
        .where(eq(issues.id, issue.id));
      await recordChanges(tx, issue.id, principal, changes);
    });
    return this.present(principal, issue.id);
  }

  // ---------------------------------------------------------------- links

  async addLink(
    principal: Principal,
    key: string,
    request: CreateIssueLinkRequest,
  ): Promise<Issue> {
    const { issue } = await this.load(principal, key, 'edit-issues');
    await this.links.create(principal, issue, request);
    return this.present(principal, issue.id);
  }

  async removeLink(principal: Principal, key: string, linkId: string): Promise<void> {
    const { issue } = await this.load(principal, key, 'edit-issues');
    await this.links.delete(principal, issue, linkId);
  }

  // ---------------------------------------------------------------- comments

  /** Own comments may be edited and deleted; project administrators delete any (E-42). */
  private presentComment(
    row: typeof issueComments.$inferSelect,
    author: UserRef | null,
    principal: Principal,
    permissions: Set<ProjectPermission>,
  ): Comment {
    const own = row.authorId === principal.userId && permissions.has('comment');
    return {
      id: row.id,
      author,
      body: row.body as RichText,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      edited: row.updatedAt.getTime() !== row.createdAt.getTime(),
      canEdit: own,
      canDelete: own || permissions.has('administer'),
    };
  }

  async comments(principal: Principal, key: string): Promise<Comment[]> {
    const { issue, permissions } = await this.load(principal, key, 'browse');
    const rows = await this.database.db
      .select()
      .from(issueComments)
      .where(and(eq(issueComments.issueId, issue.id), isNull(issueComments.deletedAt)))
      .orderBy(asc(issueComments.createdAt));
    const people = await this.userRefs(rows.map((row) => row.authorId));
    return rows.map((row) =>
      this.presentComment(
        row,
        row.authorId ? (people.get(row.authorId) ?? null) : null,
        principal,
        permissions,
      ),
    );
  }

  private async loadComment(issueId: string, commentId: string) {
    const [row] = await this.database.db
      .select()
      .from(issueComments)
      .where(
        and(
          eq(issueComments.id, commentId),
          eq(issueComments.issueId, issueId),
          isNull(issueComments.deletedAt),
        ),
      );
    if (!row) throw new NotFoundException('Comment not found');
    return row;
  }

  async updateComment(
    principal: Principal,
    key: string,
    commentId: string,
    input: UpdateCommentRequest,
  ): Promise<Comment> {
    const { issue, permissions } = await this.load(principal, key, 'comment');
    const request = { body: await this.richText(input.body, issue.projectId) };
    const row = await this.loadComment(issue.id, commentId);
    if (row.authorId !== principal.userId) {
      throw new ForbiddenException('Only the author can edit this comment');
    }
    const text = plainText(request.body);
    if (!text) throw new BadRequestException('The comment is empty');
    const added = mentionedUserIds(request.body).filter(
      (id) => !mentionedUserIds(row.body).includes(id),
    );
    const [updated] = await this.database.db.transaction(async (tx) => {
      const result = await tx
        .update(issueComments)
        .set({ body: request.body, bodyText: text, updatedAt: sql`now()` })
        .where(eq(issueComments.id, row.id))
        .returning();
      // Every edit is an event (webhooks); notifications only go to people newly mentioned.
      await emitIssueEvent(tx, issue.id, principal.userId, {
        type: 'issue.commented',
        commentId: row.id,
        excerpt: text.slice(0, 500),
        mentions: added,
        edited: true,
      });
      return result;
    });
    if (!updated) throw new NotFoundException('Comment not found');
    const author = (await this.userRefs([principal.userId])).get(principal.userId) ?? null;
    return this.presentComment(updated, author, principal, permissions);
  }

  async deleteComment(principal: Principal, key: string, commentId: string): Promise<void> {
    const { issue, permissions } = await this.load(principal, key, 'comment');
    const row = await this.loadComment(issue.id, commentId);
    if (row.authorId !== principal.userId && !permissions.has('administer')) {
      throw new ForbiddenException(
        'Only the author or a project administrator can delete this comment',
      );
    }
    await this.database.db.transaction(async (tx) => {
      await tx
        .update(issueComments)
        .set({ deletedAt: sql`now()` })
        .where(eq(issueComments.id, row.id));
      await emitIssueEvent(tx, issue.id, principal.userId, {
        type: 'issue.comment_deleted',
        commentId: row.id,
      });
    });
  }

  async addComment(
    principal: Principal,
    key: string,
    input: CreateCommentRequest,
  ): Promise<Comment> {
    const { issue } = await this.load(principal, key, 'comment');
    const request = { body: await this.richText(input.body, issue.projectId) };
    const text = plainText(request.body);
    if (!text) throw new BadRequestException('The comment is empty');
    const id = uuidv7();
    await this.database.db.transaction(async (tx) => {
      await tx.insert(issueComments).values({
        id,
        issueId: issue.id,
        authorId: principal.userId,
        body: request.body,
        bodyText: text,
      });
      await tx.update(issues).set({ updatedAt: sql`now()` }).where(eq(issues.id, issue.id));
      await tx
        .insert(issueWatchers)
        .values({ issueId: issue.id, userId: principal.userId })
        .onConflictDoNothing();
      await emitIssueEvent(tx, issue.id, principal.userId, {
        type: 'issue.commented',
        commentId: id,
        excerpt: text.slice(0, 500),
        mentions: mentionedUserIds(request.body),
        edited: false,
      });
    });
    const author = (await this.userRefs([principal.userId])).get(principal.userId) ?? null;
    const now = new Date().toISOString();
    return {
      id,
      author,
      body: request.body,
      createdAt: now,
      updatedAt: now,
      edited: false,
      canEdit: true,
      canDelete: true,
    };
  }

  async history(principal: Principal, key: string): Promise<ChangeGroup[]> {
    const { issue } = await this.load(principal, key, 'browse');
    const groupsRows = await this.database.db
      .select()
      .from(issueChangeGroups)
      .where(eq(issueChangeGroups.issueId, issue.id))
      .orderBy(desc(issueChangeGroups.createdAt), desc(issueChangeGroups.id));
    if (groupsRows.length === 0) return [];
    const items = await this.database.db
      .select()
      .from(issueChangeItems)
      .where(
        inArray(
          issueChangeItems.groupId,
          groupsRows.map((group) => group.id),
        ),
      )
      .orderBy(asc(issueChangeItems.id));
    const people = await this.userRefs(groupsRows.map((group) => group.authorId));
    return groupsRows.map((group) => ({
      id: group.id,
      author: group.authorId ? (people.get(group.authorId) ?? null) : null,
      via: group.via,
      createdAt: group.createdAt.toISOString(),
      items: items
        .filter((item) => item.groupId === group.id)
        .map((item) => ({ field: item.field, from: item.fromDisplay, to: item.toDisplay })),
    }));
  }

  async setWatching(principal: Principal, key: string, watching: boolean): Promise<void> {
    const { issue } = await this.load(principal, key, 'browse');
    if (watching) {
      await this.database.db
        .insert(issueWatchers)
        .values({ issueId: issue.id, userId: principal.userId })
        .onConflictDoNothing();
    } else {
      await this.database.db
        .delete(issueWatchers)
        .where(
          and(eq(issueWatchers.issueId, issue.id), eq(issueWatchers.userId, principal.userId)),
        );
    }
  }
}
