import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type CreateGroupRequest,
  GLOBAL_PERMISSIONS,
  type GlobalPermission,
  type GroupSummary,
} from '@tasklore/shared';
import { and, count, eq, inArray } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { DATABASE } from '../core/tokens.js';
import { type DatabaseHandle, type Executor, isUniqueViolation } from '../db/client.js';
import { globalPermissionGrants, groupMembers, groups } from '../db/schema/index.js';

export const ADMINISTRATORS_GROUP = 'administrators';
export const USERS_GROUP = 'users';

const BUILT_IN_GROUPS: Array<{
  name: string;
  description: string;
  permissions: GlobalPermission[];
}> = [
  {
    name: ADMINISTRATORS_GROUP,
    description: 'Verwalten die gesamte Installation.',
    permissions: [...GLOBAL_PERMISSIONS],
  },
  {
    name: USERS_GROUP,
    description: 'Alle angemeldeten Personen.',
    permissions: ['browse-users', 'share-filters'],
  },
];

@Injectable()
export class GroupService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  /** Creates the default groups and their grants if they are missing. */
  async ensureBuiltIns(db: Executor = this.database.db): Promise<void> {
    for (const group of BUILT_IN_GROUPS) {
      await db
        .insert(groups)
        .values({ id: uuidv7(), name: group.name, description: group.description })
        .onConflictDoNothing({ target: groups.name });
      const [row] = await db
        .select({ id: groups.id })
        .from(groups)
        .where(eq(groups.name, group.name));
      if (!row) continue;
      await db
        .insert(globalPermissionGrants)
        .values(group.permissions.map((permission) => ({ permission, groupId: row.id })))
        .onConflictDoNothing();
    }
  }

  async create(request: CreateGroupRequest): Promise<GroupSummary> {
    const id = uuidv7();
    try {
      await this.database.db.transaction(async (tx) => {
        await tx
          .insert(groups)
          .values({ id, name: request.name, description: request.description });
        if (request.globalPermissions.length > 0) {
          await tx
            .insert(globalPermissionGrants)
            .values(request.globalPermissions.map((permission) => ({ permission, groupId: id })));
        }
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`A group named "${request.name}" already exists`);
      }
      throw error;
    }
    return {
      id,
      name: request.name,
      description: request.description,
      memberCount: 0,
      globalPermissions: [...request.globalPermissions].sort(),
    };
  }

  async list(): Promise<GroupSummary[]> {
    const db = this.database.db;
    const rows = await db.select().from(groups).orderBy(groups.name);
    const counts = await db
      .select({ groupId: groupMembers.groupId, members: count() })
      .from(groupMembers)
      .groupBy(groupMembers.groupId);
    const grants = await db.select().from(globalPermissionGrants);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      memberCount: counts.find((entry) => entry.groupId === row.id)?.members ?? 0,
      globalPermissions: grants
        .filter((grant) => grant.groupId === row.id)
        .map((grant) => grant.permission as GlobalPermission)
        .sort(),
    }));
  }

  /** Resolves group names to ids; unknown names are a client error. */
  async idsByName(names: string[], db: Executor = this.database.db): Promise<string[]> {
    const unique = [...new Set(names)];
    if (unique.length === 0) return [];
    const rows = await db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(inArray(groups.name, unique));
    const missing = unique.filter((name) => !rows.some((row) => row.name === name));
    if (missing.length > 0) {
      throw new BadRequestException(`Unknown group: ${missing.join(', ')}`);
    }
    return rows.map((row) => row.id);
  }

  async addMember(groupName: string, userId: string): Promise<void> {
    const [groupId] = await this.idsByName([groupName]).catch(() => {
      throw new NotFoundException(`Group "${groupName}" not found`);
    });
    if (!groupId) throw new NotFoundException(`Group "${groupName}" not found`);
    try {
      await this.database.db.insert(groupMembers).values({ groupId, userId }).onConflictDoNothing();
    } catch (error) {
      // A foreign-key violation means the user does not exist.
      if ((error as { cause?: { code?: string } })?.cause?.code === '23503') {
        throw new NotFoundException('User not found');
      }
      throw error;
    }
  }

  async removeMember(groupName: string, userId: string): Promise<boolean> {
    const [group] = await this.database.db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.name, groupName));
    if (!group) throw new NotFoundException(`Group "${groupName}" not found`);
    const removed = await this.database.db
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId)))
      .returning({ userId: groupMembers.userId });
    return removed.length > 0;
  }
}
