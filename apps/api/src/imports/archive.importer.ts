import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ImportReport } from '@tasklore/shared';
import { eq, max, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { Principal } from '../core/http/principal.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  customFields,
  issueAttachments,
  issueComments,
  issueComponents,
  issueLinks,
  issues,
  issueVersions,
  issueWorklogs,
  pageAttachments,
  pageComments,
  pages,
  pageVersions,
  projectComponents,
  projects,
  projectVersions,
  spaces,
  users,
} from '../db/schema/index.js';
import type { FileStore } from '../storage/file-store.js';
import type { MetaService } from '../tracking/meta.service.js';
import type { ProjectService } from '../tracking/project.service.js';
import { plainText } from '../tracking/rich-text.js';
import type { SpaceService } from '../wiki/space.service.js';
import {
  ARCHIVE_FORMAT,
  ARCHIVE_VERSION,
  type Archive,
  type ArchiveRow,
} from './archive.service.js';

export interface ArchiveContext {
  database: DatabaseHandle;
  store: FileStore;
  projects: ProjectService;
  spaces: SpaceService;
  meta: MetaService;
  principal: Principal;
  dryRun: boolean;
  progress: (text: string) => Promise<void>;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const lower = (text: unknown) =>
  String(text ?? '')
    .trim()
    .toLowerCase();
const dateOf = (value: unknown) => (typeof value === 'string' && value ? new Date(value) : null);

/**
 * Imports a project or space archive of another Tasklore instance (TL-39, E-120). Everything
 * gets new ids; ids inside documents (mentions, links, images) follow. People are matched by
 * e-mail or created deactivated, issue types, statuses and the like by key or name.
 */
export class ArchiveImporter {
  private readonly report: ImportReport = { counts: {}, mappings: [], skipped: [] };
  private readonly ids = new Map<string, string>();
  private archive!: Archive;
  private renameSpace: [string, string] | null = null;

  constructor(
    private readonly folder: string,
    private readonly context: ArchiveContext,
  ) {}

  private count(what: string, by = 1) {
    if (by) this.report.counts[what] = (this.report.counts[what] ?? 0) + by;
  }

  private note(list: 'mappings' | 'skipped', text: string) {
    if (!this.report[list].includes(text)) this.report[list].push(text);
  }

  /** A new id for a row of the archive, the same one every time. */
  private id(old: string | null | undefined): string | null {
    if (!old) return null;
    let id = this.ids.get(old);
    if (!id) {
      id = uuidv7();
      this.ids.set(old, id);
    }
    return id;
  }

  /** A document with the ids it mentions moved to their new ones. */
  private remap<T>(value: T): T {
    if (value === null || value === undefined) return value;
    let text = JSON.stringify(value).replace(UUID, (old) => this.ids.get(old) ?? old);
    if (this.renameSpace)
      text = text.replaceAll(`/spaces/${this.renameSpace[0]}/`, `/spaces/${this.renameSpace[1]}/`);
    return JSON.parse(text) as T;
  }

  private table(name: string): ArchiveRow[] {
    return this.archive.tables[name] ?? [];
  }

  async run(targetKey: string | undefined): Promise<ImportReport> {
    await this.context.progress('archive.json lesen');
    this.archive = JSON.parse(
      await readFile(join(this.folder, 'archive.json'), 'utf8').catch(() => '{}'),
    ) as Archive;
    if (
      this.archive.format !== ARCHIVE_FORMAT ||
      this.archive.formatVersion !== ARCHIVE_VERSION ||
      !this.archive.root
    ) {
      throw new Error('Das ist kein Tasklore-Archiv (archive.json fehlt oder passt nicht)');
    }
    const sourceKey = String(this.archive.root.key);
    const key = (targetKey || sourceKey).toUpperCase();
    const kind = this.archive.kind === 'project' ? 'Projekt' : 'Bereich';
    this.note('mappings', `${kind} ${sourceKey} → ${key}`);
    const table = this.archive.kind === 'project' ? projects : spaces;
    const [taken] = await this.context.database.db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.key, key));
    if (taken) {
      const message = `Den Schlüssel ${key} gibt es schon; einen anderen Zielschlüssel wählen`;
      if (this.context.dryRun) this.note('skipped', message);
      else throw new Error(message);
    }
    await this.people();
    if (this.archive.kind === 'project') await this.project(key);
    else await this.space(key, sourceKey);
    return this.report;
  }

  /** People by e-mail; unknown ones become deactivated accounts. */
  private async people() {
    const db = this.context.database.db;
    const referenced = new Set<string>();
    const text = JSON.stringify(this.archive.tables);
    for (const person of this.archive.lookups.users) {
      if (text.includes(person.id as string)) referenced.add(person.id as string);
    }
    for (const person of this.archive.lookups.users) {
      if (!referenced.has(person.id as string)) continue;
      const email = lower(person.email);
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email));
      if (existing) {
        this.ids.set(person.id as string, existing.id);
        this.count('Personen zugeordnet');
      } else if (this.context.dryRun) {
        this.count('Personen anzulegen (deaktiviert)');
      } else {
        const id = uuidv7();
        await db.insert(users).values({
          id,
          email,
          displayName: String(person.display_name ?? email),
          status: 'deactivated',
        });
        this.ids.set(person.id as string, id);
        this.count('Personen angelegt (deaktiviert)');
      }
    }
  }

  private user(old: unknown): string | null {
    return typeof old === 'string' ? (this.ids.get(old) ?? null) : null;
  }

  /** Files of the archive into the file store; returns the stored size. */
  private async file(oldId: string, storageKey: string, contentType: string): Promise<boolean> {
    // The id comes from the uploaded archive: only a UUID may become part of a path (TL-44).
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(oldId)) {
      this.note('skipped', 'Anhänge mit ungültiger ID ausgelassen');
      return false;
    }
    const path = join(this.folder, 'files', oldId);
    try {
      await this.context.store.put(storageKey, path, contentType);
      return true;
    } catch {
      this.note('skipped', 'Anhänge ohne Datei im Archiv ausgelassen');
      return false;
    }
  }

  private async project(key: string) {
    const { dryRun } = this.context;
    const db = this.context.database.db;
    const meta = await this.context.meta.load();
    const { lookups } = this.archive;
    const byId = (list: ArchiveRow[]) => new Map(list.map((row) => [row.id as string, row]));
    const sourceTypes = byId(lookups.issueTypes);
    const sourceStatuses = byId(lookups.statuses);
    const sourcePriorities = byId(lookups.priorities);
    const sourceResolutions = byId(lookups.resolutions);
    const sourceLinkTypes = byId(lookups.linkTypes);
    const sourceFields = byId(lookups.customFields);
    const match = <T extends { key?: string; name: string }>(
      list: T[],
      source: ArchiveRow | undefined,
    ) =>
      source
        ? (list.find((entry) => entry.key && lower(entry.key) === lower(source.key)) ??
          list.find((entry) => lower(entry.name) === lower(source.name)))
        : undefined;

    const issueRows = this.table('issues');
    this.count('Vorgänge', issueRows.length);
    this.count('Kommentare', this.table('issue_comments').length);
    this.count('Arbeitsprotokolle', this.table('issue_worklogs').length);
    this.count('Anhänge', this.table('issue_attachments').length);
    this.count('Verknüpfungen', this.table('issue_links').length);
    this.note('skipped', 'Verlauf, Sprints, Boards und Beobachter werden nicht übernommen');
    for (const row of issueRows) {
      const source = sourceTypes.get(row.issue_type_id);
      const type = match(meta.issueTypes, source);
      if (!type) this.note('mappings', `Typ ${source?.name ?? '?'} → Aufgabe`);
      const priority = match(meta.priorities, sourcePriorities.get(row.priority_id));
      if (!priority)
        this.note(
          'mappings',
          `Priorität ${sourcePriorities.get(row.priority_id)?.name ?? '?'} → mittlere`,
        );
    }
    if (dryRun) return;

    const root = this.archive.root;
    const created = await this.context.projects.create(this.context.principal, {
      key,
      name: String(root.name).slice(0, 80),
      description: String(root.description ?? '').slice(0, 2000),
      template: root.template,
    } as never);
    this.ids.set(root.id as string, created.id);
    const [project] = await db.select().from(projects).where(eq(projects.id, created.id));
    if (!project) throw new Error('Projekt nicht angelegt');
    for (const row of [...this.table('issues'), ...this.table('issue_attachments')])
      this.id(row.id);
    for (const row of [...this.table('project_components'), ...this.table('project_versions')])
      this.id(row.id);

    for (const row of this.table('project_components')) {
      await db.insert(projectComponents).values({
        id: this.id(row.id) as string,
        projectId: project.id,
        name: row.name,
        description: row.description ?? '',
        leadId: this.user(row.lead_id),
        defaultAssigneeId: this.user(row.default_assignee_id),
      } as never);
    }
    for (const row of this.table('project_versions')) {
      await db.insert(projectVersions).values({
        id: this.id(row.id) as string,
        projectId: project.id,
        name: row.name,
        description: row.description ?? '',
        startDate: row.start_date,
        releaseDate: row.release_date,
        released: !!row.released,
        archived: !!row.archived,
      } as never);
    }

    const workflows = new Map<
      string,
      { versionId: string; statusIds: string[]; initial: string }
    >();
    const workflowFor = async (typeId: string) => {
      let entry = workflows.get(typeId);
      if (!entry) {
        const versionId = await this.context.projects.workflowVersionFor(project, typeId);
        const workflow = await this.context.projects.workflow(versionId);
        entry = { versionId, statusIds: workflow.statusIds, initial: workflow.initialStatusId };
        workflows.set(typeId, entry);
      }
      return entry;
    };
    const fallbackType =
      meta.issueTypes.find((entry) => entry.key === 'task') ?? (meta.issueTypes[0] as never);
    const targetFields = await db
      .select({ id: customFields.id, name: customFields.name })
      .from(customFields);
    let done = 0;
    for (const row of issueRows) {
      const type = match(meta.issueTypes, sourceTypes.get(row.issue_type_id)) ?? fallbackType;
      const workflow = await workflowFor(type.id);
      const statuses = meta.statuses.filter((status) => workflow.statusIds.includes(status.id));
      const sourceStatus = sourceStatuses.get(row.status_id);
      const status =
        match(statuses, sourceStatus) ??
        statuses.find((entry) => entry.category === sourceStatus?.category) ??
        statuses.find((entry) => entry.id === workflow.initial);
      if (sourceStatus && status && lower(status.name) !== lower(sourceStatus.name))
        this.note('mappings', `Status ${sourceStatus.name} → ${status.name}`);
      const priority =
        match(meta.priorities, sourcePriorities.get(row.priority_id)) ??
        meta.priorities[Math.floor(meta.priorities.length / 2)];
      const resolution = row.resolution_id
        ? (match(meta.resolutions, sourceResolutions.get(row.resolution_id)) ??
          meta.resolutions.find((entry) => entry.key === 'done'))
        : undefined;
      const fields: Record<string, unknown> = {};
      for (const [fieldId, value] of Object.entries(row.custom_fields ?? {})) {
        const name = sourceFields.get(fieldId)?.name;
        const target = targetFields.find((field) => lower(field.name) === lower(name));
        if (target) fields[target.id] = this.remap(value);
        else this.note('skipped', `Feld ${name ?? fieldId}: gibt es hier nicht`);
      }
      const description = this.remap(row.description);
      await db.insert(issues).values({
        id: this.id(row.id) as string,
        projectId: project.id,
        number: row.number,
        key: `${project.key}-${row.number}`,
        issueTypeId: type.id,
        statusId: status?.id ?? workflow.initial,
        workflowVersionId: workflow.versionId,
        resolutionId: resolution?.id ?? null,
        priorityId: priority?.id as string,
        summary: row.summary,
        description,
        descriptionText: description ? plainText(description) : '',
        assigneeId: this.user(row.assignee_id),
        reporterId: this.user(row.reporter_id),
        labels: row.labels ?? [],
        storyPoints: row.story_points,
        startDate: row.start_date,
        dueDate: row.due_date,
        originalEstimateSeconds: row.original_estimate_seconds,
        remainingEstimateSeconds: row.remaining_estimate_seconds,
        timeSpentSeconds: row.time_spent_seconds ?? 0,
        customFields: fields,
        rank: row.rank,
        createdAt: dateOf(row.created_at) ?? new Date(),
        updatedAt: dateOf(row.updated_at) ?? new Date(),
        resolvedAt: dateOf(row.resolved_at),
      } as never);
      done += 1;
      if (done % 100 === 0)
        await this.context.progress(`${done} von ${issueRows.length} Vorgängen`);
    }
    for (const row of issueRows) {
      const parentId = row.parent_id ? this.ids.get(row.parent_id) : undefined;
      if (parentId)
        await db
          .update(issues)
          .set({ parentId })
          .where(eq(issues.id, this.id(row.id) as string));
    }
    const [highest] = await db
      .select({ number: max(issues.number) })
      .from(issues)
      .where(eq(issues.projectId, project.id));
    await db
      .update(projects)
      .set({ issueCounter: sql`greatest(${projects.issueCounter}, ${highest?.number ?? 0})` })
      .where(eq(projects.id, project.id));

    for (const row of this.table('issue_components')) {
      const componentId = this.ids.get(row.component_id);
      if (componentId)
        await db
          .insert(issueComponents)
          .values({ issueId: this.id(row.issue_id) as string, componentId })
          .onConflictDoNothing();
    }
    for (const row of this.table('issue_versions')) {
      const versionId = this.ids.get(row.version_id);
      if (versionId)
        await db
          .insert(issueVersions)
          .values({ issueId: this.id(row.issue_id) as string, versionId, kind: row.kind })
          .onConflictDoNothing();
    }
    for (const row of this.table('issue_comments')) {
      const body = this.remap(row.body);
      await db.insert(issueComments).values({
        id: uuidv7(),
        issueId: this.id(row.issue_id) as string,
        authorId: this.user(row.author_id),
        body,
        bodyText: plainText(body),
        createdAt: dateOf(row.created_at) ?? new Date(),
        updatedAt: dateOf(row.updated_at) ?? new Date(),
      } as never);
    }
    for (const row of this.table('issue_worklogs')) {
      await db.insert(issueWorklogs).values({
        id: uuidv7(),
        issueId: this.id(row.issue_id) as string,
        authorId: this.user(row.author_id),
        startedAt: dateOf(row.started_at) ?? new Date(),
        timeSpentSeconds: row.time_spent_seconds,
        comment: row.comment ?? '',
        createdAt: dateOf(row.created_at) ?? new Date(),
      } as never);
    }
    for (const row of this.table('issue_links')) {
      const type = match(meta.linkTypes, sourceLinkTypes.get(row.type_id));
      if (!type) {
        this.note(
          'skipped',
          `Verknüpfungsart ${sourceLinkTypes.get(row.type_id)?.name}: gibt es hier nicht`,
        );
        continue;
      }
      await db.insert(issueLinks).values({
        id: uuidv7(),
        typeId: type.id,
        sourceId: this.id(row.source_id) as string,
        targetId: this.id(row.target_id) as string,
        createdById: this.user(row.created_by_id),
        createdAt: dateOf(row.created_at) ?? new Date(),
      } as never);
    }
    for (const row of this.table('issue_attachments')) {
      const id = this.id(row.id) as string;
      const storageKey = `attachments/${id}`;
      if (!(await this.file(row.id, storageKey, row.content_type))) continue;
      await db.insert(issueAttachments).values({
        id,
        issueId: this.id(row.issue_id) as string,
        authorId: this.user(row.author_id),
        fileName: row.file_name,
        contentType: row.content_type,
        size: row.size,
        sha256: row.sha256,
        image: row.image,
        storageKey,
        createdAt: dateOf(row.created_at) ?? new Date(),
      } as never);
    }
  }

  private async space(key: string, sourceKey: string) {
    const { dryRun } = this.context;
    const db = this.context.database.db;
    const pageRows = this.table('pages');
    this.count('Seiten', pageRows.length);
    this.count('Versionen', this.table('page_versions').length);
    this.count('Kommentare', this.table('page_comments').length);
    this.count('Anhänge', this.table('page_attachments').length);
    this.note('skipped', 'Beobachter, Einschränkungen und Entwürfe werden nicht übernommen');
    if (dryRun) return;

    const root = this.archive.root;
    const created = await this.context.spaces.create(this.context.principal, {
      key,
      name: String(root.name).slice(0, 80),
      description: String(root.description ?? '').slice(0, 2000),
    } as never);
    this.ids.set(root.id as string, created.id);
    if (key !== sourceKey) this.renameSpace = [sourceKey, key];
    for (const row of [
      ...pageRows,
      ...this.table('page_attachments'),
      ...this.table('page_comments'),
    ])
      this.id(row.id);

    // Parents before children.
    const ordered: ArchiveRow[] = [];
    const placed = new Set<string>();
    const byId = new Map(pageRows.map((row) => [row.id as string, row]));
    const place = (row: ArchiveRow) => {
      if (placed.has(row.id)) return;
      placed.add(row.id);
      const parent = row.parent_id ? byId.get(row.parent_id) : undefined;
      if (parent) place(parent);
      ordered.push(row);
    };
    for (const row of pageRows) place(row);
    for (const row of ordered) {
      await db.insert(pages).values({
        id: this.id(row.id) as string,
        spaceId: created.id,
        parentId: row.parent_id && byId.has(row.parent_id) ? this.id(row.parent_id) : null,
        rank: row.rank,
        title: row.title,
        version: row.version ?? 0,
        publishedAt: dateOf(row.published_at),
        createdById: this.user(row.created_by_id),
        createdAt: dateOf(row.created_at) ?? new Date(),
        updatedAt: dateOf(row.updated_at) ?? new Date(),
        labels: row.labels ?? [],
        kind: row.kind ?? 'page',
        status: row.status ?? 'none',
        ownerId: this.user(row.owner_id),
        statusChangedAt: dateOf(row.status_changed_at),
      } as never);
    }
    let done = 0;
    for (const row of this.table('page_versions')) {
      const content = this.remap(row.content);
      await db.insert(pageVersions).values({
        id: uuidv7(),
        pageId: this.id(row.page_id) as string,
        number: row.number,
        title: row.title,
        content,
        text: plainText(content),
        authorId: this.user(row.author_id),
        comment: row.comment ?? '',
        restoredFrom: row.restored_from,
        createdAt: dateOf(row.created_at) ?? new Date(),
      } as never);
      done += 1;
      if (done % 200 === 0) await this.context.progress(`${done} Versionen`);
    }
    const comments = this.table('page_comments');
    const depth = (row: ArchiveRow): number => {
      const parent = comments.find((entry) => entry.id === row.parent_id);
      return parent ? depth(parent) + 1 : 0;
    };
    for (const row of [...comments].sort((a, b) => depth(a) - depth(b))) {
      const body = this.remap(row.body);
      await db.insert(pageComments).values({
        id: this.id(row.id) as string,
        pageId: this.id(row.page_id) as string,
        parentId: row.parent_id ? this.id(row.parent_id) : null,
        authorId: this.user(row.author_id),
        body,
        bodyText: plainText(body),
        anchor: row.anchor,
        detached: !!row.detached,
        resolvedAt: dateOf(row.resolved_at),
        resolvedById: this.user(row.resolved_by_id),
        createdAt: dateOf(row.created_at) ?? new Date(),
        updatedAt: dateOf(row.updated_at) ?? new Date(),
      } as never);
    }
    for (const row of this.table('page_attachments')) {
      const id = this.id(row.id) as string;
      const storageKey = `page-attachments/${id}`;
      if (!(await this.file(row.id, storageKey, row.content_type))) continue;
      await db.insert(pageAttachments).values({
        id,
        pageId: this.id(row.page_id) as string,
        authorId: this.user(row.author_id),
        fileName: row.file_name,
        contentType: row.content_type,
        size: row.size,
        sha256: row.sha256,
        image: row.image,
        storageKey,
        createdAt: dateOf(row.created_at) ?? new Date(),
      } as never);
    }
    const home = root.home_page_id ? this.ids.get(root.home_page_id) : undefined;
    if (home) await db.update(spaces).set({ homePageId: home }).where(eq(spaces.id, created.id));
  }
}
