import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AUTOMATION_ACTOR_ID, type CreatedScimToken, type ScimToken } from '@toolvibes/shared';
import { and, asc, count, desc, eq, inArray, isNull, ne, type SQL, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AuditService } from '../audit/audit.service.js';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { groupMembers, groups, scimTokens, users } from '../db/schema/index.js';
import { randomSecret, sha256 } from '../identity/secrets.js';
import { UserService } from '../identity/user.service.js';
import { UserLifecycleService } from '../identity/user-lifecycle.service.js';

export const SCIM_PREFIX = 'lpscim_';
export const USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
export const GROUP_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:Group';
export const LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
export const PATCH_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';
/** Deactivations and other changes are made in the name of the identity provider. */
const SCIM_ACTOR = 'scim';
const MAX_COUNT = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// biome-ignore lint/suspicious/noExplicitAny: SCIM bodies are loosely typed JSON
type Json = any;

export class ScimError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly scimType?: string,
  ) {
    super(message);
  }
}

/** `attribute eq "value"`, the one filter identity providers send for lookups. */
function parseFilter(filter: string | undefined): { attribute: string; value: string } | null {
  if (!filter) return null;
  const match =
    /^\s*([\w.]+?)(?:\[\s*value\s+eq\s+"([^"]*)"\s*\])?\s+eq\s+"((?:[^"\\]|\\.)*)"\s*$/i.exec(
      filter,
    );
  const plain = /^\s*emails\[\s*value\s+eq\s+"([^"]*)"\s*\]\s*$/i.exec(filter);
  if (plain) return { attribute: 'emails.value', value: plain[1] ?? '' };
  if (!match) throw new ScimError(400, `Unsupported filter: ${filter}`, 'invalidFilter');
  return {
    attribute: (match[1] ?? '').toLowerCase(),
    value: (match[3] ?? '').replace(/\\"/g, '"'),
  };
}

const truthy = (value: unknown) =>
  value === true || (typeof value === 'string' && value.toLowerCase() === 'true');

interface UserChanges {
  email?: string;
  displayName?: string;
  active?: boolean;
  externalId?: string | null;
}

/** What a SCIM user body says about the fields Lenipo keeps. */
function userFields(body: Json): UserChanges {
  const changes: UserChanges = {};
  const emails: Json[] = Array.isArray(body?.emails) ? body.emails : [];
  const email = emails.find((entry) => entry?.primary)?.value ?? emails[0]?.value ?? body?.userName;
  if (typeof email === 'string' && email.includes('@')) changes.email = email.trim().toLowerCase();
  const given = body?.name?.givenName;
  const family = body?.name?.familyName;
  const name =
    body?.displayName ??
    body?.name?.formatted ??
    ([given, family].filter((part) => typeof part === 'string' && part).join(' ') || undefined);
  if (typeof name === 'string' && name.trim()) changes.displayName = name.trim().slice(0, 200);
  if (body?.active !== undefined) changes.active = truthy(body.active);
  if (body?.externalId !== undefined)
    changes.externalId = body.externalId ? String(body.externalId) : null;
  return changes;
}

/**
 * SCIM 2.0 (RFC 7643/7644) for identity providers such as Entra ID, Okta or Keycloak (TL-52,
 * E-141): users and groups at /scim/v2. Deleting deactivates; nothing is ever removed for good.
 */
@Injectable()
export class ScimService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(UserService) private readonly userService: UserService,
    @Inject(UserLifecycleService) private readonly lifecycle: UserLifecycleService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- tokens

  async tokens(): Promise<ScimToken[]> {
    const rows = await this.database.db
      .select()
      .from(scimTokens)
      .where(isNull(scimTokens.revokedAt))
      .orderBy(desc(scimTokens.createdAt));
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    }));
  }

  async createToken(principal: Principal, name: string): Promise<CreatedScimToken> {
    const secret = `${SCIM_PREFIX}${randomSecret()}`;
    const [row] = await this.database.db
      .insert(scimTokens)
      .values({
        id: uuidv7(),
        name,
        tokenHash: sha256(secret),
        prefix: secret.slice(0, SCIM_PREFIX.length + 4),
        createdById: principal.userId,
      })
      .returning();
    if (!row) throw new Error('Token not stored');
    await this.audit.record({
      action: 'scim.token_created',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'scim_token',
      targetId: row.id,
      details: { name },
    });
    return {
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: null,
      secret,
    };
  }

  async revokeToken(principal: Principal, id: string): Promise<void> {
    const revoked = await this.database.db
      .update(scimTokens)
      .set({ revokedAt: sql`now()` })
      .where(and(eq(scimTokens.id, id), isNull(scimTokens.revokedAt)))
      .returning({ id: scimTokens.id });
    if (revoked.length === 0) throw new NotFoundException('Token not found');
    await this.audit.record({
      action: 'scim.token_revoked',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'scim_token',
      targetId: id,
    });
  }

  /** Whether a bearer secret is a valid SCIM token; notes its use at most once a minute. */
  async authenticate(secret: string): Promise<boolean> {
    if (!secret.startsWith(SCIM_PREFIX)) return false;
    const [row] = await this.database.db
      .select({ id: scimTokens.id, lastUsedAt: scimTokens.lastUsedAt })
      .from(scimTokens)
      .where(and(eq(scimTokens.tokenHash, sha256(secret)), isNull(scimTokens.revokedAt)));
    if (!row) return false;
    if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
      await this.database.db
        .update(scimTokens)
        .set({ lastUsedAt: sql`now()` })
        .where(eq(scimTokens.id, row.id));
    }
    return true;
  }

  // ---------------------------------------------------------------- users

  private async userResource(base: string, id: string) {
    if (!UUID.test(id)) throw new ScimError(404, 'User not found');
    const [row] = await this.database.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), ne(users.id, AUTOMATION_ACTOR_ID), eq(users.kind, 'person')));
    if (!row) throw new ScimError(404, 'User not found');
    const memberOf = await this.database.db
      .select({ id: groups.id, name: groups.name })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(eq(groupMembers.userId, id))
      .orderBy(asc(groups.name));
    return this.presentUser(base, row, memberOf);
  }

  private presentUser(
    base: string,
    row: typeof users.$inferSelect,
    memberOf: Array<{ id: string; name: string }> = [],
  ) {
    return {
      schemas: [USER_SCHEMA],
      id: row.id,
      ...(row.scimExternalId ? { externalId: row.scimExternalId } : {}),
      userName: row.email,
      name: { formatted: row.displayName },
      displayName: row.displayName,
      emails: [{ value: row.email, type: 'work', primary: true }],
      active: row.status === 'active',
      groups: memberOf.map((group) => ({
        value: group.id,
        display: group.name,
        $ref: `${base}/Groups/${group.id}`,
      })),
      meta: {
        resourceType: 'User',
        created: row.createdAt.toISOString(),
        lastModified: row.updatedAt.toISOString(),
        location: `${base}/Users/${row.id}`,
      },
    };
  }

  async listUsers(base: string, filter: string | undefined, startIndex: number, size: number) {
    const parsed = parseFilter(filter);
    // Agents are not the identity provider's (TL-92).
    const conditions: SQL[] = [ne(users.id, AUTOMATION_ACTOR_ID), eq(users.kind, 'person')];
    if (parsed) {
      if (['username', 'emails.value', 'emails'].includes(parsed.attribute)) {
        conditions.push(eq(users.email, parsed.value.toLowerCase()));
      } else if (parsed.attribute === 'externalid') {
        conditions.push(eq(users.scimExternalId, parsed.value));
      } else if (parsed.attribute === 'id') {
        conditions.push(sql`${users.id}::text = ${parsed.value}`);
      } else {
        throw new ScimError(
          400,
          `Unsupported filter attribute: ${parsed.attribute}`,
          'invalidFilter',
        );
      }
    }
    const where = and(...conditions);
    const [total] = await this.database.db.select({ n: count() }).from(users).where(where);
    const rows = await this.database.db
      .select()
      .from(users)
      .where(where)
      .orderBy(asc(users.createdAt), asc(users.id))
      .limit(Math.min(size, MAX_COUNT))
      .offset(Math.max(startIndex, 1) - 1);
    return {
      schemas: [LIST_SCHEMA],
      totalResults: total?.n ?? 0,
      startIndex: Math.max(startIndex, 1),
      itemsPerPage: rows.length,
      Resources: rows.map((row) => this.presentUser(base, row)),
    };
  }

  getUser(base: string, id: string) {
    return this.userResource(base, id);
  }

  async createUser(base: string, body: Json) {
    const fields = userFields(body);
    if (!fields.email)
      throw new ScimError(400, 'userName or emails must hold an e-mail address', 'invalidValue');
    const [existing] = await this.database.db
      .select({ id: users.id, managed: users.scimManaged })
      .from(users)
      .where(eq(users.email, fields.email));
    let id = existing?.id;
    if (existing?.managed) {
      throw new ScimError(409, 'A user with this userName exists', 'uniqueness');
    }
    if (!id) {
      id = await this.userService.create({
        email: fields.email,
        displayName: fields.displayName ?? fields.email,
        // Sign-in through OIDC or SAML; SCIM never sets passwords.
        passwordHash: null,
        groupNames: ['users'],
      });
    }
    // An account that already existed is taken over by its e-mail address.
    await this.database.db
      .update(users)
      .set({ scimManaged: true, scimExternalId: fields.externalId ?? null })
      .where(eq(users.id, id));
    await this.applyUser(id, { ...fields, email: undefined });
    await this.audit.record({
      action: existing ? 'scim.user_linked' : 'scim.user_created',
      via: 'scim',
      targetType: 'user',
      targetId: id,
      details: { email: fields.email },
    });
    return this.userResource(base, id);
  }

  async replaceUser(base: string, id: string, body: Json) {
    await this.userResource(base, id);
    await this.applyUser(id, userFields(body));
    return this.userResource(base, id);
  }

  async patchUser(base: string, id: string, body: Json) {
    await this.userResource(base, id);
    const changes: UserChanges = {};
    for (const operation of this.operations(body)) {
      const { op, path, value } = operation;
      if (op === 'remove') {
        if (path?.toLowerCase() === 'externalid') changes.externalId = null;
        continue;
      }
      if (!path) {
        Object.assign(changes, userFields(value));
        // Okta and Entra also send dotted keys inside the value.
        for (const [key, entry] of Object.entries(value ?? {})) {
          Object.assign(changes, this.userPath(key, entry));
        }
      } else {
        Object.assign(changes, this.userPath(path, value));
      }
    }
    await this.applyUser(id, changes);
    return this.userResource(base, id);
  }

  private userPath(path: string, value: unknown): UserChanges {
    const key = path.toLowerCase();
    if (key === 'active') return { active: truthy(value) };
    if (key === 'displayname' || key === 'name.formatted') {
      return typeof value === 'string' && value.trim() ? { displayName: value.trim() } : {};
    }
    if (key === 'externalid') return { externalId: value ? String(value) : null };
    if (key === 'username' || key.startsWith('emails')) {
      const email = Array.isArray(value) ? value[0]?.value : value;
      return typeof email === 'string' && email.includes('@')
        ? { email: email.trim().toLowerCase() }
        : {};
    }
    return {};
  }

  private async applyUser(id: string, changes: UserChanges): Promise<void> {
    const [current] = await this.database.db.select().from(users).where(eq(users.id, id));
    if (!current) throw new ScimError(404, 'User not found');
    const set: Partial<typeof users.$inferInsert> = {};
    if (changes.displayName && changes.displayName !== current.displayName) {
      set.displayName = changes.displayName;
    }
    if (changes.email && changes.email !== current.email) set.email = changes.email;
    if (changes.externalId !== undefined) set.scimExternalId = changes.externalId;
    if (Object.keys(set).length > 0) {
      try {
        await this.database.db
          .update(users)
          .set({ ...set, updatedAt: sql`now()` })
          .where(eq(users.id, id));
      } catch {
        throw new ScimError(409, 'Another user has this e-mail address', 'uniqueness');
      }
    }
    if (changes.active === false && current.status === 'active') {
      await this.lifecycle.deactivate(id, SCIM_ACTOR);
      await this.audit.record({
        action: 'scim.user_deactivated',
        via: 'scim',
        targetType: 'user',
        targetId: id,
      });
    } else if (changes.active === true && current.status !== 'active') {
      await this.lifecycle.reactivate(id, SCIM_ACTOR);
      await this.audit.record({
        action: 'scim.user_reactivated',
        via: 'scim',
        targetType: 'user',
        targetId: id,
      });
    }
  }

  /** Deleting over SCIM deactivates: history, comments and authorship stay. */
  async deleteUser(base: string, id: string): Promise<void> {
    await this.userResource(base, id);
    await this.applyUser(id, { active: false });
  }

  // ---------------------------------------------------------------- groups

  private operations(body: Json): Array<{ op: string; path?: string; value: Json }> {
    const operations: Json[] = Array.isArray(body?.Operations) ? body.Operations : [];
    if (operations.length === 0) throw new ScimError(400, 'No Operations', 'invalidSyntax');
    return operations.map((operation) => ({
      op: String(operation?.op ?? '').toLowerCase(),
      path: typeof operation?.path === 'string' ? operation.path : undefined,
      value: operation?.value,
    }));
  }

  private async groupResource(base: string, id: string) {
    if (!UUID.test(id)) throw new ScimError(404, 'Group not found');
    const [row] = await this.database.db.select().from(groups).where(eq(groups.id, id));
    if (!row) throw new ScimError(404, 'Group not found');
    const members = await this.database.db
      .select({ id: users.id, name: users.displayName })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(eq(groupMembers.groupId, id))
      .orderBy(asc(users.displayName));
    return this.presentGroup(base, row, members);
  }

  private presentGroup(
    base: string,
    row: typeof groups.$inferSelect,
    members: Array<{ id: string; name: string }> | null,
  ) {
    return {
      schemas: [GROUP_SCHEMA],
      id: row.id,
      ...(row.scimExternalId ? { externalId: row.scimExternalId } : {}),
      displayName: row.name,
      ...(members
        ? {
            members: members.map((member) => ({
              value: member.id,
              display: member.name,
              $ref: `${base}/Users/${member.id}`,
            })),
          }
        : {}),
      meta: {
        resourceType: 'Group',
        created: row.createdAt.toISOString(),
        location: `${base}/Groups/${row.id}`,
      },
    };
  }

  async listGroups(base: string, filter: string | undefined, startIndex: number, size: number) {
    const parsed = parseFilter(filter);
    let where: SQL | undefined;
    if (parsed) {
      if (parsed.attribute === 'displayname') where = eq(groups.name, parsed.value);
      else if (parsed.attribute === 'externalid') where = eq(groups.scimExternalId, parsed.value);
      else if (parsed.attribute === 'id') where = sql`${groups.id}::text = ${parsed.value}`;
      else
        throw new ScimError(
          400,
          `Unsupported filter attribute: ${parsed.attribute}`,
          'invalidFilter',
        );
    }
    const [total] = await this.database.db.select({ n: count() }).from(groups).where(where);
    const rows = await this.database.db
      .select()
      .from(groups)
      .where(where)
      .orderBy(asc(groups.name))
      .limit(Math.min(size, MAX_COUNT))
      .offset(Math.max(startIndex, 1) - 1);
    return {
      schemas: [LIST_SCHEMA],
      totalResults: total?.n ?? 0,
      startIndex: Math.max(startIndex, 1),
      itemsPerPage: rows.length,
      // Members only when one group is asked for; lists of large groups get slow.
      Resources: rows.map((row) => this.presentGroup(base, row, null)),
    };
  }

  getGroup(base: string, id: string) {
    return this.groupResource(base, id);
  }

  private async managedGroup(id: string) {
    if (!UUID.test(id)) throw new ScimError(404, 'Group not found');
    const [row] = await this.database.db.select().from(groups).where(eq(groups.id, id));
    if (!row) throw new ScimError(404, 'Group not found');
    if (!row.scimManaged) {
      throw new ScimError(403, 'This group is managed in Lenipo, not over SCIM');
    }
    return row;
  }

  private memberIds(value: Json): string[] {
    const list: Json[] = Array.isArray(value) ? value : value ? [value] : [];
    return list
      .map((entry) => (typeof entry === 'string' ? entry : entry?.value))
      .filter((entry): entry is string => typeof entry === 'string' && UUID.test(entry));
  }

  private async setMembers(groupId: string, ids: string[], mode: 'add' | 'remove' | 'replace') {
    const db = this.database.db;
    if (mode === 'replace') await db.delete(groupMembers).where(eq(groupMembers.groupId, groupId));
    if (ids.length === 0) return;
    if (mode === 'remove') {
      await db
        .delete(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), inArray(groupMembers.userId, ids)));
      return;
    }
    const known = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(inArray(users.id, ids), ne(users.id, AUTOMATION_ACTOR_ID), eq(users.kind, 'person')),
      );
    if (known.length === 0) return;
    await db
      .insert(groupMembers)
      .values(known.map((user) => ({ groupId, userId: user.id })))
      .onConflictDoNothing();
  }

  async createGroup(base: string, body: Json) {
    const name = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
    if (!name) throw new ScimError(400, 'displayName is required', 'invalidValue');
    const [taken] = await this.database.db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.name, name));
    if (taken) throw new ScimError(409, 'A group with this displayName exists', 'uniqueness');
    const id = uuidv7();
    await this.database.atomic(async () => {
      await this.database.db.insert(groups).values({
        id,
        name,
        description: 'Über SCIM verwaltet',
        scimManaged: true,
        scimExternalId: body?.externalId ? String(body.externalId) : null,
      });
      await this.setMembers(id, this.memberIds(body?.members), 'add');
    });
    await this.audit.record({
      action: 'scim.group_created',
      via: 'scim',
      targetType: 'group',
      targetId: id,
      details: { name },
    });
    return this.groupResource(base, id);
  }

  async replaceGroup(base: string, id: string, body: Json) {
    await this.managedGroup(id);
    await this.database.atomic(async () => {
      if (typeof body?.displayName === 'string' && body.displayName.trim()) {
        await this.renameGroup(id, body.displayName.trim());
      }
      await this.setMembers(id, this.memberIds(body?.members), 'replace');
    });
    return this.groupResource(base, id);
  }

  private async renameGroup(id: string, name: string) {
    try {
      await this.database.db.update(groups).set({ name }).where(eq(groups.id, id));
    } catch {
      throw new ScimError(409, 'A group with this displayName exists', 'uniqueness');
    }
  }

  async patchGroup(base: string, id: string, body: Json) {
    await this.managedGroup(id);
    await this.database.atomic(async () => {
      for (const { op, path, value } of this.operations(body)) {
        const target = path?.toLowerCase();
        const filtered = /^members\[\s*value\s+eq\s+"([^"]+)"\s*\]$/i.exec(path ?? '');
        if (filtered?.[1] && op === 'remove') {
          await this.setMembers(id, [filtered[1]], 'remove');
        } else if (target === 'members') {
          await this.setMembers(
            id,
            this.memberIds(value),
            op === 'replace' ? 'replace' : op === 'remove' ? 'remove' : 'add',
          );
          if (op === 'remove' && !value) await this.setMembers(id, [], 'replace');
        } else if (target === 'displayname' && typeof value === 'string') {
          await this.renameGroup(id, value.trim());
        } else if (target === 'externalid') {
          await this.database.db
            .update(groups)
            .set({ scimExternalId: value ? String(value) : null })
            .where(eq(groups.id, id));
        } else if (!path && value && typeof value === 'object') {
          if (typeof value.displayName === 'string')
            await this.renameGroup(id, value.displayName.trim());
          if (value.members) {
            await this.setMembers(
              id,
              this.memberIds(value.members),
              op === 'replace' ? 'replace' : 'add',
            );
          }
        } else {
          throw new ScimError(
            400,
            `Unsupported operation ${op} ${path ?? ''}`.trim(),
            'invalidPath',
          );
        }
      }
    });
    return this.groupResource(base, id);
  }

  async deleteGroup(id: string): Promise<void> {
    await this.managedGroup(id);
    await this.database.db.delete(groups).where(eq(groups.id, id));
    await this.audit.record({
      action: 'scim.group_deleted',
      via: 'scim',
      targetType: 'group',
      targetId: id,
    });
  }
}
