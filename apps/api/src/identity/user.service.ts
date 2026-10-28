import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Me, UserSummary } from '@tasklore/shared';
import { eq, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AccessService } from '../access/access.service.js';
import { DATABASE } from '../core/tokens.js';
import { type DatabaseHandle, type Executor, isUniqueViolation } from '../db/client.js';
import { groupMembers, groups, users } from '../db/schema/index.js';
import { GroupService } from './group.service.js';

export interface NewUser {
  email: string;
  displayName: string;
  passwordHash: string | null;
  groupNames: string[];
}

@Injectable()
export class UserService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(GroupService) private readonly groupService: GroupService,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  async findForLogin(email: string) {
    const [row] = await this.database.db
      .select({ id: users.id, passwordHash: users.passwordHash, status: users.status })
      .from(users)
      .where(eq(users.email, email));
    return row ?? null;
  }

  async create(user: NewUser, db: Executor = this.database.db): Promise<string> {
    const id = uuidv7();
    const groupIds = await this.groupService.idsByName(user.groupNames, db);
    try {
      await db.insert(users).values({
        id,
        email: user.email,
        displayName: user.displayName,
        passwordHash: user.passwordHash,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A user with this email already exists');
      }
      throw error;
    }
    if (groupIds.length > 0) {
      await db.insert(groupMembers).values(groupIds.map((groupId) => ({ groupId, userId: id })));
    }
    return id;
  }

  async recordLogin(userId: string): Promise<void> {
    await this.database.db
      .update(users)
      .set({ lastLoginAt: sql`now()` })
      .where(eq(users.id, userId));
  }

  async me(userId: string, via: Me['authenticatedVia']): Promise<Me> {
    const [user] = await this.database.db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      locale: user.locale,
      timeZone: user.timeZone,
      globalPermissions: await this.access.globalPermissions(userId),
      authenticatedVia: via,
    };
  }

  async list(): Promise<UserSummary[]> {
    const rows = await this.database.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        status: users.status,
        groups: sql<
          string[]
        >`coalesce(array_agg(${groups.name} order by ${groups.name}) filter (where ${groups.name} is not null), '{}')`,
      })
      .from(users)
      .leftJoin(groupMembers, eq(groupMembers.userId, users.id))
      .leftJoin(groups, eq(groups.id, groupMembers.groupId))
      .groupBy(users.id)
      .orderBy(users.displayName);
    return rows;
  }
}
