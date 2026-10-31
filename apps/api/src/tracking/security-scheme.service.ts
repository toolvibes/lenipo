import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateSecuritySchemeRequest,
  SecurityGrantInput,
  SecurityScheme,
  SecuritySchemeSummary,
  UpdateSecuritySchemeRequest,
} from '@tasklore/shared';
import { and, asc, count, eq, inArray, isNotNull, notInArray } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import { type DatabaseHandle, type Executor, isUniqueViolation } from '../db/client.js';
import {
  groups,
  issues,
  projects,
  securityLevelGrants,
  securityLevels,
  securitySchemes,
  users,
} from '../db/schema/index.js';
import { ProjectService } from './project.service.js';

/**
 * Issue security schemes (TL-13, E-94): named sets of levels, each granting visibility to roles,
 * groups, people, the reporter or the assignee; assigned to projects by global administrators.
 */
@Injectable()
export class SecuritySchemeService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(): Promise<SecuritySchemeSummary[]> {
    const db = this.database.db;
    const [schemes, used] = await Promise.all([
      db.select().from(securitySchemes).orderBy(asc(securitySchemes.name)),
      db
        .select({ schemeId: projects.securitySchemeId, key: projects.key, name: projects.name })
        .from(projects)
        .where(isNotNull(projects.securitySchemeId))
        .orderBy(asc(projects.key)),
    ]);
    return schemes.map((scheme) => ({
      id: scheme.id,
      name: scheme.name,
      description: scheme.description,
      projects: used
        .filter((project) => project.schemeId === scheme.id)
        .map(({ key, name }) => ({ key, name })),
    }));
  }

  async get(id: string): Promise<SecurityScheme> {
    const summary = (await this.list()).find((scheme) => scheme.id === id);
    if (!summary) throw new NotFoundException('Security scheme not found');
    const db = this.database.db;
    const levels = await db
      .select()
      .from(securityLevels)
      .where(eq(securityLevels.schemeId, id))
      .orderBy(asc(securityLevels.position));
    const grants =
      levels.length === 0
        ? []
        : await db
            .select({
              levelId: securityLevelGrants.levelId,
              grantee: securityLevelGrants.grantee,
              role: securityLevelGrants.role,
              groupId: groups.id,
              groupName: groups.name,
              userId: users.id,
              userName: users.displayName,
            })
            .from(securityLevelGrants)
            .leftJoin(groups, eq(groups.id, securityLevelGrants.groupId))
            .leftJoin(users, eq(users.id, securityLevelGrants.userId))
            .where(
              inArray(
                securityLevelGrants.levelId,
                levels.map((level) => level.id),
              ),
            );
    return {
      ...summary,
      defaultLevelId: levels.find((level) => level.isDefault)?.id ?? null,
      levels: levels.map((level) => ({
        id: level.id,
        name: level.name,
        description: level.description,
        grants: grants
          .filter((grant) => grant.levelId === level.id)
          .map((grant) => ({
            grantee: grant.grantee,
            role: grant.role,
            group: grant.groupId ? { id: grant.groupId, name: grant.groupName ?? '' } : null,
            user: grant.userId ? { id: grant.userId, displayName: grant.userName ?? '' } : null,
          })),
      })),
    };
  }

  async create(principal: Principal, request: CreateSecuritySchemeRequest) {
    const id = uuidv7();
    try {
      await this.database.db
        .insert(securitySchemes)
        .values({ id, name: request.name, description: request.description });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('A scheme with this name exists');
      throw error;
    }
    await this.record(principal, 'security-scheme.created', id, { name: request.name });
    return this.get(id);
  }

  async update(principal: Principal, id: string, request: UpdateSecuritySchemeRequest) {
    const scheme = await this.get(id);
    try {
      await this.database.db.transaction(async (tx) => {
        if (request.name !== undefined || request.description !== undefined) {
          await tx
            .update(securitySchemes)
            .set({
              ...(request.name !== undefined ? { name: request.name } : {}),
              ...(request.description !== undefined ? { description: request.description } : {}),
            })
            .where(eq(securitySchemes.id, id));
        }
        if (request.levels) await this.replaceLevels(tx, scheme, request);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('A scheme with this name exists');
      throw error;
    }
    await this.record(principal, 'security-scheme.updated', id, {
      levels: request.levels?.length ?? null,
    });
    return this.get(id);
  }

  private async replaceLevels(
    tx: Executor,
    scheme: SecurityScheme,
    request: UpdateSecuritySchemeRequest,
  ) {
    const levels = request.levels ?? [];
    const known = new Set(scheme.levels.map((level) => level.id));
    for (const level of levels) {
      if (level.id && !known.has(level.id)) throw new BadRequestException('Unknown level');
    }
    if (request.defaultLevel != null && request.defaultLevel >= levels.length) {
      throw new BadRequestException('The default level is out of range');
    }
    const kept = levels.flatMap((level) => (level.id ? [level.id] : []));
    const dropped = scheme.levels.filter((level) => !kept.includes(level.id)).map((l) => l.id);
    if (dropped.length > 0) {
      // Removing a level would make its issues visible to everyone: move them off first.
      const [inUse] = await tx
        .select({ n: count() })
        .from(issues)
        .where(inArray(issues.securityLevelId, dropped));
      if ((inUse?.n ?? 0) > 0) throw new ConflictException('Issues still use a removed level');
      await tx.delete(securityLevels).where(inArray(securityLevels.id, dropped));
    }
    await this.checkGrantees(
      tx,
      levels.flatMap((level) => level.grants),
    );
    for (const [position, level] of levels.entries()) {
      const levelId = level.id ?? uuidv7();
      const values = {
        name: level.name,
        description: level.description,
        position,
        isDefault:
          request.defaultLevel !== undefined
            ? request.defaultLevel === position
            : level.id === scheme.defaultLevelId && !!level.id,
      };
      if (level.id) {
        await tx.update(securityLevels).set(values).where(eq(securityLevels.id, levelId));
      } else {
        await tx.insert(securityLevels).values({ id: levelId, schemeId: scheme.id, ...values });
      }
      await tx.delete(securityLevelGrants).where(eq(securityLevelGrants.levelId, levelId));
      const unique = new Map(level.grants.map((grant) => [JSON.stringify(grant), grant]));
      if (unique.size === 0) continue;
      await tx.insert(securityLevelGrants).values(
        [...unique.values()].map((grant) => ({
          id: uuidv7(),
          levelId,
          ...grantColumns(grant),
        })),
      );
    }
  }

  private async checkGrantees(tx: Executor, grants: SecurityGrantInput[]) {
    const groupIds = [...new Set(grants.flatMap((g) => ('groupId' in g ? [g.groupId] : [])))];
    const userIds = [...new Set(grants.flatMap((g) => ('userId' in g ? [g.userId] : [])))];
    if (groupIds.length > 0) {
      const found = await tx
        .select({ id: groups.id })
        .from(groups)
        .where(inArray(groups.id, groupIds));
      if (found.length !== groupIds.length) throw new BadRequestException('Unknown group');
    }
    if (userIds.length > 0) {
      const found = await tx.select({ id: users.id }).from(users).where(inArray(users.id, userIds));
      if (found.length !== userIds.length) throw new BadRequestException('Unknown user');
    }
  }

  async delete(principal: Principal, id: string): Promise<void> {
    const scheme = await this.get(id);
    if (scheme.projects.length > 0) throw new ConflictException('Projects still use this scheme');
    await this.database.db.delete(securitySchemes).where(eq(securitySchemes.id, id));
    await this.record(principal, 'security-scheme.deleted', id, { name: scheme.name });
  }

  /**
   * Gives a project a scheme, or none. Issues keep only levels of the new scheme; others lose
   * theirs only when no scheme is left, so changing schemes never opens issues silently.
   */
  async assign(principal: Principal, key: string, schemeId: string | null) {
    const project = await this.projects.findBrowsable(principal, key);
    const scheme = schemeId ? await this.get(schemeId) : null;
    const levelIds = scheme?.levels.map((level) => level.id) ?? [];
    const [stranded] = await this.database.db
      .select({ n: count() })
      .from(issues)
      .where(
        and(
          eq(issues.projectId, project.id),
          isNotNull(issues.securityLevelId),
          levelIds.length > 0 ? notInArray(issues.securityLevelId, levelIds) : undefined,
        ),
      );
    if ((stranded?.n ?? 0) > 0) {
      throw new ConflictException('Issues of the project still use levels of the current scheme');
    }
    await this.database.db
      .update(projects)
      .set({ securitySchemeId: schemeId })
      .where(eq(projects.id, project.id));
    await this.audit.record({
      action: 'project.security-scheme-set',
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
      targetType: 'security-scheme',
      targetId: id,
      details: { ...details },
    });
  }
}

function grantColumns(grant: SecurityGrantInput) {
  if ('role' in grant)
    return { grantee: 'role' as const, role: grant.role, groupId: null, userId: null };
  if ('groupId' in grant) {
    return { grantee: 'group' as const, role: null, groupId: grant.groupId, userId: null };
  }
  if ('userId' in grant) {
    return { grantee: 'user' as const, role: null, groupId: null, userId: grant.userId };
  }
  return { grantee: grant.grantee, role: null, groupId: null, userId: null };
}
