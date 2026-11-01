import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  type IssueTypeInfo,
  type ProjectWorkflow,
  PublishWorkflowRequest,
  type StatusCategory,
  type StatusInfo,
  TRANSITION_CLEARABLE,
  TRANSITION_FIELDS,
  type WorkflowDraft,
} from '@toolvibes/shared';
import { and, count, eq, inArray, notInArray, type SQL, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle, Executor } from '../db/client.js';
import {
  boardColumnStatuses,
  boardColumns,
  boards,
  customFields,
  issues,
  projects,
  projectTypeWorkflows,
  statuses,
  users,
  workflowDrafts,
  workflows,
  workflowVersions,
} from '../db/schema/index.js';
import { builtInId } from './builtins.js';
import { CustomFieldService } from './custom-field.service.js';
import { type Change, recordChanges } from './history.js';
import { MetaService } from './meta.service.js';
import { type ProjectRow, ProjectService } from './project.service.js';
import { ProjectAccessService } from './project-access.service.js';
import {
  hasRules,
  landingStatus,
  readDefinition,
  type WorkflowDefinition,
  type WorkflowTransition,
} from './workflow.js';

/** A readable, unique key for a new status, e.g. "code-review". */
function statusKey(name: string, taken: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'status';
  let key = base;
  for (let n = 2; taken.has(key); n += 1) key = `${base}-${n}`;
  return key;
}

/** "free" when every status is the target of a transition from everywhere (E-70). */
function isFree(definition: WorkflowDefinition): boolean {
  return definition.statusIds.every((statusId) =>
    definition.transitions.some((entry) => entry.from === '*' && entry.to === statusId),
  );
}

/** The allowed moves of a definition as pairs, never onto the same status. */
function pairs(definition: WorkflowDefinition): Array<{ from: string; to: string }> {
  const result = new Map<string, { from: string; to: string }>();
  for (const transition of definition.transitions) {
    const sources = transition.from === '*' ? definition.statusIds : transition.from;
    for (const from of sources) {
      if (from !== transition.to)
        result.set(`${from}>${transition.to}`, { from, to: transition.to });
    }
  }
  return [...result.values()];
}

/**
 * The project's workflow in the list editor (T-WF-02 P1, T-WF-09, E-70): reading it, and
 * publishing a new immutable version that the project's issues and boards move to at once.
 */
/** Drafts are kept per scope: '' for the standard workflow, else the issue type id. */
function scopeKey(scope: Scope): string {
  return scope.type?.id ?? '';
}

/** The workflow an edit is about (TL-76): the project's standard one, or an issue type's. */
interface Scope {
  type: IssueTypeInfo | null;
  versionId: string;
  /** False while the issue type uses the standard workflow. */
  own: boolean;
  /** Workflow version by issue type id, for the types with their own. */
  types: Map<string, string>;
}

@Injectable()
export class WorkflowService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(MetaService) private readonly meta: MetaService,
    @Inject(CustomFieldService) private readonly customFields: CustomFieldService,
  ) {}

  async get(
    principal: Principal,
    projectKey: string,
    issueTypeKey?: string,
  ): Promise<ProjectWorkflow> {
    const project = await this.projects.findBrowsable(principal, projectKey);
    return this.present(project, await this.scope(project, issueTypeKey));
  }

  /** Which workflow an edit is about: the standard one, or one issue type's (TL-76, E-87). */
  private async scope(
    project: Pick<ProjectRow, 'id' | 'workflowVersionId'>,
    issueTypeKey: string | undefined,
    db: Executor = this.database.db,
  ): Promise<Scope> {
    const types = await this.projects.typeWorkflows(project.id, db);
    if (!issueTypeKey)
      return { type: null, versionId: project.workflowVersionId, own: true, types };
    const type = (await this.meta.load()).issueTypes.find((entry) => entry.key === issueTypeKey);
    if (!type) throw new BadRequestException(`Unknown issue type "${issueTypeKey}"`);
    const versionId = types.get(type.id);
    return { type, versionId: versionId ?? project.workflowVersionId, own: !!versionId, types };
  }

  /** The project's issues a workflow applies to: those of the type, or of all other types. */
  private inScope(projectId: string, scope: Scope): SQL | undefined {
    if (scope.type)
      return and(eq(issues.projectId, projectId), eq(issues.issueTypeId, scope.type.id));
    const own = [...scope.types.keys()];
    return own.length === 0
      ? eq(issues.projectId, projectId)
      : and(eq(issues.projectId, projectId), notInArray(issues.issueTypeId, own));
  }

  private async present(
    project: Pick<ProjectRow, 'id' | 'workflowVersionId'>,
    scope: Scope,
  ): Promise<ProjectWorkflow> {
    const db = this.database.db;
    const versionId = scope.versionId;
    const [row] = await db
      .select({
        version: workflowVersions.version,
        definition: workflowVersions.definition,
        name: workflows.name,
        projectId: workflows.projectId,
      })
      .from(workflowVersions)
      .innerJoin(workflows, eq(workflows.id, workflowVersions.workflowId))
      .where(eq(workflowVersions.id, versionId));
    if (!row) throw new Error(`Workflow version ${versionId} missing`);
    const definition = readDefinition(row.definition);
    const meta = await this.meta.load();
    const usage = await db
      .select({ statusId: issues.statusId, n: count() })
      .from(issues)
      // Deleted issues count too: they keep their status and must not keep a removed one.
      .where(this.inScope(project.id, scope))
      .groupBy(issues.statusId);
    const free = isFree(definition);
    return {
      versionId,
      version: row.version,
      name: row.name,
      ownedByProject: row.projectId === project.id,
      issueType: scope.type?.key ?? null,
      inherited: !!scope.type && !scope.own,
      ownTypes: [...scope.types.keys()].flatMap((id) => meta.issueType.get(id)?.key ?? []),
      draft: await this.draft(project.id, scope),
      mode: free ? 'free' : 'defined',
      statuses: definition.statusIds.flatMap((id) => meta.status.get(id) ?? []),
      initialStatusId: definition.initialStatusId,
      transitions: free ? [] : pairs(definition),
      rules: Object.fromEntries(
        definition.transitions.flatMap((entry) => (entry.rules ? [[entry.to, entry.rules]] : [])),
      ),
      usage: Object.fromEntries(usage.map((entry) => [entry.statusId, entry.n])),
      available: meta.statuses,
    };
  }

  /** The saved draft of a scope (TL-77, E-88). */
  private async draft(projectId: string, scope: Scope): Promise<WorkflowDraft | null> {
    const [row] = await this.database.db
      .select({
        request: workflowDrafts.request,
        updatedAt: workflowDrafts.updatedAt,
        updatedById: users.id,
        updatedByName: users.displayName,
      })
      .from(workflowDrafts)
      .leftJoin(users, eq(users.id, workflowDrafts.updatedById))
      .where(
        and(eq(workflowDrafts.projectId, projectId), eq(workflowDrafts.scope, scopeKey(scope))),
      );
    if (!row) return null;
    const request = PublishWorkflowRequest.parse(row.request);
    return {
      request,
      updatedBy: row.updatedById
        ? { id: row.updatedById, displayName: row.updatedByName ?? '' }
        : null,
      updatedAt: row.updatedAt.toISOString(),
      stale: request.baseVersionId !== scope.versionId,
    };
  }

  /** Saves the shared draft of the workflow the request is about; nothing is published. */
  async saveDraft(
    principal: Principal,
    projectKey: string,
    request: PublishWorkflowRequest,
  ): Promise<WorkflowDraft> {
    const project = await this.projects.findBrowsable(principal, projectKey);
    await this.projectAccess.require(principal, project.id, 'administer');
    const scope = await this.scope(project, request.issueType);
    await this.database.db
      .insert(workflowDrafts)
      .values({
        projectId: project.id,
        scope: scopeKey(scope),
        request,
        updatedById: principal.userId,
      })
      .onConflictDoUpdate({
        target: [workflowDrafts.projectId, workflowDrafts.scope],
        set: { request, updatedById: principal.userId, updatedAt: sql`now()` },
      });
    return (await this.draft(project.id, scope)) as WorkflowDraft;
  }

  async discardDraft(principal: Principal, projectKey: string, issueTypeKey?: string) {
    const project = await this.projects.findBrowsable(principal, projectKey);
    await this.projectAccess.require(principal, project.id, 'administer');
    const scope = await this.scope(project, issueTypeKey);
    await this.database.db
      .delete(workflowDrafts)
      .where(
        and(eq(workflowDrafts.projectId, project.id), eq(workflowDrafts.scope, scopeKey(scope))),
      );
  }

  async publish(
    principal: Principal,
    projectKey: string,
    request: PublishWorkflowRequest,
  ): Promise<ProjectWorkflow> {
    const project = await this.projects.findBrowsable(principal, projectKey);
    await this.projectAccess.require(principal, project.id, 'administer');
    const count = request.statuses.length;
    const index = (value: number) => {
      if (value >= count) throw new BadRequestException('A status index is out of range');
      return value;
    };
    index(request.initial);
    for (const pair of request.transitions) {
      index(pair.from);
      index(pair.to);
    }
    await this.checkRequiredFields(request);
    await this.checkFieldActions(project.id, request);

    await this.database.db.transaction(async (tx) => {
      // Locks the project row, so two publishes cannot both start from the same version.
      const [current] = await tx
        .select({ workflowVersionId: projects.workflowVersionId })
        .from(projects)
        .where(eq(projects.id, project.id))
        .for('update');
      if (!current) throw new Error('Project vanished');
      const fresh = { id: project.id, workflowVersionId: current.workflowVersionId };
      const scope = await this.scope(fresh, request.issueType, tx);
      if (scope.versionId !== request.baseVersionId) {
        throw new ConflictException('The workflow changed meanwhile; reload and edit again');
      }
      const [base] = await tx
        .select({
          workflowId: workflowVersions.workflowId,
          definition: workflowVersions.definition,
          projectId: workflows.projectId,
          name: workflows.name,
        })
        .from(workflowVersions)
        .innerJoin(workflows, eq(workflows.id, workflowVersions.workflowId))
        .where(eq(workflowVersions.id, request.baseVersionId));
      if (!base) throw new Error('Base workflow version missing');
      const previous = readDefinition(base.definition);

      const ids = await this.resolveStatuses(tx, request.statuses);
      if (new Set(ids).size !== ids.length) {
        throw new BadRequestException('A status appears twice in the workflow');
      }
      const all = (await tx.select().from(statuses)) as Array<StatusInfo & { builtIn: boolean }>;
      const byId = new Map(all.map((entry) => [entry.id, entry]));
      const definition = this.definition(ids, request, byId);

      // Issues in statuses that are gone need a new home.
      const removed = previous.statusIds.filter((id) => !ids.includes(id));
      const inUse =
        removed.length === 0
          ? []
          : await tx
              .select({
                id: issues.id,
                statusId: issues.statusId,
                resolutionId: issues.resolutionId,
              })
              .from(issues)
              .where(and(this.inScope(project.id, scope), inArray(issues.statusId, removed)));
      const unmapped = [...new Set(inUse.map((issue) => issue.statusId))].filter(
        (statusId) => request.migrate[statusId] === undefined,
      );
      if (unmapped.length > 0) {
        throw new BadRequestException(
          `Issues still use removed statuses: ${unmapped.map((id) => byId.get(id)?.name ?? id).join(', ')}`,
        );
      }
      const before = await this.projects.statusIds(fresh, tx);

      // Copy on write: the first edit gives the project, or the issue type, its own workflow.
      let workflowId = base.workflowId;
      let version = 1;
      if (scope.type ? scope.own : base.projectId === project.id) {
        const [latest] = await tx
          .select({ version: sql<number>`max(${workflowVersions.version})` })
          .from(workflowVersions)
          .where(eq(workflowVersions.workflowId, workflowId));
        version = (latest?.version ?? 0) + 1;
      } else {
        workflowId = uuidv7();
        await tx.insert(workflows).values({
          id: workflowId,
          key: `project-${project.key.toLowerCase()}-${workflowId.slice(-8)}`,
          name: scope.type ? `${project.name} · ${scope.type.name}` : project.name,
          description: scope.type
            ? `Workflow für ${scope.type.name} im Projekt ${project.key}, abgeleitet von „${base.name}“`
            : `Eigener Workflow des Projekts ${project.key}, abgeleitet von „${base.name}“`,
          projectId: project.id,
        });
      }
      const newVersionId = uuidv7();
      await tx
        .insert(workflowVersions)
        .values({ id: newVersionId, workflowId, version, definition });
      if (scope.type) {
        await tx
          .insert(projectTypeWorkflows)
          .values({
            projectId: project.id,
            issueTypeId: scope.type.id,
            workflowVersionId: newVersionId,
          })
          .onConflictDoUpdate({
            target: [projectTypeWorkflows.projectId, projectTypeWorkflows.issueTypeId],
            set: { workflowVersionId: newVersionId },
          });
      } else {
        await tx
          .update(projects)
          .set({ workflowVersionId: newVersionId })
          .where(eq(projects.id, project.id));
      }
      await tx
        .update(issues)
        .set({ workflowVersionId: newVersionId })
        .where(this.inScope(project.id, scope));

      // The published edit is no draft any more.
      await tx
        .delete(workflowDrafts)
        .where(
          and(eq(workflowDrafts.projectId, project.id), eq(workflowDrafts.scope, scopeKey(scope))),
        );
      await this.migrateIssues(tx, principal, inUse, request, ids, byId);
      const after = await this.projects.statusIds(
        { id: project.id, workflowVersionId: scope.type ? fresh.workflowVersionId : newVersionId },
        tx,
      );
      await this.adjustBoards(tx, project.id, before, after, byId);
    });
    this.meta.invalidate();
    return this.get(principal, projectKey, request.issueType);
  }

  /**
   * The issue type goes back to the standard workflow (TL-76, E-87). Its issues keep their status
   * where the standard workflow has it, else take one of the same category or the initial status.
   */
  async useStandard(
    principal: Principal,
    projectKey: string,
    issueTypeKey: string,
  ): Promise<ProjectWorkflow> {
    const project = await this.projects.findBrowsable(principal, projectKey);
    await this.projectAccess.require(principal, project.id, 'administer');
    const meta = await this.meta.load();
    await this.database.db.transaction(async (tx) => {
      const [current] = await tx
        .select({ workflowVersionId: projects.workflowVersionId })
        .from(projects)
        .where(eq(projects.id, project.id))
        .for('update');
      if (!current) throw new Error('Project vanished');
      const fresh = { id: project.id, workflowVersionId: current.workflowVersionId };
      const scope = await this.scope(fresh, issueTypeKey, tx);
      if (!scope.type || !scope.own) {
        throw new BadRequestException('The issue type already uses the standard workflow');
      }
      const before = await this.projects.statusIds(fresh, tx);
      const moving = await tx
        .select({ id: issues.id, statusId: issues.statusId, resolutionId: issues.resolutionId })
        .from(issues)
        .where(this.inScope(project.id, scope));
      await tx
        .delete(workflowDrafts)
        .where(
          and(eq(workflowDrafts.projectId, project.id), eq(workflowDrafts.scope, scope.type.id)),
        );
      await tx
        .delete(projectTypeWorkflows)
        .where(
          and(
            eq(projectTypeWorkflows.projectId, project.id),
            eq(projectTypeWorkflows.issueTypeId, scope.type.id),
          ),
        );
      await tx
        .update(issues)
        .set({ workflowVersionId: fresh.workflowVersionId })
        .where(this.inScope(project.id, scope));
      const standard = await this.projects.workflow(fresh.workflowVersionId);
      const category = (id: string) => meta.status.get(id)?.category;
      await this.moveIssues(
        tx,
        principal,
        moving.flatMap((issue) => {
          const to = landingStatus(standard, issue.statusId, category);
          return to === issue.statusId ? [] : [{ ...issue, toId: to }];
        }),
        meta.status,
      );
      await this.adjustBoards(
        tx,
        project.id,
        before,
        await this.projects.statusIds(fresh, tx),
        meta.status,
      );
    });
    this.meta.invalidate();
    return this.get(principal, projectKey, issueTypeKey);
  }

  /** Required fields are system fields or custom fields that exist (TL-11). */
  private async checkRequiredFields(request: PublishWorkflowRequest) {
    const named = new Set(request.statuses.flatMap((entry) => entry.rules?.requiredFields ?? []));
    const custom = [...named].filter(
      (field) => !(TRANSITION_FIELDS as readonly string[]).includes(field),
    );
    if (custom.length === 0) return;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const found =
      custom.every((field) => uuid.test(field)) &&
      (
        await this.database.db
          .select({ id: customFields.id })
          .from(customFields)
          .where(inArray(customFields.id, custom))
      ).length === custom.length;
    if (!found) throw new BadRequestException('A required field does not exist');
  }

  /**
   * Field changes after a transition (TL-75): system fields can be cleared, labels also added or
   * removed, and custom fields of the project cleared or set to a value they accept.
   */
  private async checkFieldActions(projectId: string, request: PublishWorkflowRequest) {
    const label = /^\S{1,64}$/;
    for (const action of request.statuses.flatMap((entry) => entry.rules?.fieldActions ?? [])) {
      if (action.field === 'labels') {
        if (action.action === 'clear') continue;
        const valid =
          (action.action === 'add' || action.action === 'remove') &&
          typeof action.value === 'string' &&
          label.test(action.value);
        if (!valid)
          throw new BadRequestException('Labels are cleared, or one label added or removed');
      } else if ((TRANSITION_CLEARABLE as readonly string[]).includes(action.field)) {
        if (action.action !== 'clear') {
          throw new BadRequestException(`${action.field} can only be cleared`);
        }
      } else if (action.action === 'clear' || action.action === 'set') {
        if (action.action === 'set' && action.value === undefined) {
          throw new BadRequestException('A value to set is missing');
        }
        // Throws for fields the project does not use and for values the field does not accept.
        await this.customFields.apply(
          projectId,
          {},
          {
            [action.field]: action.action === 'clear' ? null : (action.value ?? null),
          },
        );
      } else {
        throw new BadRequestException(`Only labels can be added or removed`);
      }
    }
  }

  /** Existing statuses by id; new ones reuse a status of the same name or are created. */
  private async resolveStatuses(
    tx: Executor,
    entries: PublishWorkflowRequest['statuses'],
  ): Promise<string[]> {
    const existing = await tx.select().from(statuses);
    const byName = new Map(existing.map((entry) => [entry.name.toLowerCase(), entry.id]));
    const known = new Set(existing.map((entry) => entry.id));
    const keys = new Set(existing.map((entry) => entry.key));
    const ids: string[] = [];
    for (const entry of entries) {
      if (entry.id) {
        if (!known.has(entry.id)) throw new BadRequestException('Unknown status');
        ids.push(entry.id);
        continue;
      }
      const reused = byName.get(entry.name.toLowerCase());
      if (reused) {
        ids.push(reused);
        continue;
      }
      const id = uuidv7();
      const key = statusKey(entry.name, keys);
      keys.add(key);
      await tx
        .insert(statuses)
        .values({ id, key, name: entry.name, category: entry.category as StatusCategory });
      byName.set(entry.name.toLowerCase(), id);
      ids.push(id);
    }
    return ids;
  }

  /** The stored definition: one transition per target, from everywhere or from the chosen ones. */
  private definition(
    ids: string[],
    request: PublishWorkflowRequest,
    byId: Map<string, { key: string; name: string }>,
  ): WorkflowDefinition {
    const transitions = ids.flatMap((to, toIndex): WorkflowTransition[] => {
      const target = byId.get(to);
      const rules = request.statuses[toIndex]?.rules;
      const base = {
        id: `to-${target?.key ?? to}`,
        name: target?.name ?? to,
        to,
        ...(hasRules(rules) ? { rules } : {}),
      };
      if (request.mode === 'free') return [{ ...base, from: '*' as const }];
      const from = [
        ...new Set(
          request.transitions
            .filter((pair) => pair.to === toIndex && pair.from !== toIndex)
            .map((pair) => ids[pair.from] as string),
        ),
      ];
      return from.length > 0 ? [{ ...base, from }] : [];
    });
    return { statusIds: ids, initialStatusId: ids[request.initial] as string, transitions };
  }

  /** Issues on removed statuses take their mapped status, with history but no notifications. */
  private async migrateIssues(
    tx: Executor,
    principal: Principal,
    inUse: Array<{ id: string; statusId: string; resolutionId: string | null }>,
    request: PublishWorkflowRequest,
    ids: string[],
    byId: Map<string, StatusInfo>,
  ) {
    await this.moveIssues(
      tx,
      principal,
      inUse.map((issue) => {
        const targetIndex = request.migrate[issue.statusId];
        const toId = targetIndex === undefined ? undefined : ids[targetIndex];
        if (!toId || !byId.has(toId)) {
          throw new BadRequestException('A migration target is out of range');
        }
        return { ...issue, toId };
      }),
      byId,
    );
  }

  /** Moves issues to other statuses for a workflow change: history entry, no notifications. */
  private async moveIssues(
    tx: Executor,
    principal: Principal,
    moves: Array<{ id: string; statusId: string; resolutionId: string | null; toId: string }>,
    byId: Map<string, StatusInfo>,
  ) {
    const meta = await this.meta.load();
    const done = meta.resolution.get(builtInId('resolution', 'done'));
    for (const issue of moves) {
      const to = byId.get(issue.toId);
      if (!to) throw new Error('Unknown migration target');
      const from = byId.get(issue.statusId);
      const changes: Change[] = [
        {
          field: 'status',
          fromValue: issue.statusId,
          fromDisplay: from?.name ?? null,
          toValue: to.id,
          toDisplay: to.name,
        },
      ];
      const patch: Partial<typeof issues.$inferInsert> = { statusId: to.id };
      // Same rule as a transition: done statuses carry a resolution, others none.
      if (to.category === 'done' && !issue.resolutionId && done) {
        patch.resolutionId = done.id;
        patch.resolvedAt = new Date();
        changes.push({
          field: 'resolution',
          fromValue: null,
          fromDisplay: null,
          toValue: done.id,
          toDisplay: done.name,
        });
      } else if (to.category !== 'done' && issue.resolutionId) {
        patch.resolutionId = null;
        patch.resolvedAt = null;
        changes.push({
          field: 'resolution',
          fromValue: issue.resolutionId,
          fromDisplay: meta.resolution.get(issue.resolutionId)?.name ?? null,
          toValue: null,
          toDisplay: null,
        });
      }
      await tx
        .update(issues)
        .set({ ...patch, updatedAt: sql`now()` })
        .where(eq(issues.id, issue.id));
      await recordChanges(tx, issue.id, principal, changes, [], true);
    }
  }

  /**
   * Boards located in the project follow: removed statuses leave their columns, a new status
   * joins the last column holding a status of its category (or the last column).
   */
  private async adjustBoards(
    tx: Executor,
    projectId: string,
    before: string[],
    after: string[],
    byId: Map<string, StatusInfo>,
  ) {
    const removed = before.filter((id) => !after.includes(id));
    const added = after.filter((id) => !before.includes(id));
    if (removed.length === 0 && added.length === 0) return;
    const located = await tx
      .select({ id: boards.id })
      .from(boards)
      .where(eq(boards.projectId, projectId));
    for (const board of located) {
      if (removed.length > 0) {
        await tx
          .delete(boardColumnStatuses)
          .where(
            and(
              eq(boardColumnStatuses.boardId, board.id),
              inArray(boardColumnStatuses.statusId, removed),
            ),
          );
      }
      if (added.length === 0) continue;
      const columns = await tx
        .select({ id: boardColumns.id })
        .from(boardColumns)
        .where(eq(boardColumns.boardId, board.id))
        .orderBy(boardColumns.position);
      if (columns.length === 0) continue;
      const mapping = await tx
        .select()
        .from(boardColumnStatuses)
        .where(eq(boardColumnStatuses.boardId, board.id));
      const mapped = new Set(mapping.map((entry) => entry.statusId));
      for (const statusId of added) {
        if (mapped.has(statusId)) continue;
        const category = byId.get(statusId)?.category;
        const column =
          [...columns]
            .reverse()
            .find((entry) =>
              mapping.some(
                (row) => row.columnId === entry.id && byId.get(row.statusId)?.category === category,
              ),
            ) ?? columns.at(-1);
        if (!column) continue;
        const position = mapping.filter((row) => row.columnId === column.id).length;
        const row = { boardId: board.id, columnId: column.id, statusId, position };
        await tx.insert(boardColumnStatuses).values(row);
        mapping.push(row);
        mapped.add(statusId);
      }
    }
  }
}
