import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  Directory,
  DirectoryOrder,
  DirectorySyncResult,
  LdapConfig,
  SaveDirectoryRequest,
} from '@toolvibes/shared';
import { and, asc, count, eq, isNull, notInArray, sql } from 'drizzle-orm';
import { Client, type Entry } from 'ldapts';
import { v7 as uuidv7 } from 'uuid';
import type { Logger } from '../core/logger.js';
import { DATABASE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { directories, groupMembers, groups, users } from '../db/schema/index.js';
import { GroupService, USERS_GROUP } from './group.service.js';

type Row = typeof directories.$inferSelect;

/** RFC 4515: characters with a meaning in LDAP filters. */
export function escapeFilter(value: string): string {
  return value.replace(
    /[\\*()\0]/g,
    (char) => `\\${char.charCodeAt(0).toString(16).padStart(2, '0')}`,
  );
}

function first(value: Entry[string] | undefined): string {
  if (value === undefined) return '';
  const item = Array.isArray(value) ? value[0] : value;
  return item === undefined ? '' : Buffer.isBuffer(item) ? item.toString('utf8') : String(item);
}

function all(value: Entry[string] | undefined): string[] {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).map((item) =>
    Buffer.isBuffer(item) ? item.toString('utf8') : String(item),
  );
}

/** An LDAP person as Lenipo needs it. */
interface Person {
  dn: string;
  login: string;
  email: string;
  name: string;
}

/**
 * User directories (P-USR-04/07, E-119): the internal one and LDAP/AD servers in sign-in
 * order. Password sign-in asks them in order; the first that knows the name decides.
 */
@Injectable()
export class DirectoryService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(GroupService) private readonly groupService: GroupService,
  ) {}

  /** The directories in order; the internal one is created on first use. */
  private async rows(): Promise<Row[]> {
    const db = this.database.db;
    let rows = await db.select().from(directories).orderBy(asc(directories.position));
    if (!rows.some((row) => row.type === 'internal')) {
      await db
        .insert(directories)
        .values({ id: uuidv7(), name: 'Lenipo (intern)', type: 'internal', position: 0 });
      rows = await db.select().from(directories).orderBy(asc(directories.position));
    }
    return rows;
  }

  async list(): Promise<Directory[]> {
    const rows = await this.rows();
    const counts = await this.database.db
      .select({ directoryId: users.directoryId, total: count() })
      .from(users)
      .groupBy(users.directoryId);
    return rows.map((row) => {
      const { bindPassword, ...config } = (row.config ?? {}) as LdapConfig;
      return {
        id: row.id,
        name: row.name,
        type: row.type as Directory['type'],
        position: row.position,
        enabled: row.enabled,
        config: row.type === 'ldap' ? { ...config, hasPassword: !!bindPassword } : null,
        users: Number(
          counts.find((entry) =>
            row.type === 'internal' ? entry.directoryId === null : entry.directoryId === row.id,
          )?.total ?? 0,
        ),
        lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
        lastSyncResult: row.lastSyncResult,
      };
    });
  }

  async create(request: SaveDirectoryRequest): Promise<Directory[]> {
    const rows = await this.rows();
    await this.database.db.insert(directories).values({
      id: uuidv7(),
      name: request.name,
      type: 'ldap',
      position: Math.max(...rows.map((row) => row.position)) + 1,
      enabled: request.enabled,
      config: request.config,
    });
    return this.list();
  }

  private async ldapRow(id: string): Promise<Row> {
    const [row] = await this.database.db.select().from(directories).where(eq(directories.id, id));
    if (row?.type !== 'ldap') throw new NotFoundException('Directory not found');
    return row;
  }

  async update(id: string, request: SaveDirectoryRequest): Promise<Directory[]> {
    const row = await this.ldapRow(id);
    const stored = (row.config ?? {}) as LdapConfig;
    // An empty password keeps the stored one, so admins never see it again.
    const config = {
      ...request.config,
      bindPassword: request.config.bindPassword || stored.bindPassword,
    };
    await this.database.db
      .update(directories)
      .set({ name: request.name, enabled: request.enabled, config })
      .where(eq(directories.id, id));
    return this.list();
  }

  /** Removes an LDAP directory: its people are deactivated, its groups kept as ordinary ones. */
  async delete(id: string): Promise<Directory[]> {
    await this.ldapRow(id);
    const db = this.database.db;
    await db.update(users).set({ status: 'deactivated' }).where(eq(users.directoryId, id));
    await db.update(groups).set({ directoryId: null }).where(eq(groups.directoryId, id));
    await db.delete(directories).where(eq(directories.id, id));
    return this.list();
  }

  async reorder(order: DirectoryOrder): Promise<Directory[]> {
    const rows = await this.rows();
    if (order.ids.length !== rows.length || !rows.every((row) => order.ids.includes(row.id))) {
      throw new BadRequestException('Name every directory exactly once');
    }
    for (const [position, id] of order.ids.entries()) {
      await this.database.db.update(directories).set({ position }).where(eq(directories.id, id));
    }
    return this.list();
  }

  // ---------------------------------------------------------------- LDAP

  private async connect(config: LdapConfig): Promise<Client> {
    const client = new Client({ url: config.url, timeout: 10_000, connectTimeout: 10_000 });
    if (config.startTls) await client.startTLS({});
    if (config.bindDn) await client.bind(config.bindDn, config.bindPassword);
    return client;
  }

  private person(config: LdapConfig, entry: Entry): Person | null {
    const email = first(entry[config.emailAttribute]).toLowerCase();
    const login = first(entry[config.loginAttribute]);
    if (!email) return null;
    return {
      dn: entry.dn,
      login,
      email,
      name: first(entry[config.nameAttribute]) || login || email,
    };
  }

  private async findPerson(config: LdapConfig, login: string): Promise<Person | null> {
    const client = await this.connect(config);
    try {
      const value = escapeFilter(login);
      const { searchEntries } = await client.search(config.userBase, {
        scope: 'sub',
        filter: `(&${config.userFilter}(|(${config.loginAttribute}=${value})(${config.emailAttribute}=${value})))`,
        attributes: [config.loginAttribute, config.emailAttribute, config.nameAttribute],
        sizeLimit: 2,
      });
      // Ambiguous names sign in nobody.
      return searchEntries.length === 1 ? this.person(config, searchEntries[0] as Entry) : null;
    } finally {
      await client.unbind().catch(() => undefined);
    }
  }

  private async passwordOk(config: LdapConfig, dn: string, password: string): Promise<boolean> {
    if (!password) return false;
    const client = new Client({ url: config.url, timeout: 10_000, connectTimeout: 10_000 });
    try {
      if (config.startTls) await client.startTLS({});
      await client.bind(dn, password);
      return true;
    } catch {
      return false;
    } finally {
      await client.unbind().catch(() => undefined);
    }
  }

  /** Creates or updates the Lenipo account of an LDAP person; null if a local account has the e-mail. */
  private async upsert(
    directoryId: string,
    person: Person,
  ): Promise<{ id: string; created: boolean } | null> {
    const db = this.database.db;
    const [known] = await db
      .select()
      .from(users)
      .where(and(eq(users.directoryId, directoryId), eq(users.externalId, person.dn)));
    const [byEmail] = known
      ? [known]
      : await db.select().from(users).where(eq(users.email, person.email));
    if (byEmail && byEmail.directoryId !== directoryId) {
      // Local accounts with a password stay local; password-less ones (e.g. imported) are adopted.
      if (byEmail.passwordHash || byEmail.directoryId) return null;
    }
    if (byEmail) {
      await db
        .update(users)
        .set({
          email: person.email,
          displayName: person.name,
          directoryId,
          externalId: person.dn,
          status: 'active',
          updatedAt: sql`now()`,
        })
        .where(eq(users.id, byEmail.id));
      return { id: byEmail.id, created: false };
    }
    const id = uuidv7();
    await db.insert(users).values({
      id,
      email: person.email,
      displayName: person.name,
      passwordHash: null,
      directoryId,
      externalId: person.dn,
    });
    const [everyone] = await this.groupService.idsByName([USERS_GROUP], db);
    if (everyone)
      await db.insert(groupMembers).values({ groupId: everyone, userId: id }).onConflictDoNothing();
    return { id, created: true };
  }

  /**
   * Password sign-in through the directories in order (P-USR-07): the internal directory
   * decides for its own accounts, an LDAP directory for the people it finds. Unreachable
   * directories are skipped.
   */
  async authenticate(
    login: string,
    password: string,
  ): Promise<{ decided: boolean; userId: string | null }> {
    const rows = (await this.rows()).filter((row) => row.enabled);
    for (const row of rows) {
      if (row.type === 'internal') {
        const [local] = await this.database.db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.email, login.toLowerCase()), isNull(users.directoryId)));
        if (local) return { decided: false, userId: null };
        continue;
      }
      const config = row.config as LdapConfig;
      let person: Person | null;
      try {
        person = await this.findPerson(config, login);
      } catch (error) {
        this.logger.warn({ err: error, directory: row.id }, 'LDAP directory unreachable');
        continue;
      }
      if (!person) continue;
      if (!(await this.passwordOk(config, person.dn, password)))
        return { decided: true, userId: null };
      const account = await this.upsert(row.id, person);
      return { decided: true, userId: account?.id ?? null };
    }
    return { decided: false, userId: null };
  }

  async test(config: LdapConfig): Promise<{ ok: boolean; message: string }> {
    try {
      const client = await this.connect(config);
      try {
        const { searchEntries } = await client.search(config.userBase, {
          scope: 'sub',
          filter: config.userFilter,
          attributes: [config.emailAttribute],
          sizeLimit: 1000,
        });
        return { ok: true, message: `${searchEntries.length} Personen gefunden` };
      } finally {
        await client.unbind().catch(() => undefined);
      }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /** Mirrors people and groups of a directory (P-USR-04); people gone from it are deactivated. */
  async sync(id: string): Promise<DirectorySyncResult> {
    const row = await this.ldapRow(id);
    const config = row.config as LdapConfig;
    const db = this.database.db;
    const result: DirectorySyncResult = {
      created: 0,
      updated: 0,
      deactivated: 0,
      groups: 0,
      problems: [],
    };
    try {
      const client = await this.connect(config);
      try {
        const { searchEntries } = await client.search(config.userBase, {
          scope: 'sub',
          filter: config.userFilter,
          attributes: [config.loginAttribute, config.emailAttribute, config.nameAttribute],
          paged: { pageSize: 500 },
        });
        const byDn = new Map<string, string>();
        const byLogin = new Map<string, string>();
        for (const entry of searchEntries) {
          const person = this.person(config, entry);
          if (!person) {
            result.problems.push(`${entry.dn}: ohne E-Mail-Adresse übersprungen`);
            continue;
          }
          const account = await this.upsert(row.id, person);
          if (!account) {
            result.problems.push(
              `${person.email}: lokales Konto mit derselben Adresse, nicht übernommen`,
            );
            continue;
          }
          if (account.created) result.created += 1;
          else result.updated += 1;
          byDn.set(person.dn.toLowerCase(), account.id);
          if (person.login) byLogin.set(person.login.toLowerCase(), account.id);
        }
        const keep = [...new Set(byDn.values())];
        const gone = await db
          .update(users)
          .set({ status: 'deactivated' })
          .where(
            and(
              eq(users.directoryId, row.id),
              eq(users.status, 'active'),
              keep.length ? notInArray(users.id, keep) : undefined,
            ),
          )
          .returning({ id: users.id });
        result.deactivated = gone.length;

        if (config.groupBase) {
          const found = await client.search(config.groupBase, {
            scope: 'sub',
            filter: config.groupFilter,
            attributes: [config.groupNameAttribute, config.groupMemberAttribute],
            paged: { pageSize: 500 },
          });
          for (const entry of found.searchEntries) {
            const name = first(entry[config.groupNameAttribute]);
            if (!name) continue;
            const [existing] = await db.select().from(groups).where(eq(groups.name, name));
            if (existing && existing.directoryId !== row.id) {
              result.problems.push(`Gruppe ${name}: gibt es schon in Lenipo, nicht übernommen`);
              continue;
            }
            const groupId = existing?.id ?? uuidv7();
            if (!existing) {
              await db
                .insert(groups)
                .values({ id: groupId, name, description: `Aus ${row.name}`, directoryId: row.id });
            }
            const members = all(entry[config.groupMemberAttribute])
              .map((value) => byDn.get(value.toLowerCase()) ?? byLogin.get(value.toLowerCase()))
              .filter((value): value is string => !!value);
            await db.delete(groupMembers).where(eq(groupMembers.groupId, groupId));
            if (members.length) {
              await db
                .insert(groupMembers)
                .values([...new Set(members)].map((userId) => ({ groupId, userId })))
                .onConflictDoNothing();
            }
            result.groups += 1;
          }
        }
      } finally {
        await client.unbind().catch(() => undefined);
      }
    } catch (error) {
      result.problems.push(`Verbindung: ${error instanceof Error ? error.message : String(error)}`);
    }
    await db
      .update(directories)
      .set({
        lastSyncAt: sql`now()`,
        lastSyncResult: `${result.created} neu, ${result.updated} aktualisiert, ${result.deactivated} deaktiviert, ${result.groups} Gruppen${result.problems.length ? `; ${result.problems.length} Hinweise` : ''}`,
      })
      .where(eq(directories.id, row.id));
    return result;
  }

  /** Hourly from the worker: every enabled LDAP directory. */
  async syncAll(): Promise<void> {
    const rows = await this.database.db
      .select({ id: directories.id })
      .from(directories)
      .where(and(eq(directories.type, 'ldap'), eq(directories.enabled, true)));
    for (const row of rows) await this.sync(row.id);
  }
}
