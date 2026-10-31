import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { markdownToDoc } from '@tasklore/editor';
import type {
  PublishReleaseNotesRequest,
  Release,
  ReleaseNotes,
  ReleaseWarning,
  RichText,
} from '@tasklore/shared';
import { and, eq, getTableColumns, inArray, isNull } from 'drizzle-orm';
import type { Principal } from '../core/http/principal.js';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  issueLinks,
  issueLinkTypes,
  issues,
  issueVersions,
  pages,
  projectVersions,
  spaces,
} from '../db/schema/index.js';
import { IssueService } from '../tracking/issue.service.js';
import { securityVisible } from '../tracking/issue-security.js';
import { MetaService } from '../tracking/meta.service.js';
import { ProjectService } from '../tracking/project.service.js';
import { ProjectAccessService } from '../tracking/project-access.service.js';
import { VersionService } from '../tracking/version.service.js';
import { PageService } from '../wiki/page.service.js';

const { searchVector: _searchVector, ...issueColumns } = getTableColumns(issues);

/**
 * The release view and release notes (T-REL-02, T-REL-04, TL-25, E-106): progress and issues of
 * a version, warnings computable without source hosting, notes published as a wiki page.
 */
@Injectable()
export class ReleaseService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(ProjectService) private readonly projects: ProjectService,
    @Inject(ProjectAccessService) private readonly projectAccess: ProjectAccessService,
    @Inject(VersionService) private readonly versions: VersionService,
    @Inject(IssueService) private readonly issues: IssueService,
    @Inject(MetaService) private readonly meta: MetaService,
    @Inject(PageService) private readonly pages: PageService,
  ) {}

  private async load(principal: Principal, projectKey: string, id: string) {
    const project = await this.projects.findBrowsable(principal, projectKey);
    const version = (await this.versions.list(principal, project.key)).find(
      (entry) => entry.id === id,
    );
    if (!version) throw new NotFoundException('Version not found');
    const rows = await this.database.db
      .select(issueColumns)
      .from(issues)
      .innerJoin(issueVersions, eq(issueVersions.issueId, issues.id))
      .where(
        and(
          eq(issueVersions.versionId, id),
          eq(issueVersions.kind, 'fix'),
          isNull(issues.deletedAt),
          securityVisible(principal.userId),
        ),
      )
      .orderBy(issues.rank);
    return { project, version, summaries: await this.issues.summarize(principal.userId, rows) };
  }

  async get(principal: Principal, projectKey: string, id: string): Promise<Release> {
    const { project, version, summaries } = await this.load(principal, projectKey, id);
    const open = summaries.filter((issue) => issue.status.category !== 'done');
    const warnings: ReleaseWarning[] = [];
    const today = new Date().toISOString().slice(0, 10);
    if (!version.released && version.releaseDate && version.releaseDate < today) {
      for (const issue of open)
        warnings.push({ kind: 'overdue', issueKey: issue.key, blockerKey: null });
    }
    if (open.length > 0) {
      const blockers = await this.database.db
        .select({ blocked: issueLinks.targetId, key: issues.key, statusId: issues.statusId })
        .from(issueLinks)
        .innerJoin(issueLinkTypes, eq(issueLinkTypes.id, issueLinks.typeId))
        .innerJoin(issues, eq(issues.id, issueLinks.sourceId))
        .where(
          and(
            eq(issueLinkTypes.key, 'blocks'),
            inArray(
              issueLinks.targetId,
              open.map((issue) => issue.id),
            ),
            isNull(issues.deletedAt),
          ),
        );
      const meta = await this.meta.load();
      for (const blocker of blockers) {
        if (meta.status.get(blocker.statusId)?.category === 'done') continue;
        const issue = open.find((entry) => entry.id === blocker.blocked);
        if (issue) warnings.push({ kind: 'blocked', issueKey: issue.key, blockerKey: blocker.key });
      }
    }
    for (const issue of open) {
      if (!issue.assignee)
        warnings.push({ kind: 'unassigned', issueKey: issue.key, blockerKey: null });
    }
    const [row] = await this.database.db
      .select({ notesPageId: projectVersions.notesPageId })
      .from(projectVersions)
      .where(eq(projectVersions.id, id));
    let notesPage: Release['notesPage'] = null;
    if (row?.notesPageId) {
      const [page] = await this.database.db
        .select({ id: pages.id, title: pages.title, spaceKey: spaces.key })
        .from(pages)
        .innerJoin(spaces, eq(spaces.id, pages.spaceId))
        .where(and(eq(pages.id, row.notesPageId), isNull(pages.deletedAt)));
      // Shown only to people who may see the page.
      if (page && (await this.pages.visible(principal.userId, [page.id])).has(page.id)) {
        notesPage = page;
      }
    }
    const points = (list: typeof summaries) =>
      list.reduce((sum, issue) => sum + (issue.storyPoints ?? 0), 0);
    const done = summaries.filter((issue) => issue.status.category === 'done');
    const permissions = await this.projectAccess.permissions(principal.userId, project.id);
    return {
      version,
      progress: {
        issues: summaries.length,
        done: done.length,
        points: points(summaries),
        donePoints: points(done),
      },
      todo: summaries.filter((issue) => issue.status.category === 'todo'),
      inProgress: summaries.filter((issue) => issue.status.category === 'in_progress'),
      done,
      warnings,
      notesPage,
      canEdit: permissions.has('administer'),
    };
  }

  /** Markdown of the done issues, grouped by issue type in the order of the types. */
  async notes(principal: Principal, projectKey: string, id: string): Promise<ReleaseNotes> {
    const { project, version, summaries } = await this.load(principal, projectKey, id);
    const meta = await this.meta.load();
    const done = summaries.filter((issue) => issue.status.category === 'done');
    const lines = [
      version.releaseDate
        ? `Version **${version.name}** von ${project.name}, veröffentlicht am ${version.releaseDate}.`
        : `Version **${version.name}** von ${project.name}.`,
    ];
    if (version.description) lines.push('', version.description);
    for (const type of meta.issueTypes) {
      const own = done.filter((issue) => issue.issueType.id === type.id);
      if (own.length === 0) continue;
      lines.push('', `## ${type.name}`, '');
      for (const issue of own) lines.push(`- :issue[${issue.key}] ${issue.summary}`);
    }
    if (done.length === 0) lines.push('', '_Noch keine erledigten Vorgänge._');
    return { title: `Release Notes ${project.name} ${version.name}`, markdown: lines.join('\n') };
  }

  async publish(
    principal: Principal,
    projectKey: string,
    id: string,
    request: PublishReleaseNotesRequest,
  ): Promise<Release> {
    const project = await this.projects.findBrowsable(principal, projectKey);
    await this.projectAccess.require(principal, project.id, 'administer');
    const [row] = await this.database.db
      .select({ notesPageId: projectVersions.notesPageId })
      .from(projectVersions)
      .where(and(eq(projectVersions.id, id), eq(projectVersions.projectId, project.id)));
    if (!row) throw new NotFoundException('Version not found');
    const content = markdownToDoc(request.markdown) as RichText;
    let pageId = row.notesPageId;
    const existing = pageId
      ? await this.pages.authorize(principal, pageId, 'edit').catch(() => null)
      : null;
    if (!existing) {
      if (!request.spaceKey) throw new NotFoundException('Choose a space for the release notes');
      const page = await this.pages.create(principal, request.spaceKey, {
        title: request.title,
        parentId: request.parentId ?? null,
      });
      pageId = page.id;
      await this.database.db
        .update(projectVersions)
        .set({ notesPageId: pageId })
        .where(eq(projectVersions.id, id));
    }
    await this.pages.publish(principal, pageId as string, {
      title: request.title,
      content,
      comment: 'Release Notes',
    });
    return this.get(principal, projectKey, id);
  }
}
