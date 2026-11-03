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
import { ProviderService } from '../operations/provider.service.js';
import { GroupService, USERS_GROUP } from './group.service.js';
import { TwoFactorService } from './two-factor.service.js';

export interface NewUser {
  email: string;
  displayName: string;
  passwordHash: string | null;
  groupNames: string[];
  /** External collaborator (TL-66). */
  external?: boolean;
  /** 'agent' for an AI agent's account (TL-92). */
  kind?: 'person' | 'agent';
}

@Injectable()
export class UserService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(GroupService) private readonly groupService: GroupService,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(TwoFactorService) private readonly twoFactor: TwoFactorService,
    @Inject(ProviderService) private readonly provider: ProviderService,
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
    // The plan of a provider limits seats and agents (TL-103).
    if (user.kind === 'agent') await this.provider.requireAgent(db);
    else if (!user.external) await this.provider.requireSeat(db);
    const id = uuidv7();
    const groupIds = await this.groupService.idsByName(user.groupNames, db);
    try {
      await db.insert(users).values({
        id,
        email: user.email,
        displayName: user.displayName,
        passwordHash: user.passwordHash,
        external: user.external ?? false,
        kind: user.kind ?? 'person',
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
      agent: user.kind === 'agent',
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
        external: users.external,
        agent: sql<boolean>`${users.kind} = 'agent'`,
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

  /**
   * External collaborators leave the group "users", which would show them every project and the
   * directory; regular ones join it again (TL-66, E-131).
   */
  async setExternal(id: string, external: boolean): Promise<void> {
    await this.database.atomic(async () => {
      const db = this.database.db;
      // A guest made regular takes a seat of the plan (TL-103).
      if (!external) {
        const [current] = await db
          .select({ external: users.external, status: users.status, kind: users.kind })
          .from(users)
          .where(eq(users.id, id));
        if (current?.external && current.status === 'active' && current.kind === 'person') {
          await this.provider.requireSeat(db);
        }
      }
      const [changed] = await db
        .update(users)
        .set({ external, updatedAt: new Date() })
        .where(and(eq(users.id, id), ne(users.id, AUTOMATION_ACTOR_ID)))
        .returning({ id: users.id });
      if (!changed) throw new NotFoundException('User not found');
      const [everyone] = await this.groupService.idsByName([USERS_GROUP], db);
      if (!everyone) return;
      if (external) {
        await db
          .delete(groupMembers)
          .where(and(eq(groupMembers.groupId, everyone), eq(groupMembers.userId, id)));
      } else {
        await db
          .insert(groupMembers)
          .values({ groupId: everyone, userId: id })
          .onConflictDoNothing();
      }
    });
  }

  /** Active users matching a name or email fragment, for pickers. */
  async search(query: string, limit: number): Promise<UserLookup[]> {
    const pattern = `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    return this.database.db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        agent: sql<boolean>`${users.kind} = 'agent'`,
      })
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
