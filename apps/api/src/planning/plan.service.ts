import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ApplyScenarioResult,
  CreatePlanRequest,
  IssueSummary,
  Plan,
  PlanScenario,
  PlanSummary,
  PlanView,
  ScenarioChange,
  SetCapacityRequest,
  TimelineEpic,
  TimelineRow,
  UpdatePlanRequest,
} from '@toolvibes/shared';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AccessService } from '../access/access.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  issues,
  planCapacities,
  planProjects,
  planScenarioChanges,
  planScenarios,
  plans,
  projects,
  users,
} from '../db/schema/index.js';
import { SearchService } from '../search/search.service.js';
import { IssueService } from '../tracking/issue.service.js';
import { ProjectService } from '../tracking/project.service.js';
import { cover, ownSpan, TimelineService } from '../tracking/timeline.service.js';

type PlanRow = typeof plans.$inferSelect;

/** The month (its first day) an issue's work lands in: its due date, else its start date. */
function monthOf(issue: IssueSummary): string | null {
  const date = issue.dueDate ?? issue.startDate;
  return date ? `${date.slice(0, 7)}-01` : null;
}

/** An issue as the scenario would leave it. */
function changed(issue: IssueSummary, change: ScenarioChange | undefined): IssueSummary {
  return change ? { ...issue, ...change } : issue;
}

/**
 * Cross-project plans with capacity per project and month, and what-if scenarios that can be
 * applied to the real issues (T-RDM-03, T-RDM-04, TL-46, E-136).
 */
@Injectable()
export class PlanService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(IssueService) private readonly issues: IssueService,
    @Inject(TimelineService) private readonly timelines: TimelineService,
    @Inject(SearchService) private readonly search: SearchService,
  ) {}

  // ---------------------------------------------------------------- plans

  async list(principal: Principal): Promise<PlanSummary[]> {
    const rows = await this.database.db.select().from(plans).orderBy(asc(plans.name));
    return Promise.all(rows.map((row) => this.summary(principal, row)));
  }

  async get(principal: Principal, id: string): Promise<Plan> {
    const row = await this.row(id);
    return { ...(await this.summary(principal, row)), tql: row.tql };
  }

  async create(principal: Principal, request: CreatePlanRequest): Promise<Plan> {
    const projectIds = await this.projectIds(principal, request.projectKeys);
    if (request.tql.trim()) await this.search.compile(principal, request.tql);
    const id = uuidv7();
    await this.database.atomic(async () => {
      await this.database.db.insert(plans).values({
        id,
        name: request.name,
        description: request.description,
        tql: request.tql.trim(),
        ownerId: principal.userId,
      });
      await this.setProjects(id, projectIds);
    });
    return this.get(principal, id);
  }

  async update(principal: Principal, id: string, request: UpdatePlanRequest): Promise<Plan> {
    const row = await this.editable(principal, id);
    const projectIds = request.projectKeys
      ? await this.projectIds(principal, request.projectKeys)
      : null;
    if (request.tql?.trim()) await this.search.compile(principal, request.tql);
    await this.database.atomic(async () => {
      await this.database.db
        .update(plans)
        .set({
          ...(request.name !== undefined ? { name: request.name } : {}),
          ...(request.description !== undefined ? { description: request.description } : {}),
          ...(request.tql !== undefined ? { tql: request.tql.trim() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(plans.id, row.id));
      if (projectIds) await this.setProjects(row.id, projectIds);
    });
    return this.get(principal, id);
  }

  async remove(principal: Principal, id: string): Promise<void> {
    const row = await this.editable(principal, id);
    await this.database.db.delete(plans).where(eq(plans.id, row.id));
  }

  async setCapacity(principal: Principal, id: string, request: SetCapacityRequest): Promise<void> {
    const row = await this.editable(principal, id);
    const project = await this.projects.findBrowsable(principal, request.projectKey);
    const db = this.database.db;
    const key = and(
      eq(planCapacities.planId, row.id),
      eq(planCapacities.projectId, project.id),
      eq(planCapacities.month, request.month),
    );
    if (request.points === null) {
      await db.delete(planCapacities).where(key);
      return;
    }
    await db
      .insert(planCapacities)
      .values({
        planId: row.id,
        projectId: project.id,
        month: request.month,
        points: request.points,
      })
      .onConflictDoUpdate({
        target: [planCapacities.planId, planCapacities.projectId, planCapacities.month],
        set: { points: request.points },
      });
  }

  // ---------------------------------------------------------------- scenarios

  async createScenario(principal: Principal, id: string, name: string): Promise<PlanScenario> {
    const row = await this.editable(principal, id);
    const scenarioId = uuidv7();
    await this.database.db
      .insert(planScenarios)
      .values({ id: scenarioId, planId: row.id, name, createdById: principal.userId });
    return { id: scenarioId, name, changes: [] };
  }

  async removeScenario(principal: Principal, id: string, scenarioId: string): Promise<void> {
    const row = await this.editable(principal, id);
    await this.database.db
      .delete(planScenarios)
      .where(and(eq(planScenarios.id, scenarioId), eq(planScenarios.planId, row.id)));
  }

  /** Records what the scenario changes on an issue; an empty change removes it. */
  async setChange(
    principal: Principal,
    id: string,
    scenarioId: string,
    issueKey: string,
    change: ScenarioChange,
  ): Promise<PlanScenario> {
    const row = await this.editable(principal, id);
    const scenario = await this.scenario(row.id, scenarioId);
    const issue = await this.issues.get(principal, issueKey);
    const db = this.database.db;
    if (Object.keys(change).length === 0) {
      await db
        .delete(planScenarioChanges)
        .where(
          and(
            eq(planScenarioChanges.scenarioId, scenario.id),
            eq(planScenarioChanges.issueId, issue.id),
          ),
        );
    } else {
      await db
        .insert(planScenarioChanges)
        .values({
          scenarioId: scenario.id,
          issueId: issue.id,
          change,
          baseUpdatedAt: new Date(issue.updatedAt),
        })
        .onConflictDoUpdate({
          target: [planScenarioChanges.scenarioId, planScenarioChanges.issueId],
          set: { change },
        });
    }
    const [result] = await this.scenarios(principal, row.id, scenario.id);
    if (!result) throw new NotFoundException('Scenario not found');
    return result;
  }

  /**
   * Writes the scenario's changes into the issues, all or the given ones. Changes the caller may
   * not make, or to issues edited since, are skipped and named (E-136).
   */
  async apply(
    principal: Principal,
    id: string,
    scenarioId: string,
    issueKeys: string[] | undefined,
  ): Promise<ApplyScenarioResult> {
    const row = await this.editable(principal, id);
    const scenario = await this.scenario(row.id, scenarioId);
    const db = this.database.db;
    const changes = await db
      .select({
        issueId: planScenarioChanges.issueId,
        change: planScenarioChanges.change,
        base: planScenarioChanges.baseUpdatedAt,
        key: issues.key,
        updatedAt: issues.updatedAt,
        deletedAt: issues.deletedAt,
      })
      .from(planScenarioChanges)
      .innerJoin(issues, eq(issues.id, planScenarioChanges.issueId))
      .where(eq(planScenarioChanges.scenarioId, scenario.id));
    const wanted = issueKeys ? new Set(issueKeys.map((key) => key.toUpperCase())) : null;
    const result: ApplyScenarioResult = { applied: [], skipped: [] };
    for (const entry of changes) {
      if (wanted && !wanted.has(entry.key)) continue;
      if (entry.deletedAt) {
        result.skipped.push({ key: entry.key, reason: 'gone' });
        continue;
      }
      // Timestamps compare in SQL precision; a later edit means someone changed the issue.
      if (entry.updatedAt.getTime() - entry.base.getTime() > 1) {
        result.skipped.push({ key: entry.key, reason: 'changed' });
        continue;
      }
      try {
        await this.issues.update(principal, entry.key, entry.change as ScenarioChange);
      } catch (error) {
        if (error instanceof ForbiddenException || error instanceof NotFoundException) {
          result.skipped.push({ key: entry.key, reason: 'forbidden' });
          continue;
        }
        throw error;
      }
      await db
        .delete(planScenarioChanges)
        .where(
          and(
            eq(planScenarioChanges.scenarioId, scenario.id),
            eq(planScenarioChanges.issueId, entry.issueId),
          ),
        );
      result.applied.push(entry.key);
    }
    return result;
  }

  // ---------------------------------------------------------------- the view

  async view(principal: Principal, id: string, scenarioId: string | null): Promise<PlanView> {
    const plan = await this.get(principal, id);
    const scenarios = await this.scenarios(principal, plan.id);
    const scenario = scenarioId ? scenarios.find((entry) => entry.id === scenarioId) : null;
    if (scenarioId && !scenario) throw new NotFoundException('Scenario not found');
    const changes = new Map(scenario?.changes.map((entry) => [entry.key, entry.change]));
    const matching = plan.tql ? await this.matching(principal, plan) : null;

    const timelines = await Promise.all(
      plan.projects.map(async (project) => ({
        project,
        timeline: await this.timelines.get(principal, project.key),
      })),
    );
    const projectsView: PlanView['projects'] = timelines.map(({ project, timeline }) => ({
      key: project.key,
      name: project.name,
      epics: timeline.epics.flatMap((epic) => {
        const children = epic.children
          .filter((child) => !matching || matching.has(child.issue.id))
          .map((child) => this.withChange(child, changes.get(child.issue.key)));
        if (matching && !matching.has(epic.issue.id) && children.length === 0) return [];
        const issue = changed(epic.issue, changes.get(epic.issue.key));
        const own = ownSpan(issue);
        const derived = cover(children.flatMap((child) => (child.span ? [child.span] : [])));
        const result: TimelineEpic = {
          ...epic,
          issue,
          children,
          span: own ?? (derived ? { ...derived, derived: true } : null),
        };
        return [result];
      }),
    }));

    // Planned open points per project and month, against the capacity set for it.
    const capacityRows = await this.database.db
      .select({
        projectKey: projects.key,
        month: planCapacities.month,
        points: planCapacities.points,
      })
      .from(planCapacities)
      .innerJoin(projects, eq(projects.id, planCapacities.projectId))
      .where(eq(planCapacities.planId, plan.id));
    const cells = new Map<string, PlanView['capacity'][number]>();
    const cell = (projectKey: string, month: string) => {
      const key = `${projectKey}:${month}`;
      let entry = cells.get(key);
      if (!entry) {
        entry = { projectKey, month, capacity: null, planned: 0 };
        cells.set(key, entry);
      }
      return entry;
    };
    const visible = new Set(plan.projects.map((project) => project.key));
    for (const row of capacityRows) {
      if (visible.has(row.projectKey)) cell(row.projectKey, row.month).capacity = row.points;
    }
    for (const project of projectsView) {
      for (const epic of project.epics) {
        for (const child of epic.children) {
          const month = monthOf(child.issue);
          if (!month || child.issue.status.category === 'done' || !child.issue.storyPoints)
            continue;
          cell(project.key, month).planned += child.issue.storyPoints;
        }
      }
    }
    const capacity = [...cells.values()].sort(
      (a, b) => a.projectKey.localeCompare(b.projectKey) || a.month.localeCompare(b.month),
    );
    return { plan, scenarios, scenarioId: scenario?.id ?? null, projects: projectsView, capacity };
  }

  // ---------------------------------------------------------------- helpers

  private withChange(row: TimelineRow, change: ScenarioChange | undefined): TimelineRow {
    if (!change) return row;
    const issue = changed(row.issue, change);
    return { issue, span: ownSpan(issue) ?? (row.span?.derived ? row.span : null) };
  }

  /** Ids of the plan's issues that match its TQL, as the caller may see them. */
  private async matching(principal: Principal, plan: Plan): Promise<Set<string>> {
    const keys = plan.projects.map((project) => project.key);
    if (keys.length === 0) return new Set();
    const compiled = await this.search.compile(
      principal,
      `project in (${keys.join(', ')}) AND (${plan.tql})`,
    );
    const rows = await this.database.db
      .select({ id: issues.id })
      .from(issues)
      .where(
        and(
          inArray(issues.projectId, compiled.projectIds),
          isNull(issues.deletedAt),
          compiled.where,
        ),
      );
    return new Set(rows.map((row) => row.id));
  }

  private async scenarios(
    principal: Principal,
    planId: string,
    only?: string,
  ): Promise<PlanScenario[]> {
    const db = this.database.db;
    const rows = await db
      .select()
      .from(planScenarios)
      .where(and(eq(planScenarios.planId, planId), only ? eq(planScenarios.id, only) : undefined))
      .orderBy(asc(planScenarios.createdAt));
    if (rows.length === 0) return [];
    const changes = await db
      .select({
        scenarioId: planScenarioChanges.scenarioId,
        change: planScenarioChanges.change,
        issue: issues,
      })
      .from(planScenarioChanges)
      .innerJoin(issues, eq(issues.id, planScenarioChanges.issueId))
      .where(
        and(
          inArray(
            planScenarioChanges.scenarioId,
            rows.map((row) => row.id),
          ),
          isNull(issues.deletedAt),
        ),
      )
      .orderBy(asc(issues.key));
    // Only changes to issues the caller may see.
    const visible = new Set(
      (
        await this.issues.summarize(
          principal.userId,
          changes.map((entry) => entry.issue),
        )
      ).map((issue) => issue.id),
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      changes: changes
        .filter((entry) => entry.scenarioId === row.id && visible.has(entry.issue.id))
        .map((entry) => ({ key: entry.issue.key, change: entry.change as ScenarioChange })),
    }));
  }

  private async scenario(planId: string, scenarioId: string) {
    const [row] = await this.database.db
      .select()
      .from(planScenarios)
      .where(and(eq(planScenarios.id, scenarioId), eq(planScenarios.planId, planId)));
    if (!row) throw new NotFoundException('Scenario not found');
    return row;
  }

  private async row(id: string): Promise<PlanRow> {
    const [row] = await this.database.db.select().from(plans).where(eq(plans.id, id));
    if (!row) throw new NotFoundException('Plan not found');
    return row;
  }

  private async editable(principal: Principal, id: string): Promise<PlanRow> {
    const row = await this.row(id);
    if (row.ownerId !== principal.userId && !(await this.access.isAdmin(principal))) {
      throw new ForbiddenException('Only the owner and administrators change a plan');
    }
    return row;
  }

  private async summary(principal: Principal, row: PlanRow): Promise<PlanSummary> {
    const db = this.database.db;
    const linked = await db
      .select({ id: projects.id, key: projects.key, name: projects.name })
      .from(planProjects)
      .innerJoin(projects, eq(projects.id, planProjects.projectId))
      .where(and(eq(planProjects.planId, row.id), isNull(projects.archivedAt)))
      .orderBy(asc(planProjects.position));
    const visible: PlanSummary['projects'] = [];
    for (const project of linked) {
      try {
        await this.projects.findBrowsable(principal, project.key);
        visible.push({ key: project.key, name: project.name });
      } catch {
        // Projects the caller may not browse stay out of the plan for them.
      }
    }
    const [owner] = row.ownerId
      ? await db
          .select({ id: users.id, displayName: users.displayName })
          .from(users)
          .where(eq(users.id, row.ownerId))
      : [];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      owner: owner ?? null,
      projects: visible,
      canEdit: row.ownerId === principal.userId || (await this.access.isAdmin(principal)),
    };
  }

  private async projectIds(principal: Principal, keys: string[]): Promise<string[]> {
    const ids: string[] = [];
    for (const key of [...new Set(keys.map((entry) => entry.toUpperCase()))]) {
      ids.push((await this.projects.findBrowsable(principal, key)).id);
    }
    if (ids.length === 0) throw new BadRequestException('A plan needs at least one project');
    return ids;
  }

  private async setProjects(planId: string, projectIds: string[]): Promise<void> {
    const db = this.database.db;
    await db.delete(planProjects).where(eq(planProjects.planId, planId));
    await db
      .insert(planProjects)
      .values(projectIds.map((projectId, position) => ({ planId, projectId, position })));
  }
}
