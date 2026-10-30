import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import type {
  ProjectWorkflow,
  PublishWorkflowRequest,
  StatusCategory,
  StatusInfo,
} from '@tasklore/shared';
import { and, count, eq, inArray, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle, Executor } from '../db/client.js';
import {
  boardColumnStatuses,
  boardColumns,
  boards,
  issues,
  projects,
  statuses,
  workflows,
  workflowVersions,
} from '../db/schema/index.js';
import { builtInId } from './builtins.js';
import { type Change, recordChanges } from './history.js';
import { MetaService } from './meta.service.js';
import { ProjectService } from './project.service.js';
import { ProjectAccessService } from './project-access.service.js';
import type { WorkflowDefinition, WorkflowTransition } from './workflow.js';

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
@Injectable()
export class WorkflowService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(MetaService) private readonly meta: MetaService,
  ) {}

  async get(principal: Principal, projectKey: string): Promise<ProjectWorkflow> {
    const project = await this.projects.findBrowsable(principal, projectKey);
    return this.present(project.id, project.workflowVersionId);
  }

  private async present(projectId: string, versionId: string): Promise<ProjectWorkflow> {
    const db = this.database.db;
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
    const definition = row.definition as WorkflowDefinition;
    const meta = await this.meta.load();
    const usage = await db
      .select({ statusId: issues.statusId, n: count() })
      .from(issues)
      // Deleted issues count too: they keep their status and must not keep a removed one.
      .where(eq(issues.projectId, projectId))
      .groupBy(issues.statusId);
    const free = isFree(definition);
    return {
      versionId,
      version: row.version,
      name: row.name,
      ownedByProject: row.projectId === projectId,
      mode: free ? 'free' : 'defined',
      statuses: definition.statusIds.flatMap((id) => meta.status.get(id) ?? []),
      initialStatusId: definition.initialStatusId,
      transitions: free ? [] : pairs(definition),
      usage: Object.fromEntries(usage.map((entry) => [entry.statusId, entry.n])),
      available: meta.statuses,
    };
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

    const versionId = await this.database.db.transaction(async (tx) => {
      // Locks the project row, so two publishes cannot both start from the same version.
      const [current] = await tx
        .select({ workflowVersionId: projects.workflowVersionId })
        .from(projects)
        .where(eq(projects.id, project.id))
        .for('update');
      if (current?.workflowVersionId !== request.baseVersionId) {
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
      const previous = base.definition as WorkflowDefinition;

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
              .where(and(eq(issues.projectId, project.id), inArray(issues.statusId, removed)));
      const unmapped = [...new Set(inUse.map((issue) => issue.statusId))].filter(
        (statusId) => request.migrate[statusId] === undefined,
      );
      if (unmapped.length > 0) {
        throw new BadRequestException(
          `Issues still use removed statuses: ${unmapped.map((id) => byId.get(id)?.name ?? id).join(', ')}`,
        );
      }

      // Copy on write: the first edit gives the project its own workflow.
      let workflowId = base.workflowId;
      let version = 1;
      if (base.projectId === project.id) {
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
          name: project.name,
          description: `Eigener Workflow des Projekts ${project.key}, abgeleitet von „${base.name}“`,
          projectId: project.id,
        });
      }
      const newVersionId = uuidv7();
      await tx
        .insert(workflowVersions)
        .values({ id: newVersionId, workflowId, version, definition });
      await tx
        .update(projects)
        .set({ workflowVersionId: newVersionId })
        .where(eq(projects.id, project.id));
      await tx
        .update(issues)
        .set({ workflowVersionId: newVersionId })
        .where(eq(issues.projectId, project.id));

      await this.migrateIssues(tx, principal, inUse, request, ids, byId);
      await this.adjustBoards(tx, project.id, previous.statusIds, ids, byId);
      return newVersionId;
    });
    this.meta.invalidate();
    return this.present(project.id, versionId);
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
      const base = { id: `to-${target?.key ?? to}`, name: target?.name ?? to, to };
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
    const meta = await this.meta.load();
    const done = meta.resolution.get(builtInId('resolution', 'done'));
    for (const issue of inUse) {
      const targetIndex = request.migrate[issue.statusId];
      const to = targetIndex === undefined ? undefined : byId.get(ids[targetIndex] as string);
      if (!to) throw new BadRequestException('A migration target is out of range');
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
