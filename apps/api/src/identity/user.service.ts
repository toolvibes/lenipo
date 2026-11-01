import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AUTOMATION_ACTOR_ID,
  type Me,
  type UpdateMeRequest,
  type UserLookup,
  type UserSummary,
} from '@toolvibes/shared';
import { and, eq, ilike, ne, or, type SQL, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AccessService } from '../access/access.service.js';
import { DATABASE } from '../core/tokens.js';
import { type DatabaseHandle, type Executor, isUniqueViolation } from '../db/client.js';
import { groupMembers, groups, users } from '../db/schema/index.js';
import { GroupService } from './group.service.js';
import { TwoFactorService } from './two-factor.service.js';

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
    @Inject(TwoFactorService) private readonly twoFactor: TwoFactorService,
  ) {}

  async findForLogin(email: string) {
    return this.loginRow(eq(users.email, email));
  }

  /** The same for an account a directory signed in (E-119). */
  async findForLoginById(id: string) {
    return this.loginRow(eq(users.id, id));
  }

  private async loginRow(where: SQL) {
    const [row] = await this.database.db
      .select({
        id: users.id,
        passwordHash: users.passwordHash,
        status: users.status,
        totpEnabledAt: users.totpEnabledAt,
      })
      .from(users)
      .where(where);
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

  async me(userId: string, via: Me['authenticatedVia'], stage = 'full'): Promise<Me> {
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
      onboarded: user.onboardedAt !== null,
      keyboardShortcuts: user.keyboardShortcuts,
      hasPassword: user.passwordHash !== null,
      twoFactor: await this.twoFactor.status(userId, stage),
    };
  }

  /** Name, language, time zone and shortcut setting of the signed-in user. */
  async updateProfile(
    userId: string,
    request: UpdateMeRequest,
    executor: Executor = this.database.db,
  ) {
    if (Object.keys(request).length === 0) return;
    await executor
      .update(users)
      .set({ ...request, updatedAt: new Date() })
      .where(eq(users.id, userId));
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
      // The automation actor is not a person to manage (E-103).
      .where(ne(users.id, AUTOMATION_ACTOR_ID))
      .groupBy(users.id)
      .orderBy(users.displayName);
    return rows;
  }

  /** Active users matching a name or email fragment, for pickers. */
  async search(query: string, limit: number): Promise<UserLookup[]> {
    const pattern = `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    return this.database.db
      .select({ id: users.id, displayName: users.displayName, email: users.email })
      .from(users)
      .where(
        and(
          eq(users.status, 'active'),
          or(ilike(users.displayName, pattern), ilike(users.email, pattern)),
        ),
      )
      .orderBy(users.displayName)
      .limit(limit);
  }
}
