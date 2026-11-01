import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ImportJob, ImportReport, ImportSource, JiraImportRequest } from '@toolvibes/shared';
import { desc, eq, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AuditService } from '../audit/audit.service.js';
import { BoardService } from '../boards/board.service.js';
import type { Principal } from '../core/http/principal.js';
import type { Logger } from '../core/logger.js';
import { DATABASE, FILE_STORE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { importJobs, users } from '../db/schema/index.js';
import { extractZip } from '../storage/extract-zip.js';
import type { FileStore } from '../storage/file-store.js';
import type { SpooledUpload } from '../storage/upload.js';
import { MetaService } from '../tracking/meta.service.js';
import { ProjectService } from '../tracking/project.service.js';
import { SpaceService } from '../wiki/space.service.js';
import { ArchiveImporter } from './archive.importer.js';
import { ConfluenceImporter } from './confluence.importer.js';
import { JiraImporter, JiraSource } from './jira.importer.js';

type JobRow = typeof importJobs.$inferSelect;

/** Import jobs for the worker (TL-35, E-118): dry run first, then the real run. */
@Injectable()
export class ImportService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(FILE_STORE) private readonly store: FileStore,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(BoardService) private readonly boards: BoardService,
    @Inject(MetaService) private readonly meta: MetaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(SpaceService) private readonly spaces: SpaceService,
  ) {}

  private async present(rows: JobRow[]): Promise<ImportJob[]> {
    const people = await this.database.db
      .select({ id: users.id, displayName: users.displayName })
      .from(users);
    return rows.map((row) => ({
      id: row.id,
      source: row.source as ImportSource,
      dryRun: row.dryRun,
      label: row.label,
      state: row.state as ImportJob['state'],
      progress: row.progress,
      log: row.log,
      report: (row.report as ImportReport | null) ?? null,
      createdBy: people.find((person) => person.id === row.createdById) ?? null,
      createdAt: row.createdAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString() ?? null,
    }));
  }

  async list(): Promise<ImportJob[]> {
    const rows = await this.database.db
      .select()
      .from(importJobs)
      .orderBy(desc(importJobs.createdAt))
      .limit(50);
    return this.present(rows);
  }

  async get(id: string): Promise<ImportJob> {
    const [row] = await this.database.db.select().from(importJobs).where(eq(importJobs.id, id));
    if (!row) throw new NotFoundException('Import not found');
    const [job] = await this.present([row]);
    return job as ImportJob;
  }

  async jira(principal: Principal, request: JiraImportRequest): Promise<ImportJob> {
    const id = uuidv7();
    const url = request.url.replace(/\/+$/, '');
    await this.database.db.insert(importJobs).values({
      id,
      source: 'jira',
      dryRun: request.dryRun,
      label: `Jira ${url}: ${request.projectKeys.join(', ')}`,
      params: { url, token: request.token, projectKeys: request.projectKeys },
      createdById: principal.userId,
    });
    await this.audit.record({
      action: request.dryRun ? 'import.dry_run' : 'import.started',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'import',
      targetId: id,
      details: { source: 'jira', url, projects: request.projectKeys },
    });
    return this.get(id);
  }

  /** A Confluence space export, kept in the file store until it is imported (P-ADM-11). */
  async confluence(
    principal: Principal,
    upload: SpooledUpload,
    options: { spaceKey?: string; dryRun: boolean },
  ): Promise<ImportJob> {
    if (!upload.fileName.toLowerCase().endsWith('.zip')) {
      throw new BadRequestException('Erwartet wird der XML-Export eines Bereichs als ZIP');
    }
    const id = uuidv7();
    const storageKey = `imports/${id}`;
    await this.store.put(storageKey, upload.path, 'application/zip');
    await this.database.db.insert(importJobs).values({
      id,
      source: 'confluence',
      dryRun: options.dryRun,
      label: `Confluence ${upload.fileName}${options.spaceKey ? ` → ${options.spaceKey}` : ''}`,
      params: { storageKey, fileName: upload.fileName, spaceKey: options.spaceKey ?? null },
      createdById: principal.userId,
    });
    await this.audit.record({
      action: options.dryRun ? 'import.dry_run' : 'import.started',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'import',
      targetId: id,
      details: { source: 'confluence', file: upload.fileName },
    });
    return this.get(id);
  }

  /** A project or space archive of another Lenipo instance (TL-39, E-120). */
  async archive(
    principal: Principal,
    upload: SpooledUpload,
    options: { targetKey?: string; dryRun: boolean },
  ): Promise<ImportJob> {
    if (!upload.fileName.toLowerCase().endsWith('.zip')) {
      throw new BadRequestException('Erwartet wird ein Lenipo-Archiv als ZIP');
    }
    const id = uuidv7();
    const storageKey = `imports/${id}`;
    await this.store.put(storageKey, upload.path, 'application/zip');
    await this.database.db.insert(importJobs).values({
      id,
      source: 'archive',
      dryRun: options.dryRun,
      label: `Lenipo-Archiv ${upload.fileName}${options.targetKey ? ` → ${options.targetKey}` : ''}`,
      params: { storageKey, fileName: upload.fileName, targetKey: options.targetKey ?? null },
      createdById: principal.userId,
    });
    await this.audit.record({
      action: options.dryRun ? 'import.dry_run' : 'import.started',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'import',
      targetId: id,
      details: { source: 'archive', file: upload.fileName },
    });
    return this.get(id);
  }

  private async archiveRun(job: JobRow, progress: (text: string) => Promise<void>) {
    const params = job.params as { storageKey: string; targetKey: string | null };
    const folder = await mkdtemp(join(tmpdir(), 'tl-archive-'));
    try {
      const zip = join(folder, 'archive.zip');
      await pipeline(await this.store.get(params.storageKey), createWriteStream(zip));
      const content = join(folder, 'content');
      await extractZip(
        zip,
        content,
        (name) => name === 'archive.json' || /^files\/[0-9a-f-]{36}$/.test(name),
      );
      const importer = new ArchiveImporter(content, {
        database: this.database,
        store: this.store,
        projects: this.projects,
        spaces: this.spaces,
        meta: this.meta,
        principal: { userId: job.createdById as string, via: 'session', sessionId: 'import' },
        dryRun: job.dryRun,
        progress,
      });
      const report = await importer.run(params.targetKey ?? undefined);
      if (!job.dryRun) await this.store.delete(params.storageKey).catch(() => undefined);
      return report;
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  /** Imports for real what a Confluence dry run checked, without uploading the export again. */
  async runAfterDryRun(principal: Principal, id: string): Promise<ImportJob> {
    const [row] = await this.database.db.select().from(importJobs).where(eq(importJobs.id, id));
    if (
      (row?.source !== 'confluence' && row?.source !== 'archive') ||
      !row.dryRun ||
      row.state !== 'done'
    ) {
      throw new BadRequestException(
        'Nur ein fertiger Probelauf (Confluence oder Archiv) lässt sich so übernehmen',
      );
    }
    const next = uuidv7();
    await this.database.db.insert(importJobs).values({
      id: next,
      source: row.source,
      dryRun: false,
      label: row.label,
      params: row.params,
      createdById: principal.userId,
    });
    return this.get(next);
  }

  private async confluenceRun(job: JobRow, progress: (text: string) => Promise<void>) {
    const params = job.params as { storageKey: string; fileName: string; spaceKey: string | null };
    const folder = await mkdtemp(join(tmpdir(), 'tl-import-'));
    try {
      const zip = join(folder, 'export.zip');
      await pipeline(await this.store.get(params.storageKey), createWriteStream(zip));
      const importer = new ConfluenceImporter(zip, params.fileName, {
        database: this.database,
        store: this.store,
        spaces: this.spaces,
        principal: { userId: job.createdById as string, via: 'session', sessionId: 'import' },
        dryRun: job.dryRun,
        progress,
      });
      const report = await importer.run(params.spaceKey ?? undefined);
      // The export is no longer needed once it is in.
      if (!job.dryRun) await this.store.delete(params.storageKey).catch(() => undefined);
      return report;
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  /** Runs the oldest waiting job, if any; returns whether one ran. Safe with several workers. */
  async runPending(): Promise<boolean> {
    const [job] = await this.database.db
      .update(importJobs)
      .set({ state: 'running', startedAt: sql`now()` })
      .where(
        eq(
          importJobs.id,
          sql`(select id from ${importJobs} where ${importJobs.state} = 'pending' order by ${importJobs.createdAt} limit 1 for update skip locked)`,
        ),
      )
      .returning();
    if (!job) return false;
    const log = async (line: string) => {
      await this.database.db
        .update(importJobs)
        .set({ log: sql`array_append(${importJobs.log}, ${line})` })
        .where(eq(importJobs.id, job.id));
    };
    const progress = async (text: string) => {
      await this.database.db
        .update(importJobs)
        .set({ progress: text })
        .where(eq(importJobs.id, job.id));
    };
    const params = job.params as { url: string; token: string; projectKeys: string[] };
    try {
      if (!job.createdById) throw new Error('Wer den Import gestartet hat, gibt es nicht mehr');
      if (job.source === 'confluence' || job.source === 'archive') {
        const report =
          job.source === 'archive'
            ? await this.archiveRun(job, progress)
            : await this.confluenceRun(job, progress);
        await this.database.db
          .update(importJobs)
          .set({
            state: 'done',
            report,
            progress: job.dryRun ? 'Probelauf fertig' : 'Fertig',
            finishedAt: sql`now()`,
          })
          .where(eq(importJobs.id, job.id));
        return true;
      }
      const importer = new JiraImporter(new JiraSource(params.url, params.token), {
        database: this.database,
        store: this.store,
        projects: this.projects,
        boards: this.boards,
        meta: this.meta,
        principal: { userId: job.createdById, via: 'session', sessionId: 'import' },
        dryRun: job.dryRun,
        log,
        progress,
      });
      const report = await importer.run(params.projectKeys);
      await this.database.db
        .update(importJobs)
        .set({
          state: 'done',
          report,
          progress: job.dryRun ? 'Probelauf fertig' : 'Fertig',
          finishedAt: sql`now()`,
          params: { ...params, token: null },
        })
        .where(eq(importJobs.id, job.id));
    } catch (error) {
      this.logger.error({ err: error, job: job.id }, 'Import failed');
      await log(`Fehler: ${error instanceof Error ? error.message : String(error)}`);
      await this.database.db
        .update(importJobs)
        .set({
          state: 'failed',
          finishedAt: sql`now()`,
          params: job.source === 'jira' ? { ...params, token: null } : job.params,
        })
        .where(eq(importJobs.id, job.id));
    }
    return true;
  }
}
