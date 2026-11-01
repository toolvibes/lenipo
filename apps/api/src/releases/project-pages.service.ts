import { Inject, Injectable } from '@nestjs/common';
import { markdownToDoc } from '@toolvibes/editor';
import {
  AUTOMATION_ACTOR_ID,
  type ProjectWikiPages,
  type RichText,
  type SprintReport,
} from '@toolvibes/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { ReportService } from '../boards/report.service.js';
import type { Principal } from '../core/http/principal.js';
import type { Logger } from '../core/logger.js';
import { DATABASE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { type domainEvents, pages, projects, spaces } from '../db/schema/index.js';
import { ProjectService } from '../tracking/project.service.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';
import { PageService } from '../wiki/page.service.js';
import { SpaceService } from '../wiki/space.service.js';
import { ReleaseService } from './release.service.js';

type EventRow = typeof domainEvents.$inferSelect;

const OFF: ProjectWikiPages = {
  spaceKey: null,
  retroOnSprintEnd: false,
  reportOnSprintEnd: false,
  notesOnRelease: false,
};

/**
 * Wiki pages a project creates by itself (W-INT-05, W-INT-06, TL-28, E-109): a retro page and a
 * sprint report on sprint completion, release notes on release. They come from the outbox and
 * are made by the automation actor; a label per sprint keeps them from being made twice.
 */
@Injectable()
export class ProjectPagesService {
  private readonly actor: Principal = {
    userId: AUTOMATION_ACTOR_ID,
    via: 'automation',
    ruleId: 'project-pages',
  };

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(SpaceService) private readonly spaces: SpaceService,
    @Inject(PageService) private readonly pages: PageService,
    @Inject(ReportService) private readonly reports: ReportService,
    @Inject(ReleaseService) private readonly releases: ReleaseService,
  ) {}

  async get(principal: Principal, projectKey: string): Promise<ProjectWikiPages> {
    const project = await this.projects.findBrowsable(principal, projectKey);
    return { ...OFF, ...((project.wikiPages as ProjectWikiPages | null) ?? {}) };
  }

  async set(
    principal: Principal,
    projectKey: string,
    value: ProjectWikiPages,
  ): Promise<ProjectWikiPages> {
    const project = await this.projects.findBrowsable(principal, projectKey);
    await this.projectAccess.require(principal, project.id, 'administer');
    // Whoever switches it on must be allowed to write in that space.
    if (value.spaceKey) await this.spaces.find(principal, value.spaceKey, 'edit');
    await this.database.db
      .update(projects)
      .set({ wikiPages: value })
      .where(eq(projects.id, project.id));
    return value;
  }

  private async exists(spaceId: string, label: string): Promise<boolean> {
    const [row] = await this.database.db
      .select({ id: pages.id })
      .from(pages)
      .where(
        and(
          eq(pages.spaceId, spaceId),
          isNull(pages.deletedAt),
          sql`${pages.labels} @> array[${label}]::text[]`,
        ),
      )
      .limit(1);
    return !!row;
  }

  /** Outbox consumer; failures are logged and never block other consumers. */
  async handle(row: EventRow): Promise<void> {
    if (row.type !== 'sprint.completed' && row.type !== 'version.released') return;
    const payload = row.payload as {
      projectId: string;
      sprintId?: string;
      boardId?: string;
      versionId?: string;
      name: string;
    };
    const [project] = await this.database.db
      .select({ key: projects.key, wikiPages: projects.wikiPages })
      .from(projects)
      .where(eq(projects.id, payload.projectId));
    const settings = { ...OFF, ...((project?.wikiPages as ProjectWikiPages | null) ?? {}) };
    if (!project || !settings.spaceKey) return;
    try {
      const [space] = await this.database.db
        .select()
        .from(spaces)
        .where(eq(spaces.key, settings.spaceKey));
      if (!space) return;
      if (row.type === 'sprint.completed' && payload.sprintId) {
        if (
          settings.retroOnSprintEnd &&
          !(await this.exists(space.id, `retro-${payload.sprintId}`))
        ) {
          await this.pages.create(
            this.actor,
            space.key,
            { title: `Retrospektive ${payload.name}`, template: 'blueprint:retro' },
            undefined,
            { publish: true, labels: [`retro-${payload.sprintId}`] },
          );
        }
        if (
          settings.reportOnSprintEnd &&
          !(await this.exists(space.id, `sprint-report-${payload.sprintId}`))
        ) {
          const report = await this.reports.report(this.actor, payload.sprintId);
          const parentId = await this.pages.blueprintIndex(
            this.actor,
            space,
            'sprint-report',
            'Sprint-Berichte',
          );
          await this.pages.create(
            this.actor,
            space.key,
            { title: `Sprint-Bericht ${payload.name}`, parentId },
            markdownToDoc(this.reportMarkdown(project.key, report)) as RichText,
            { publish: true, labels: ['sprint-report', `sprint-report-${payload.sprintId}`] },
          );
        }
      }
      if (row.type === 'version.released' && payload.versionId && settings.notesOnRelease) {
        const notes = await this.releases.notes(this.actor, project.key, payload.versionId);
        await this.releases.publish(this.actor, project.key, payload.versionId, {
          ...notes,
          spaceKey: space.key,
        });
      }
    } catch (error) {
      this.logger.error({ err: error, event: row.id }, 'Creating project wiki pages failed');
    }
  }

  /** A sprint report frozen at completion, with live issue macros. */
  private reportMarkdown(projectKey: string, report: SprintReport): string {
    const sum = (entries: SprintReport['completed']) =>
      entries.reduce((total, entry) => total + (entry.estimate ?? 0), 0);
    const list = (entries: SprintReport['completed']) =>
      entries.length === 0
        ? ['_Keine._']
        : entries.map((entry) => `- :issue[${entry.issue.key}] ${entry.issue.summary}`);
    const sprint = report.sprint;
    return [
      ':::properties',
      '| Eigenschaft | Wert |',
      '| --- | --- |',
      `| Projekt | ${projectKey} |`,
      `| Sprint | ${sprint.name} |`,
      `| Zeitraum | ${sprint.startDate ?? ''} – ${sprint.endDate ?? ''} |`,
      `| Erledigt | ${report.completed.length} (${sum(report.completed)}) |`,
      `| Nicht erledigt | ${report.notCompleted.length} (${sum(report.notCompleted)}) |`,
      ':::',
      '',
      sprint.goal ? `**Sprintziel:** ${sprint.goal}\n` : '',
      '## Erledigt',
      '',
      ...list(report.completed),
      '',
      '## Nicht erledigt',
      '',
      ...list(report.notCompleted),
      '',
      '## Entfernt',
      '',
      ...list(report.removed),
    ].join('\n');
  }
}
