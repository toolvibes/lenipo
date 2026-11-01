import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateNotificationSchemeRequest,
  NotificationRule,
  NotificationRuleInput,
  NotificationScheme,
  NotificationSchemeSummary,
  UpdateNotificationSchemeRequest,
} from '@toolvibes/shared';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import { type DatabaseHandle, type Executor, isUniqueViolation } from '../db/client.js';
import {
  DEFAULT_NOTIFICATION_SCHEME_ID,
  groups,
  notificationSchemeRules,
  notificationSchemes,
  projects,
  users,
} from '../db/schema/index.js';
import { ProjectService } from '../tracking/project.service.js';

/**
 * Named notification schemes shared by projects (P-NTF-03, TL-71, E-83): which issue event
 * reaches whom. Managed by global administrators like permission schemes (E-82); the
 * recipients are resolved in NotificationService.
 */
@Injectable()
export class NotificationSchemeService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(): Promise<NotificationSchemeSummary[]> {
    const db = this.database.db;
    const [schemes, used] = await Promise.all([
      db.select().from(notificationSchemes).orderBy(asc(notificationSchemes.name)),
      db
        .select({
          schemeId: sql<string>`coalesce(${projects.notificationSchemeId}, ${DEFAULT_NOTIFICATION_SCHEME_ID}::uuid)`,
          key: projects.key,
          name: projects.name,
        })
        .from(projects)
        .orderBy(asc(projects.key)),
    ]);
    return schemes
      .map((scheme) => ({
        id: scheme.id,
        name: scheme.name,
        description: scheme.description,
        isDefault: scheme.id === DEFAULT_NOTIFICATION_SCHEME_ID,
        projects: used
          .filter((project) => project.schemeId === scheme.id)
          .map(({ key, name }) => ({ key, name })),
      }))
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  }

  async get(id: string): Promise<NotificationScheme> {
    const summary = (await this.list()).find((scheme) => scheme.id === id);
    if (!summary) throw new NotFoundException('Notification scheme not found');
    const rows = await this.database.db
      .select({
        event: notificationSchemeRules.event,
        recipient: notificationSchemeRules.recipient,
        role: notificationSchemeRules.role,
        groupId: groups.id,
        groupName: groups.name,
        userId: users.id,
        userName: users.displayName,
      })
      .from(notificationSchemeRules)
      .leftJoin(groups, eq(groups.id, notificationSchemeRules.groupId))
      .leftJoin(users, eq(users.id, notificationSchemeRules.userId))
      .where(eq(notificationSchemeRules.schemeId, id))
      .orderBy(asc(notificationSchemeRules.event), asc(notificationSchemeRules.recipient));
    const rules: NotificationRule[] = rows.map((row) => ({
      event: row.event,
      recipient: row.recipient,
      role: row.role,
      group: row.groupId ? { id: row.groupId, name: row.groupName ?? '' } : null,
      user: row.userId ? { id: row.userId, displayName: row.userName ?? '' } : null,
    }));
    return { ...summary, rules };
  }

  private async replaceRules(db: Executor, schemeId: string, rules: NotificationRuleInput[]) {
    const groupIds = [
      ...new Set(rules.flatMap((rule) => ('groupId' in rule ? [rule.groupId] : []))),
    ];
    const userIds = [...new Set(rules.flatMap((rule) => ('userId' in rule ? [rule.userId] : [])))];
    if (groupIds.length > 0) {
      const found = await db
        .select({ id: groups.id })
        .from(groups)
        .where(inArray(groups.id, groupIds));
      if (found.length !== groupIds.length) throw new BadRequestException('Unknown group in rules');
    }
    if (userIds.length > 0) {
      const found = await db.select({ id: users.id }).from(users).where(inArray(users.id, userIds));
      if (found.length !== userIds.length) throw new BadRequestException('Unknown user in rules');
    }
    const unique = new Map<string, NotificationRuleInput>();
    for (const rule of rules) unique.set(JSON.stringify(rule), rule);
    await db.delete(notificationSchemeRules).where(eq(notificationSchemeRules.schemeId, schemeId));
    if (unique.size === 0) return;
    await db.insert(notificationSchemeRules).values(
      [...unique.values()].map((rule) => ({
        id: uuidv7(),
        schemeId,
        event: rule.event,
        recipient:
          'recipient' in rule
            ? rule.recipient
            : 'role' in rule
              ? ('role' as const)
              : 'groupId' in rule
                ? ('group' as const)
                : ('user' as const),
        role: 'role' in rule ? rule.role : null,
        groupId: 'groupId' in rule ? rule.groupId : null,
        userId: 'userId' in rule ? rule.userId : null,
      })),
    );
  }

  private inputs(rules: NotificationRule[]): NotificationRuleInput[] {
    return rules.map((rule) =>
      rule.recipient === 'role'
        ? { event: rule.event, role: rule.role ?? 'users' }
        : rule.recipient === 'group'
          ? { event: rule.event, groupId: rule.group?.id ?? '' }
          : rule.recipient === 'user'
            ? { event: rule.event, userId: rule.user?.id ?? '' }
            : { event: rule.event, recipient: rule.recipient },
    );
  }

  async create(principal: Principal, request: CreateNotificationSchemeRequest) {
    const source = await this.get(request.copyFromId ?? DEFAULT_NOTIFICATION_SCHEME_ID);
    const id = uuidv7();
    try {
      await this.database.db.transaction(async (tx) => {
        await tx
          .insert(notificationSchemes)
          .values({ id, name: request.name, description: request.description });
        await this.replaceRules(tx, id, this.inputs(source.rules));
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('A scheme with this name exists');
      throw error;
    }
    await this.record(principal, 'notification-scheme.created', id, { name: request.name });
    return this.get(id);
  }

  async update(principal: Principal, id: string, request: UpdateNotificationSchemeRequest) {
    await this.get(id);
    try {
      await this.database.db.transaction(async (tx) => {
        if (request.name !== undefined || request.description !== undefined) {
          await tx
            .update(notificationSchemes)
            .set({
              ...(request.name !== undefined ? { name: request.name } : {}),
              ...(request.description !== undefined ? { description: request.description } : {}),
            })
            .where(eq(notificationSchemes.id, id));
        }
        if (request.rules) await this.replaceRules(tx, id, request.rules);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('A scheme with this name exists');
      throw error;
    }
    await this.record(principal, 'notification-scheme.updated', id, {
      rules: request.rules?.length ?? null,
    });
    return this.get(id);
  }

  async delete(principal: Principal, id: string): Promise<void> {
    const scheme = await this.get(id);
    if (scheme.isDefault) throw new ConflictException('The default scheme stays');
    if (scheme.projects.length > 0) throw new ConflictException('Projects still use this scheme');
    await this.database.db.delete(notificationSchemes).where(eq(notificationSchemes.id, id));
    await this.record(principal, 'notification-scheme.deleted', id, { name: scheme.name });
  }

  async assign(principal: Principal, key: string, schemeId: string | null) {
    const project = await this.projects.findBrowsable(principal, key);
    if (schemeId) await this.get(schemeId);
    await this.database.db
      .update(projects)
      .set({
        notificationSchemeId: schemeId === DEFAULT_NOTIFICATION_SCHEME_ID ? null : schemeId,
      })
      .where(eq(projects.id, project.id));
    await this.audit.record({
      action: 'project.notification-scheme-set',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'project',
      targetId: project.id,
      details: { schemeId },
    });
  }

  private record(principal: Principal, action: string, id: string, details: object) {
    return this.audit.record({
      action,
      actorId: principal.userId,
      via: principal.via,
      targetType: 'notification-scheme',
      targetId: id,
      details: { ...details },
    });
  }
}
