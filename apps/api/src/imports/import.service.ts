import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ImportJob, ImportReport, ImportSource, JiraImportRequest } from '@tasklore/shared';
import { desc, eq, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AuditService } from '../audit/audit.service.js';
import { BoardService } from '../boards/board.service.js';
import type { Principal } from '../core/http/principal.js';
import type { Logger } from '../core/logger.js';
import { DATABASE, FILE_STORE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { importJobs, users } from '../db/schema/index.js';
import type { FileStore } from '../storage/file-store.js';
import { MetaService } from '../tracking/meta.service.js';
import { ProjectService } from '../tracking/project.service.js';
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
        .set({ state: 'failed', finishedAt: sql`now()`, params: { ...params, token: null } })
        .where(eq(importJobs.id, job.id));
    }
    return true;
  }
}
