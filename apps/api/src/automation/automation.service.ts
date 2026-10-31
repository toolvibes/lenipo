import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AutomationComponent,
  AutomationRule,
  AutomationRuleInput,
  AutomationRun,
  AutomationRunLine,
  AutomationRunStatus,
  AutomationTrigger,
} from '@tasklore/shared';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AccessService } from '../access/access.service.js';
import type { AppConfig } from '../core/config.js';
import type { Principal } from '../core/http/principal.js';
import { CONFIG, DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { automationRules, automationRuns, projects, users } from '../db/schema/index.js';
import { ProjectService } from '../tracking/project.service.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';
import { SpaceService } from '../wiki/space.service.js';
import { parseCron } from './cron.js';

type RuleRow = typeof automationRules.$inferSelect;

/** Every component, nested ones included. */
function flatten(components: AutomationComponent[]): AutomationComponent[] {
  return components.flatMap((component) =>
    component.type === 'if'
      ? [component, ...flatten(component.onTrue), ...flatten(component.onFalse)]
      : component.type === 'branch'
        ? [component, ...flatten(component.components)]
        : [component],
  );
}

/**
 * Managing automation rules (TL-22, E-103): project rules need the project's "administer"
 * permission, global rules system administration. What a rule may reach is checked on save.
 */
@Injectable()
export class AutomationService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(SpaceService) private readonly spaces: SpaceService,
  ) {}

  /** The project of a rule's scope, after checking the caller may manage its rules. */
  private async scope(principal: Principal, projectKey: string | null) {
    if (!projectKey) {
      if (!(await this.access.isAdmin(principal))) {
        throw new ForbiddenException('Global rules need system administration');
      }
      return null;
    }
    const project = await this.projects.findBrowsable(principal, projectKey);
    await this.projectAccess.require(principal, project.id, 'administer');
    return project;
  }

  private async present(_principal: Principal, rows: RuleRow[]): Promise<AutomationRule[]> {
    if (rows.length === 0) return [];
    const db = this.database.db;
    const ids = rows.map((row) => row.id);
    const [owners, projectRows, runs] = await Promise.all([
      db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(
          inArray(
            users.id,
            rows
              .flatMap((row) => (row.ownerId ? [row.ownerId] : []))
              .concat([''])
              .filter(Boolean),
          ),
        ),
      db
        .select({ id: projects.id, key: projects.key, name: projects.name })
        .from(projects)
        .where(
          inArray(
            projects.id,
            rows.flatMap((row) => (row.projectId ? [row.projectId] : [])),
          ),
        ),
      db
        .selectDistinctOn([automationRuns.ruleId], {
          ruleId: automationRuns.ruleId,
          at: automationRuns.startedAt,
          status: automationRuns.status,
        })
        .from(automationRuns)
        .where(inArray(automationRuns.ruleId, ids))
        .orderBy(automationRuns.ruleId, desc(automationRuns.startedAt)),
    ]);
    const base = (this.config.PUBLIC_URL ?? '').replace(/\/$/, '');
    return rows.map((row) => {
      const trigger = row.trigger as AutomationTrigger;
      const last = runs.find((run) => run.ruleId === row.id);
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        enabled: row.enabled,
        project: projectRows.find((project) => project.id === row.projectId) ?? null,
        trigger,
        components: row.components as AutomationComponent[],
        allowSelfTrigger: row.allowSelfTrigger,
        owner: owners.find((owner) => owner.id === row.ownerId) ?? null,
        disabledReason: row.disabledReason,
        webhookUrl:
          trigger.type === 'incoming-webhook' && row.webhookToken
            ? `${base}/api/v1/automation/hooks/${row.id}?token=${row.webhookToken}`
            : null,
        lastRun: last
          ? { at: last.at.toISOString(), status: last.status as AutomationRunStatus }
          : null,
        canEdit: true,
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }

  async list(principal: Principal, projectKey?: string): Promise<AutomationRule[]> {
    const project = await this.scope(principal, projectKey ?? null);
    const rows = await this.database.db
      .select()
      .from(automationRules)
      .where(
        project ? eq(automationRules.projectId, project.id) : isNull(automationRules.projectId),
      )
      .orderBy(automationRules.name);
    return this.present(principal, rows);
  }

  private async load(principal: Principal, id: string): Promise<RuleRow> {
    const [row] = await this.database.db
      .select()
      .from(automationRules)
      .where(eq(automationRules.id, id));
    if (!row) throw new NotFoundException('Rule not found');
    if (row.projectId) {
      const [project] = await this.database.db
        .select({ key: projects.key })
        .from(projects)
        .where(eq(projects.id, row.projectId));
      await this.scope(principal, project?.key ?? '-');
    } else {
      await this.scope(principal, null);
    }
    return row;
  }

  async get(principal: Principal, id: string): Promise<AutomationRule> {
    const [rule] = await this.present(principal, [await this.load(principal, id)]);
    return rule as AutomationRule;
  }

  /** What a rule may reach is decided by the person saving it. */
  private async validate(
    principal: Principal,
    input: AutomationRuleInput,
    projectKey: string | null,
  ): Promise<void> {
    if (input.trigger.type === 'schedule' && !parseCron(input.trigger.cron)) {
      throw new BadRequestException(`Invalid cron expression "${input.trigger.cron}"`);
    }
    for (const component of flatten(input.components)) {
      if (component.type === 'create-issue' && projectKey) {
        const target = component.projectKey.trim().toUpperCase();
        if (target && target !== projectKey && !target.includes('{{')) {
          throw new BadRequestException('Project rules create issues in their own project only');
        }
      }
      if (component.type === 'create-page') {
        await this.spaces.find(principal, component.spaceKey, 'edit');
      }
    }
  }

  async create(principal: Principal, input: AutomationRuleInput): Promise<AutomationRule> {
    const project = await this.scope(principal, input.projectKey);
    await this.validate(principal, input, project?.key ?? null);
    const id = uuidv7();
    await this.database.db.insert(automationRules).values({
      id,
      projectId: project?.id ?? null,
      ownerId: principal.userId,
      name: input.name,
      description: input.description,
      enabled: input.enabled,
      trigger: input.trigger,
      components: input.components,
      allowSelfTrigger: input.allowSelfTrigger,
      webhookToken:
        input.trigger.type === 'incoming-webhook' ? randomBytes(24).toString('base64url') : null,
    });
    return this.get(principal, id);
  }

  async update(
    principal: Principal,
    id: string,
    input: AutomationRuleInput,
  ): Promise<AutomationRule> {
    const row = await this.load(principal, id);
    const project = await this.scope(principal, input.projectKey);
    if ((project?.id ?? null) !== row.projectId) {
      throw new BadRequestException('A rule keeps its project');
    }
    await this.validate(principal, input, project?.key ?? null);
    await this.database.db
      .update(automationRules)
      .set({
        name: input.name,
        description: input.description,
        enabled: input.enabled,
        trigger: input.trigger,
        components: input.components,
        allowSelfTrigger: input.allowSelfTrigger,
        // Switching it on again clears the reason it was switched off.
        ...(input.enabled ? { disabledReason: null } : {}),
        webhookToken:
          input.trigger.type === 'incoming-webhook'
            ? (row.webhookToken ?? randomBytes(24).toString('base64url'))
            : null,
        // Whoever saves it last answers for what it reaches.
        ownerId: principal.userId,
        updatedAt: new Date(),
      })
      .where(eq(automationRules.id, id));
    return this.get(principal, id);
  }

  /** A new secret for an incoming webhook (TL-41); the old one stops working at once. */
  async rotateWebhookToken(principal: Principal, id: string): Promise<AutomationRule> {
    const row = await this.load(principal, id);
    if (!row.webhookToken) throw new BadRequestException('This rule has no incoming webhook');
    await this.database.db
      .update(automationRules)
      .set({ webhookToken: randomBytes(24).toString('base64url'), updatedAt: new Date() })
      .where(eq(automationRules.id, id));
    return this.get(principal, id);
  }

  async delete(principal: Principal, id: string): Promise<void> {
    await this.load(principal, id);
    await this.database.db.delete(automationRules).where(eq(automationRules.id, id));
  }

  async runs(principal: Principal, id: string): Promise<AutomationRun[]> {
    await this.load(principal, id);
    const rows = await this.database.db
      .select()
      .from(automationRuns)
      .where(and(eq(automationRuns.ruleId, id)))
      .orderBy(desc(automationRuns.startedAt))
      .limit(100);
    return rows.map((row) => ({
      id: row.id,
      startedAt: row.startedAt.toISOString(),
      durationMs: row.durationMs,
      status: row.status as AutomationRunStatus,
      trigger: row.trigger,
      issueKey: row.issueKey,
      log: row.log as AutomationRunLine[],
    }));
  }
}
