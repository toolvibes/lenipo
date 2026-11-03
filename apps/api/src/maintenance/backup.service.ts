import { once } from 'node:events';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type Backup, BackupSettings, type RestoreResult } from '@toolvibes/shared';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { strToU8, Zip, ZipDeflate } from 'fflate';
import type { TransactionSql } from 'postgres';
import { v7 as uuidv7 } from 'uuid';
import type { Logger } from '../core/logger.js';
import { DATABASE, FILE_STORE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { backups, systemSettings } from '../db/schema/index.js';
import { API_VERSION } from '../openapi/version.js';
import { extractZip } from '../storage/extract-zip.js';
import type { FileStore } from '../storage/file-store.js';
import { type TableInfo, tableOrder } from './table-order.js';

const SETTINGS_KEY = 'backups';
export const BACKUP_FORMAT = 'lenipo-backup';
const FORMAT_VERSION = 1;
/** Not worth keeping or harmful to bring back: the backup list itself and sign-in state. */
// Embeddings are rebuilt from the content, and the target may lack pgvector (TL-49).
const SKIPPED_TABLES = [
  'backups',
  'sessions',
  'oidc_login_attempts',
  'collab_writes',
  'semantic_embeddings',
];
const STORAGE_KEY = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/;
const TABLE_NAME = /^[a-z0-9_]+$/;
const BATCH_ROWS = 200;
const BATCH_BYTES = 4 * 1024 * 1024;

interface Manifest {
  format: string;
  formatVersion: number;
  createdAt: string;
  apiVersion: string;
  migrations: number;
  tables: Record<string, number>;
  files: number;
}

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

type Row = typeof backups.$inferSelect;

function present(row: Row): Backup {
  return {
    id: row.id,
    trigger: row.trigger as Backup['trigger'],
    state: row.state as Backup['state'],
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    sizeBytes: row.sizeBytes,
    rows: row.rows,
    files: row.files,
    error: row.error,
  };
}

async function* filesBelow(directory: string): AsyncGenerator<string> {
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* filesBelow(path);
    else yield path;
  }
}

/**
 * Logical backups (TL-39, E-120): every table as JSON lines plus the attachment files, in one
 * ZIP in the file store. A restore goes into a fresh instance from the setup screen and needs
 * the same database migrations.
 */
@Injectable()
export class BackupService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(FILE_STORE) private readonly store: FileStore,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  async settings(): Promise<BackupSettings> {
    const [row] = await this.database.db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, SETTINGS_KEY));
    return BackupSettings.parse(row?.value ?? {});
  }

  async setSettings(settings: BackupSettings): Promise<BackupSettings> {
    await this.database.db
      .insert(systemSettings)
      .values({ key: SETTINGS_KEY, value: settings })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: settings, updatedAt: new Date() },
      });
    return settings;
  }

  async list(): Promise<Backup[]> {
    const rows = await this.database.db.select().from(backups).orderBy(desc(backups.createdAt));
    return rows.map(present);
  }

  async get(id: string): Promise<Backup> {
    const [row] = await this.database.db.select().from(backups).where(eq(backups.id, id));
    if (!row) throw new NotFoundException('Backup not found');
    return present(row);
  }

  /** Starts a backup and returns at once; the list shows when it is done. */
  async start(trigger: Backup['trigger'], userId: string | null): Promise<Backup> {
    const id = uuidv7();
    const [row] = await this.database.db
      .insert(backups)
      .values({ id, trigger, createdById: userId })
      .returning();
    void this.write(id);
    return present(row as Row);
  }

  /** Runs a backup to the end; for the scheduler, the CLI and tests. */
  async create(trigger: Backup['trigger'], userId: string | null): Promise<Backup> {
    const id = uuidv7();
    await this.database.db.insert(backups).values({ id, trigger, createdById: userId });
    await this.write(id);
    return this.get(id);
  }

  async download(id: string): Promise<{ stream: Readable; fileName: string; size: number }> {
    const backup = await this.get(id);
    if (backup.state !== 'done') throw new NotFoundException('The backup is not finished');
    const day = backup.createdAt.slice(0, 16).replace(/[T:]/g, '-');
    return {
      stream: await this.store.get(`backups/${id}`),
      fileName: `lenipo-backup-${day}.zip`,
      size: backup.sizeBytes ?? 0,
    };
  }

  async delete(id: string): Promise<void> {
    const [row] = await this.database.db.delete(backups).where(eq(backups.id, id)).returning();
    if (!row) throw new NotFoundException('Backup not found');
    await this.store.delete(`backups/${id}`);
  }

  /** Called every few minutes: one scheduled backup a day at the set hour, old ones pruned. */
  async runScheduled(now = new Date()): Promise<void> {
    const settings = await this.settings();
    // A backup that has been running for hours died with its process.
    await this.database.db
      .update(backups)
      .set({ state: 'failed', error: 'Interrupted', finishedAt: sql`now()` })
      .where(
        and(
          eq(backups.state, 'running'),
          lt(backups.createdAt, new Date(now.getTime() - 6 * 3_600_000)),
        ),
      );
    if (!settings.enabled || now.getHours() !== settings.hour) return;
    const since = new Date(now.getTime() - 20 * 3_600_000);
    const [recent] = await this.database.db
      .select({ id: backups.id })
      .from(backups)
      .where(and(eq(backups.trigger, 'scheduled'), gte(backups.createdAt, since)));
    if (recent) return;
    const backup = await this.create('scheduled', null);
    if (backup.state !== 'done') return;
    const scheduled = await this.database.db
      .select({ id: backups.id })
      .from(backups)
      .where(and(eq(backups.trigger, 'scheduled'), eq(backups.state, 'done')))
      .orderBy(desc(backups.createdAt));
    for (const old of scheduled.slice(settings.keep)) await this.delete(old.id);
  }

  private async migrations(): Promise<number> {
    const [row] = await this.database.sql<{ applied: number }[]>`
      select count(*)::int as applied from drizzle.__drizzle_migrations`;
    return row?.applied ?? 0;
  }

  private async write(id: string): Promise<void> {
    const directory = await mkdtemp(join(tmpdir(), 'lenipo-backup-'));
    const path = join(directory, 'backup.zip');
    try {
      const { rows, files } = await this.writeZip(path);
      const { size } = await stat(path);
      await this.store.put(`backups/${id}`, path, 'application/zip');
      await this.database.db
        .update(backups)
        .set({ state: 'done', finishedAt: sql`now()`, sizeBytes: size, rows, files })
        .where(eq(backups.id, id));
      this.logger.info({ id, size, rows, files }, 'Backup written');
    } catch (error) {
      this.logger.error({ err: error, id }, 'Backup failed');
      await this.database.db
        .update(backups)
        .set({
          state: 'failed',
          finishedAt: sql`now()`,
          error: error instanceof Error ? error.message : String(error),
        })
        .where(eq(backups.id, id));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  private async writeZip(path: string): Promise<{ rows: number; files: number }> {
    const out = createWriteStream(path);
    let zipError: Error | null = null;
    const zip = new Zip((error, chunk, final) => {
      if (error) {
        zipError = error;
        return;
      }
      out.write(chunk);
      if (final) out.end();
    });
    const drain = async () => {
      if (zipError) throw zipError;
      if (out.writableNeedDrain) await once(out, 'drain');
    };
    const manifest: Manifest = {
      format: BACKUP_FORMAT,
      formatVersion: FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      apiVersion: API_VERSION,
      migrations: await this.migrations(),
      tables: {},
      files: 0,
    };
    let rows = 0;
    // One snapshot for every table, so the backup is consistent while people keep working.
    await this.database.sql.begin('isolation level repeatable read read only', async (tx) => {
      for (const table of await tableOrder(tx, SKIPPED_TABLES)) {
        const entry = new ZipDeflate(`tables/${table.name}.jsonl`, { level: 6 });
        zip.add(entry);
        let count = 0;
        await tx
          .unsafe<{ r: string }[]>(`select to_jsonb(t)::text as r from ${quote(table.name)} t`)
          .cursor(500, async (batch) => {
            entry.push(strToU8(`${batch.map((row) => row.r).join('\n')}\n`));
            count += batch.length;
            await drain();
          });
        entry.push(new Uint8Array(0), true);
        manifest.tables[table.name] = count;
        rows += count;
      }
      const keys = await tx<{ key: string }[]>`
        select storage_key as key from issue_attachments
        union all select storage_key from page_attachments`;
      for (const { key } of keys) {
        let content: Readable;
        try {
          content = await this.store.get(key);
        } catch (error) {
          this.logger.warn({ err: error, key }, 'File missing from the backup');
          continue;
        }
        // Stored, not compressed: attachments rarely shrink, and deflate keeps the stream
        // readable without sizes in the headers.
        const entry = new ZipDeflate(`files/${key}`, { level: 0 });
        zip.add(entry);
        for await (const chunk of content) {
          entry.push(chunk as Uint8Array);
          await drain();
        }
        entry.push(new Uint8Array(0), true);
        manifest.files += 1;
      }
    });
    const entry = new ZipDeflate('manifest.json', { level: 6 });
    zip.add(entry);
    entry.push(strToU8(JSON.stringify(manifest, null, 2)), true);
    zip.end();
    if (!out.writableFinished) await once(out, 'finish');
    if (zipError) throw zipError;
    return { rows, files: manifest.files };
  }

  /**
   * Replaces everything in this instance with the backup: files first, then all tables in one
   * transaction. Only for a fresh instance; the caller checks that.
   */
  async restore(zipPath: string): Promise<RestoreResult> {
    const directory = await mkdtemp(join(tmpdir(), 'lenipo-restore-'));
    try {
      await extractZip(
        zipPath,
        directory,
        (name) =>
          name === 'manifest.json' ||
          (name.startsWith('tables/') &&
            name.endsWith('.jsonl') &&
            TABLE_NAME.test(name.slice(7, -6))) ||
          (name.startsWith('files/') && STORAGE_KEY.test(name.slice(6))),
      );
      const manifest = JSON.parse(
        await readFile(join(directory, 'manifest.json'), 'utf8').catch(() => '{}'),
      ) as Partial<Manifest>;
      // Backups made under the old name Tasklore still restore (E-129).
      const format = manifest.format as string | undefined;
      if (
        (format !== BACKUP_FORMAT && format !== 'tasklore-backup') ||
        manifest.formatVersion !== FORMAT_VERSION
      )
        throw new RestoreError('This is not a Lenipo backup');
      const migrations = await this.migrations();
      if (manifest.migrations !== migrations)
        throw new RestoreError(
          `The backup is from Lenipo ${manifest.apiVersion} with ${manifest.migrations} database migrations; this instance has ${migrations}. Restore it with the same version.`,
        );

      let files = 0;
      for await (const path of filesBelow(join(directory, 'files'))) {
        const key = relative(join(directory, 'files'), path).split('\\').join('/');
        await this.store.put(key, path, 'application/octet-stream');
        files += 1;
      }

      let rows = 0;
      const tables = await tableOrder(this.database.sql, SKIPPED_TABLES);
      await this.database.sql.begin(async (tx) => {
        const all = await tx<{ name: string }[]>`
          select table_name as name from information_schema.tables
          where table_schema = current_schema() and table_type = 'BASE TABLE'`;
        await tx.unsafe(
          `truncate table ${all.map((table) => quote(table.name)).join(', ')} restart identity cascade`,
        );
        const later: Array<{ table: TableInfo; rows: string[] }> = [];
        for (const table of tables) {
          const deferredRows: string[] = [];
          rows += await this.insertTable(
            tx,
            table,
            join(directory, 'tables', `${table.name}.jsonl`),
            deferredRows,
          );
          if (deferredRows.length > 0) later.push({ table, rows: deferredRows });
        }
        for (const { table, rows: pending } of later) {
          const set = table.deferred.map((column) => `${quote(column)} = s.${quote(column)}`);
          const match = table.primaryKey.map((column) => `t.${quote(column)} = s.${quote(column)}`);
          for (let start = 0; start < pending.length; start += BATCH_ROWS) {
            await tx.unsafe(
              `update ${quote(table.name)} t set ${set.join(', ')}
               from json_populate_recordset(null::${quote(table.name)}, $1::json) s
               where ${match.join(' and ')}`,
              [`[${pending.slice(start, start + BATCH_ROWS).join(',')}]`],
            );
          }
        }
        // Sequences continue after the restored ids.
        const sequences = await tx<{ table_name: string; column_name: string }[]>`
          select table_name, column_name from information_schema.columns
          where table_schema = current_schema()
            and (column_default like 'nextval(%' or is_identity = 'YES')`;
        for (const { table_name, column_name } of sequences) {
          await tx.unsafe(
            `select setval(pg_get_serial_sequence($1, $2), coalesce(max(${quote(column_name)}), 0) + 1, false) from ${quote(table_name)}`,
            [quote(table_name), column_name],
          );
        }
      });
      this.logger.info({ tables: tables.length, rows, files }, 'Backup restored');
      return { tables: tables.length, rows, files };
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  /** Inserts the rows of one table in batches; returns how many. */
  private async insertTable(
    tx: TransactionSql,
    table: TableInfo,
    path: string,
    deferredRows: string[],
  ): Promise<number> {
    const exists = await stat(path).then(
      () => true,
      () => false,
    );
    if (!exists) return 0;
    if (table.deferred.length > 0 && table.primaryKey.length === 0)
      throw new RestoreError(`Table ${table.name} has no primary key`);
    const columns = table.columns.map(quote).join(', ');
    const values = table.columns
      .map((column) => (table.deferred.includes(column) ? 'null' : quote(column)))
      .join(', ');
    const statement = `insert into ${quote(table.name)} (${columns}) overriding system value
      select ${values} from json_populate_recordset(null::${quote(table.name)}, $1::json)`;
    let batch: string[] = [];
    let bytes = 0;
    let count = 0;
    const flush = async () => {
      if (batch.length === 0) return;
      await tx.unsafe(statement, [`[${batch.join(',')}]`]);
      count += batch.length;
      batch = [];
      bytes = 0;
    };
    const lines = createInterface({
      input: createReadStream(path),
      crlfDelay: Number.POSITIVE_INFINITY,
    });
    for await (const line of lines) {
      if (!line) continue;
      batch.push(line);
      bytes += line.length;
      if (table.deferred.length > 0) {
        const row = JSON.parse(line) as Record<string, unknown>;
        if (table.deferred.some((column) => row[column] !== null && row[column] !== undefined))
          deferredRows.push(line);
      }
      if (batch.length >= BATCH_ROWS || bytes >= BATCH_BYTES) await flush();
    }
    await flush();
    return count;
  }
}

/** A backup that cannot be restored here; shown to the person restoring. */
export class RestoreError extends Error {}
