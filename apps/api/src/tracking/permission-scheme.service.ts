import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreatePermissionSchemeRequest,
  PermissionGrant,
  PermissionGrantInput,
  PermissionScheme,
  PermissionSchemeSummary,
  ProjectPermission,
  ProjectRole,
  UpdatePermissionSchemeRequest,
} from '@tasklore/shared';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import { type DatabaseHandle, type Executor, isUniqueViolation } from '../db/client.js';
import {
  DEFAULT_PERMISSION_SCHEME_ID,
  groups,
  permissionSchemeGrants,
  permissionSchemes,
  projects,
  users,
} from '../db/schema/index.js';
import { ProjectService } from './project.service.js';

/**
 * Named permission schemes shared by projects (P-PRM-02, TL-70, E-82). The default scheme
 * holds the rights that used to be fixed in code; every project without its own uses it.
 * Managed by global administrators; the checks live in ProjectAccessService.
 */
@Injectable()
export class PermissionSchemeService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(): Promise<PermissionSchemeSummary[]> {
    const db = this.database.db;
    const [schemes, used] = await Promise.all([
      db.select().from(permissionSchemes).orderBy(asc(permissionSchemes.name)),
      db
        .select({
          schemeId: sql<string>`coalesce(${projects.permissionSchemeId}, ${DEFAULT_PERMISSION_SCHEME_ID}::uuid)`,
          key: projects.key,
          name: projects.name,
        })
        .from(projects)
        .orderBy(asc(projects.key)),
    ]);
    // The default scheme first, then by name.
    return schemes
      .map((scheme) => ({
        id: scheme.id,
        name: scheme.name,
        description: scheme.description,
        isDefault: scheme.id === DEFAULT_PERMISSION_SCHEME_ID,
        projects: used
          .filter((project) => project.schemeId === scheme.id)
          .map(({ key, name }) => ({ key, name })),
      }))
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  }

  async get(id: string): Promise<PermissionScheme> {
    const summary = (await this.list()).find((scheme) => scheme.id === id);
    if (!summary) throw new NotFoundException('Permission scheme not found');
    return { ...summary, grants: await this.grants(id) };
  }

  private async grants(schemeId: string): Promise<PermissionGrant[]> {
    const rows = await this.database.db
      .select({
        permission: permissionSchemeGrants.permission,
        grantee: permissionSchemeGrants.grantee,
        role: permissionSchemeGrants.role,
        groupId: groups.id,
        groupName: groups.name,
        userId: users.id,
        userName: users.displayName,
      })
      .from(permissionSchemeGrants)
      .leftJoin(groups, eq(groups.id, permissionSchemeGrants.groupId))
      .leftJoin(users, eq(users.id, permissionSchemeGrants.userId))
      .where(eq(permissionSchemeGrants.schemeId, schemeId))
      .orderBy(asc(permissionSchemeGrants.permission), asc(permissionSchemeGrants.grantee));
    return rows.map((row) => ({
      permission: row.permission as ProjectPermission,
      grantee: row.grantee,
      role: row.role,
      group: row.groupId ? { id: row.groupId, name: row.groupName ?? '' } : null,
      user: row.userId ? { id: row.userId, displayName: row.userName ?? '' } : null,
    }));
  }

  /** Checks the groups and people named in grants, then stores them instead of the old ones. */
  private async replaceGrants(db: Executor, schemeId: string, grants: PermissionGrantInput[]) {
    const groupIds = [
      ...new Set(grants.flatMap((grant) => ('groupId' in grant ? [grant.groupId] : []))),
    ];
    const userIds = [
      ...new Set(grants.flatMap((grant) => ('userId' in grant ? [grant.userId] : []))),
    ];
    if (groupIds.length > 0) {
      const found = await db
        .select({ id: groups.id })
        .from(groups)
        .where(inArray(groups.id, groupIds));
      if (found.length !== groupIds.length)
        throw new BadRequestException('Unknown group in grants');
    }
    if (userIds.length > 0) {
      const found = await db.select({ id: users.id }).from(users).where(inArray(users.id, userIds));
      if (found.length !== userIds.length) throw new BadRequestException('Unknown user in grants');
    }
    const unique = new Map<string, PermissionGrantInput>();
    for (const grant of grants) unique.set(JSON.stringify(grant), grant);
    await db.delete(permissionSchemeGrants).where(eq(permissionSchemeGrants.schemeId, schemeId));
    if (unique.size === 0) return;
    await db.insert(permissionSchemeGrants).values(
      [...unique.values()].map((grant) => ({
        id: uuidv7(),
        schemeId,
        permission: grant.permission,
        grantee:
          'role' in grant
            ? ('role' as const)
            : 'groupId' in grant
              ? ('group' as const)
              : ('user' as const),
        role: 'role' in grant ? (grant.role as ProjectRole) : null,
        groupId: 'groupId' in grant ? grant.groupId : null,
        userId: 'userId' in grant ? grant.userId : null,
      })),
    );
  }

  private inputs(grants: PermissionGrant[]): PermissionGrantInput[] {
    return grants.map((grant) =>
      grant.grantee === 'role'
        ? { permission: grant.permission, role: grant.role as ProjectRole }
        : grant.grantee === 'group'
          ? { permission: grant.permission, groupId: grant.group?.id ?? '' }
          : { permission: grant.permission, userId: grant.user?.id ?? '' },
    );
  }

  async create(principal: Principal, request: CreatePermissionSchemeRequest) {
    const source = await this.get(request.copyFromId ?? DEFAULT_PERMISSION_SCHEME_ID);
    const id = uuidv7();
    try {
      await this.database.db.transaction(async (tx) => {
        await tx
          .insert(permissionSchemes)
          .values({ id, name: request.name, description: request.description });
        await this.replaceGrants(tx, id, this.inputs(source.grants));
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('A scheme with this name exists');
      throw error;
    }
    await this.record(principal, 'permission-scheme.created', id, { name: request.name });
    return this.get(id);
  }

  async update(principal: Principal, id: string, request: UpdatePermissionSchemeRequest) {
    await this.get(id);
    try {
      await this.database.db.transaction(async (tx) => {
        if (request.name !== undefined || request.description !== undefined) {
          await tx
            .update(permissionSchemes)
            .set({
              ...(request.name !== undefined ? { name: request.name } : {}),
              ...(request.description !== undefined ? { description: request.description } : {}),
            })
            .where(eq(permissionSchemes.id, id));
        }
        if (request.grants) await this.replaceGrants(tx, id, request.grants);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('A scheme with this name exists');
      throw error;
    }
    await this.record(principal, 'permission-scheme.updated', id, {
      grants: request.grants?.length ?? null,
    });
    return this.get(id);
  }

  /** Only schemes no project uses, and never the default one. */
  async delete(principal: Principal, id: string): Promise<void> {
    const scheme = await this.get(id);
    if (scheme.isDefault) throw new ConflictException('The default scheme stays');
    if (scheme.projects.length > 0) {
      throw new ConflictException('Projects still use this scheme');
    }
    await this.database.db.delete(permissionSchemes).where(eq(permissionSchemes.id, id));
    await this.record(principal, 'permission-scheme.deleted', id, { name: scheme.name });
  }

  /** Gives a project a scheme; null goes back to the default one. */
  async assign(principal: Principal, key: string, schemeId: string | null) {
    const project = await this.projects.findBrowsable(principal, key);
    if (schemeId) await this.get(schemeId);
    await this.database.db
      .update(projects)
      .set({ permissionSchemeId: schemeId === DEFAULT_PERMISSION_SCHEME_ID ? null : schemeId })
      .where(eq(projects.id, project.id));
    await this.audit.record({
      action: 'project.permission-scheme-set',
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
      targetType: 'permission-scheme',
      targetId: id,
      details: { ...details },
    });
  }
}
