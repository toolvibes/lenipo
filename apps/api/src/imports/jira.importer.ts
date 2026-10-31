import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { markdownToDoc } from '@tasklore/editor';
import type { ImportReport } from '@tasklore/shared';
import { and, eq, max, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import type { BoardService } from '../boards/board.service.js';
import type { Principal } from '../core/http/principal.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  boards,
  importMappings,
  issueAttachments,
  issueChangeGroups,
  issueChangeItems,
  issueComments,
  issueComponents,
  issueLinks,
  issues,
  issueVersions,
  issueWorklogs,
  projectComponents,
  projects,
  projectVersions,
  sprintIssues,
  sprints,
  users,
} from '../db/schema/index.js';
import type { FileStore } from '../storage/file-store.js';
import { contentTypeOf } from '../storage/upload.js';
import type { MetaService } from '../tracking/meta.service.js';
import type { ProjectService } from '../tracking/project.service.js';
import { rankBetween } from '../tracking/rank.js';
import { plainText } from '../tracking/rich-text.js';
import { jiraToMarkdown } from './jira-markup.js';

// biome-ignore lint/suspicious/noExplicitAny: Jira answers are untyped JSON
type Json = any;

export interface ImportContext {
  database: DatabaseHandle;
  store: FileStore;
  projects: ProjectService;
  boards: BoardService;
  meta: MetaService;
  principal: Principal;
  dryRun: boolean;
  log: (line: string) => Promise<void>;
  progress: (text: string) => Promise<void>;
}

/** The REST API of a Jira Server/DC (E-118); a token with ":" is user:password. */
export class JiraSource {
  readonly origin: string;
  private readonly auth: string;

  constructor(
    readonly url: string,
    token: string,
  ) {
    this.url = url.replace(/\/+$/, '');
    this.origin = `jira:${this.url}`;
    this.auth = token.includes(':')
      ? `Basic ${Buffer.from(token).toString('base64')}`
      : `Bearer ${token}`;
  }

  async get(path: string): Promise<Json> {
    const response = await fetch(`${this.url}${path}`, {
      headers: { authorization: this.auth, accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Jira ${path}: ${response.status} ${response.statusText}`);
    return response.json();
  }

  async download(url: string): Promise<Buffer> {
    const response = await fetch(url, { headers: { authorization: this.auth } });
    if (!response.ok) throw new Error(`Jira ${url}: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  /** All values of a paged list, e.g. sprints of a board. */
  async all(path: string, key = 'values', size = 50): Promise<Json[]> {
    const found: Json[] = [];
    for (let startAt = 0; ; startAt += size) {
      const page = await this.get(
        `${path}${path.includes('?') ? '&' : '?'}startAt=${startAt}&maxResults=${size}`,
      );
      const values = (page[key] ?? []) as Json[];
      found.push(...values);
      if (
        values.length < size ||
        page.isLast === true ||
        found.length >= (page.total ?? Number.POSITIVE_INFINITY)
      ) {
        return found;
      }
    }
  }
}

const CATEGORY: Record<string, string> = {
  new: 'todo',
  indeterminate: 'in_progress',
  done: 'done',
};
const lower = (text: unknown) =>
  String(text ?? '')
    .trim()
    .toLowerCase();
const dateOf = (value: unknown) => (typeof value === 'string' && value ? new Date(value) : null);

/**
 * Imports Jira projects with their issues, comments, worklogs, attachments, history, links,
 * versions, components, boards and sprints (P-ADM-10, E-118). In a dry run it reads
 * everything and reports, but writes nothing. Objects already imported are skipped.
 */
export class JiraImporter {
  private readonly report: ImportReport = { counts: {}, mappings: [], skipped: [] };
  private readonly userIds = new Map<string, string | null>();
  private readonly noted = new Set<string>();

  constructor(
    private readonly source: JiraSource,
    private readonly context: ImportContext,
  ) {}

  private count(what: string, by = 1) {
    this.report.counts[what] = (this.report.counts[what] ?? 0) + by;
  }

  private note(list: 'mappings' | 'skipped', text: string) {
    if (this.noted.has(text)) return;
    this.noted.add(text);
    this.report[list].push(text);
  }

  private async mapped(kind: string, sourceId: string): Promise<string | null> {
    const [row] = await this.context.database.db
      .select({ targetId: importMappings.targetId })
      .from(importMappings)
      .where(
        and(
          eq(importMappings.origin, this.source.origin),
          eq(importMappings.kind, kind),
          eq(importMappings.sourceId, sourceId),
        ),
      );
    return row?.targetId ?? null;
  }

  private async remember(kind: string, sourceId: string, targetId: string) {
    await this.context.database.db
      .insert(importMappings)
      .values({ origin: this.source.origin, kind, sourceId, targetId })
      .onConflictDoNothing();
  }

  /** A Jira person as a Tasklore person: by e-mail, else a deactivated account (E-118). */
  private async user(person: Json): Promise<string | null> {
    if (!person) return null;
    const sourceId = String(person.key ?? person.name ?? person.accountId ?? '');
    if (!sourceId) return null;
    if (this.userIds.has(sourceId)) return this.userIds.get(sourceId) ?? null;
    const known = await this.mapped('user', sourceId);
    const email =
      lower(person.emailAddress) || `${lower(sourceId).replace(/[^a-z0-9._-]/g, '-')}@jira.invalid`;
    let id = known;
    if (!id) {
      const [existing] = await this.context.database.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email));
      if (existing) {
        id = existing.id;
        this.count('Personen zugeordnet');
      } else if (!this.context.dryRun) {
        id = uuidv7();
        await this.context.database.db.insert(users).values({
          id,
          email,
          displayName: String(person.displayName ?? sourceId),
          status: 'deactivated',
        });
        this.count('Personen angelegt (deaktiviert)');
      } else {
        this.count('Personen anzulegen (deaktiviert)');
      }
      if (id && !this.context.dryRun) await this.remember('user', sourceId, id);
    }
    this.userIds.set(sourceId, id);
    return id;
  }

  async run(projectKeys: string[]): Promise<ImportReport> {
    const fields = (await this.source.get('/rest/api/2/field')) as Json[];
    const fieldId = (...names: string[]) =>
      fields.find((field) => names.map(lower).includes(lower(field.name)))?.id as
        | string
        | undefined;
    const storyPoints = fieldId('Story Points', 'Story point estimate');
    const epicLink = fieldId('Epic Link');
    const customCount = fields.filter((field) => field.custom).length;
    if (customCount) {
      this.note(
        'skipped',
        `${customCount} eigene Jira-Felder: außer Story Points und Epic-Verknüpfung nicht übernommen`,
      );
    }
    for (const key of projectKeys) {
      await this.project(key, { storyPoints, epicLink });
    }
    return this.report;
  }

  private async project(key: string, fields: { storyPoints?: string; epicLink?: string }) {
    const { database, dryRun } = this.context;
    const db = database.db;
    const jira = await this.source.get(`/rest/api/2/project/${encodeURIComponent(key)}`);
    await this.context.progress(`${key}: Projekt`);
    let projectId = await this.mapped('project', key);
    const [existing] = await db.select().from(projects).where(eq(projects.key, key));
    if (!projectId && existing) {
      throw new Error(
        `Den Projektschlüssel ${key} gibt es in Tasklore schon; erst umbenennen oder einen anderen Schlüssel wählen`,
      );
    }
    if (!projectId) {
      if (dryRun) {
        this.count('Projekte anzulegen');
      } else {
        const created = await this.context.projects.create(this.context.principal, {
          key,
          name: String(jira.name ?? key).slice(0, 80),
          template: 'scrum',
        } as never);
        projectId = created.id;
        await this.remember('project', key, projectId);
        this.count('Projekte angelegt');
      }
    }
    const project = projectId
      ? (await db.select().from(projects).where(eq(projects.id, projectId)))[0]
      : undefined;
    const meta = await this.context.meta.load();

    // Versions and components.
    const versionIds = new Map<string, string>();
    for (const version of (jira.versions ?? []) as Json[]) {
      const sourceId = `version:${version.id}`;
      let id = await this.mapped('version', sourceId);
      if (!id && !dryRun && project) {
        id = uuidv7();
        await db.insert(projectVersions).values({
          id,
          projectId: project.id,
          name: String(version.name).slice(0, 100),
          description: String(version.description ?? ''),
          startDate: version.startDate ?? null,
          releaseDate: version.releaseDate ?? null,
          released: !!version.released,
          archived: !!version.archived,
        });
        await this.remember('version', sourceId, id);
      }
      if (!id) this.count('Versionen');
      else versionIds.set(String(version.id), id);
    }
    if (!dryRun) this.count('Versionen', versionIds.size);
    const componentIds = new Map<string, string>();
    for (const component of (jira.components ?? []) as Json[]) {
      const sourceId = `component:${component.id}`;
      let id = await this.mapped('component', sourceId);
      if (!id && !dryRun && project) {
        id = uuidv7();
        await db.insert(projectComponents).values({
          id,
          projectId: project.id,
          name: String(component.name).slice(0, 100),
          description: String(component.description ?? ''),
        } as never);
        await this.remember('component', sourceId, id);
      }
      if (id) componentIds.set(String(component.id), id);
      this.count('Komponenten');
    }

    // Issues, in key order, so numbers and ranks follow Jira.
    const issueIds = new Map<string, string>();
    const parents: Array<{ child: string; parentKey: string }> = [];
    const links: Json[] = [];
    let rank: string | null =
      (await db.select({ rank: max(issues.rank) }).from(issues))[0]?.rank ?? null;
    let startAt = 0;
    for (;;) {
      const page = await this.source.get(
        `/rest/api/2/search?jql=${encodeURIComponent(`project = "${key}" ORDER BY key ASC`)}&startAt=${startAt}&maxResults=50&expand=changelog&fields=*all`,
      );
      const found = (page.issues ?? []) as Json[];
      for (const issue of found) {
        rank = rankBetween(rank, null);
        await this.issue(issue, {
          project,
          meta,
          rank,
          versionIds,
          componentIds,
          issueIds,
          parents,
          links,
          fields,
        });
      }
      startAt += found.length;
      await this.context.progress(`${key}: ${startAt} von ${page.total ?? '?'} Vorgängen`);
      if (found.length === 0 || startAt >= (page.total ?? 0)) break;
    }

    if (dryRun || !project) {
      await this.boards(key, null, issueIds);
      return;
    }
    for (const { child, parentKey } of parents) {
      const parentId = issueIds.get(parentKey);
      if (parentId) await db.update(issues).set({ parentId }).where(eq(issues.id, child));
    }
    for (const link of links) await this.link(link, issueIds, meta);
    const [highest] = await db
      .select({ number: max(issues.number) })
      .from(issues)
      .where(eq(issues.projectId, project.id));
    await db
      .update(projects)
      .set({ issueCounter: sql`greatest(${projects.issueCounter}, ${highest?.number ?? 0})` })
      .where(eq(projects.id, project.id));
    await this.boards(key, project.key, issueIds);
  }

  private async issue(
    jira: Json,
    scope: {
      project: typeof projects.$inferSelect | undefined;
      meta: Awaited<ReturnType<MetaService['load']>>;
      rank: string;
      versionIds: Map<string, string>;
      componentIds: Map<string, string>;
      issueIds: Map<string, string>;
      parents: Array<{ child: string; parentKey: string }>;
      links: Json[];
      fields: { storyPoints?: string; epicLink?: string };
    },
  ) {
    const { database, dryRun } = this.context;
    const db = database.db;
    const f = jira.fields ?? {};
    const key = String(jira.key);
    const { meta, project } = scope;

    const typeName = lower(f.issuetype?.name);
    const type =
      meta.issueTypes.find(
        (entry) => lower(entry.name) === typeName || lower(entry.key) === typeName,
      ) ??
      meta.issueTypes.find((entry) =>
        f.issuetype?.subtask ? entry.hierarchyLevel < 0 : entry.key === 'task',
      ) ??
      meta.issueTypes.find((entry) => entry.hierarchyLevel === 0) ??
      meta.issueTypes[0];
    if (!type) throw new Error('Keine Vorgangstypen in Tasklore');
    if (type && lower(type.name) !== typeName)
      this.note('mappings', `Typ ${f.issuetype?.name} → ${type.name}`);
    const priority =
      meta.priorities.find((entry) => lower(entry.name) === lower(f.priority?.name)) ??
      meta.priorities[Math.floor(meta.priorities.length / 2)];
    if (priority && f.priority && lower(priority.name) !== lower(f.priority.name)) {
      this.note('mappings', `Priorität ${f.priority.name} → ${priority.name}`);
    }
    for (const person of [f.assignee, f.reporter]) await this.user(person);

    let issueId = await this.mapped('issue', String(jira.id));
    if (!issueId && !dryRun && project) {
      const workflowVersionId = await this.context.projects.workflowVersionFor(project, type.id);
      const workflow = await this.context.projects.workflow(workflowVersionId);
      const statuses = workflow.statusIds.flatMap((id) =>
        meta.statuses.filter((status) => status.id === id),
      );
      const status =
        statuses.find((entry) => lower(entry.name) === lower(f.status?.name)) ??
        statuses.find(
          (entry) => entry.category === CATEGORY[f.status?.statusCategory?.key ?? 'new'],
        ) ??
        statuses.find((entry) => entry.id === workflow.initialStatusId);
      if (status && lower(status.name) !== lower(f.status?.name)) {
        this.note('mappings', `Status ${f.status?.name} → ${status.name}`);
      }
      const resolution = f.resolution
        ? (meta.resolutions.find((entry) => lower(entry.name) === lower(f.resolution.name)) ??
          meta.resolutions.find((entry) => entry.key === 'done') ??
          meta.resolutions[0])
        : undefined;
      const description = markdownToDoc(jiraToMarkdown(f.description));
      issueId = uuidv7();
      const number = Number(key.split('-').pop());
      await db.insert(issues).values({
        id: issueId,
        projectId: project.id,
        number,
        key: `${project.key}-${number}`,
        issueTypeId: type.id,
        statusId: status?.id ?? workflow.initialStatusId,
        workflowVersionId,
        resolutionId: resolution?.id ?? null,
        priorityId: priority?.id ?? (meta.priorities[0]?.id as string),
        summary: String(f.summary ?? key).slice(0, 255),
        description: f.description ? description : null,
        descriptionText: f.description ? plainText(description) : '',
        assigneeId: await this.user(f.assignee),
        reporterId: await this.user(f.reporter),
        labels: Array.isArray(f.labels) ? f.labels.map(String) : [],
        storyPoints:
          scope.fields.storyPoints && typeof f[scope.fields.storyPoints] === 'number'
            ? f[scope.fields.storyPoints]
            : null,
        dueDate: typeof f.duedate === 'string' ? f.duedate.slice(0, 10) : null,
        originalEstimateSeconds:
          typeof f.timeoriginalestimate === 'number' ? f.timeoriginalestimate : null,
        remainingEstimateSeconds: typeof f.timeestimate === 'number' ? f.timeestimate : null,
        rank: scope.rank,
        createdAt: dateOf(f.created) ?? new Date(),
        updatedAt: dateOf(f.updated) ?? new Date(),
        resolvedAt: dateOf(f.resolutiondate),
      });
      await this.remember('issue', String(jira.id), issueId);
      for (const version of (f.fixVersions ?? []) as Json[]) {
        const versionId = scope.versionIds.get(String(version.id));
        if (versionId)
          await db
            .insert(issueVersions)
            .values({ issueId, versionId, kind: 'fix' })
            .onConflictDoNothing();
      }
      for (const version of (f.versions ?? []) as Json[]) {
        const versionId = scope.versionIds.get(String(version.id));
        if (versionId)
          await db
            .insert(issueVersions)
            .values({ issueId, versionId, kind: 'affects' })
            .onConflictDoNothing();
      }
      for (const component of (f.components ?? []) as Json[]) {
        const componentId = scope.componentIds.get(String(component.id));
        if (componentId)
          await db.insert(issueComponents).values({ issueId, componentId }).onConflictDoNothing();
      }
      await this.history(issueId, jira.changelog?.histories ?? []);
      this.count('Vorgänge angelegt');
    } else if (issueId) {
      this.count('Vorgänge schon da');
    } else {
      this.count('Vorgänge');
    }
    if (issueId) scope.issueIds.set(key, issueId);
    const parentKey = f.parent?.key ?? (scope.fields.epicLink ? f[scope.fields.epicLink] : null);
    if (issueId && typeof parentKey === 'string') scope.parents.push({ child: issueId, parentKey });
    for (const link of (f.issuelinks ?? []) as Json[]) {
      if (link.outwardIssue) scope.links.push({ ...link, from: key });
    }
    await this.comments(jira, issueId);
    await this.worklogs(jira, issueId);
    await this.attachments(jira, issueId);
  }

  private async history(issueId: string, histories: Json[]) {
    const db = this.context.database.db;
    for (const history of histories) {
      const items = ((history.items ?? []) as Json[]).filter((item) => item.field);
      if (items.length === 0) continue;
      const [group] = await db
        .insert(issueChangeGroups)
        .values({
          issueId,
          authorId: await this.user(history.author),
          via: 'import',
          createdAt: dateOf(history.created) ?? new Date(),
        })
        .returning({ id: issueChangeGroups.id });
      if (!group) continue;
      await db.insert(issueChangeItems).values(
        items.map((item) => ({
          groupId: group.id,
          field: lower(item.field) === 'resolution' ? 'resolution' : String(item.field),
          fromValue: item.from == null ? null : String(item.from),
          fromDisplay: item.fromString == null ? null : String(item.fromString),
          toValue: item.to == null ? null : String(item.to),
          toDisplay: item.toString == null ? null : String(item.toString),
        })),
      );
      this.count('Änderungen aus der Historie');
    }
  }

  private async comments(jira: Json, issueId: string | null) {
    const field = jira.fields?.comment;
    let list = (field?.comments ?? []) as Json[];
    if (field && field.total > list.length) {
      list =
        (await this.source.get(`/rest/api/2/issue/${jira.key}/comment?maxResults=1000`)).comments ??
        list;
    }
    for (const comment of list) {
      const sourceId = String(comment.id);
      if (!issueId || this.context.dryRun) {
        this.count('Kommentare');
        continue;
      }
      if (await this.mapped('comment', sourceId)) continue;
      const body = markdownToDoc(jiraToMarkdown(comment.body));
      const id = uuidv7();
      await this.context.database.db.insert(issueComments).values({
        id,
        issueId,
        authorId: await this.user(comment.author),
        body,
        bodyText: plainText(body),
        createdAt: dateOf(comment.created) ?? new Date(),
        updatedAt: dateOf(comment.updated) ?? dateOf(comment.created) ?? new Date(),
      });
      await this.remember('comment', sourceId, id);
      this.count('Kommentare');
    }
  }

  private async worklogs(jira: Json, issueId: string | null) {
    const field = jira.fields?.worklog;
    let list = (field?.worklogs ?? []) as Json[];
    if (field && field.total > list.length) {
      list = (await this.source.get(`/rest/api/2/issue/${jira.key}/worklog`)).worklogs ?? list;
    }
    let added = 0;
    for (const worklog of list) {
      if (!issueId || this.context.dryRun) {
        this.count('Arbeitszeiten');
        continue;
      }
      if (await this.mapped('worklog', String(worklog.id))) continue;
      const id = uuidv7();
      const seconds = Number(worklog.timeSpentSeconds ?? 0);
      await this.context.database.db.insert(issueWorklogs).values({
        id,
        issueId,
        authorId: await this.user(worklog.author),
        startedAt: dateOf(worklog.started) ?? new Date(),
        timeSpentSeconds: seconds,
        comment: jiraToMarkdown(worklog.comment).slice(0, 2_000),
      });
      await this.remember('worklog', String(worklog.id), id);
      added += seconds;
      this.count('Arbeitszeiten');
    }
    if (added && issueId) {
      await this.context.database.db
        .update(issues)
        .set({ timeSpentSeconds: sql`${issues.timeSpentSeconds} + ${added}` })
        .where(eq(issues.id, issueId));
    }
  }

  private async attachments(jira: Json, issueId: string | null) {
    for (const attachment of (jira.fields?.attachment ?? []) as Json[]) {
      if (!issueId || this.context.dryRun) {
        this.count('Anhänge');
        continue;
      }
      if (await this.mapped('attachment', String(attachment.id))) continue;
      const data = await this.source.download(String(attachment.content));
      const id = uuidv7();
      const storageKey = `attachments/${id}`;
      const folder = await mkdtemp(join(tmpdir(), 'tl-import-'));
      try {
        const file = join(folder, 'file');
        await writeFile(file, data);
        const { type, image } = contentTypeOf(
          data.subarray(0, 64),
          String(attachment.mimeType ?? ''),
        );
        await this.context.store.put(storageKey, file, type);
        const row: typeof issueAttachments.$inferInsert = {
          id,
          issueId,
          authorId: await this.user(attachment.author),
          fileName: String(attachment.filename ?? 'datei').slice(0, 255),
          contentType: type,
          size: data.length,
          image,
          storageKey,
          sha256: createHash('sha256').update(data).digest('hex'),
          createdAt: dateOf(attachment.created) ?? new Date(),
        };
        await this.context.database.db.insert(issueAttachments).values(row);
      } finally {
        await rm(folder, { recursive: true, force: true });
      }
      await this.remember('attachment', String(attachment.id), id);
      this.count('Anhänge');
    }
  }

  private async link(
    link: Json,
    issueIds: Map<string, string>,
    meta: Awaited<ReturnType<MetaService['load']>>,
  ) {
    const sourceId = issueIds.get(String(link.from));
    const targetId = issueIds.get(String(link.outwardIssue?.key));
    if (!sourceId || !targetId) {
      this.note(
        'skipped',
        `Verknüpfungen zu Vorgängen außerhalb des Imports (z. B. ${link.from} → ${link.outwardIssue?.key})`,
      );
      return;
    }
    if (await this.mapped('link', String(link.id))) return;
    const type =
      meta.linkTypes.find(
        (entry) =>
          lower(entry.name) === lower(link.type?.name) ||
          lower(entry.outward) === lower(link.type?.outward),
      ) ??
      meta.linkTypes.find((entry) => entry.key === 'relates') ??
      meta.linkTypes[0];
    if (!type) return;
    if (lower(type.name) !== lower(link.type?.name))
      this.note('mappings', `Verknüpfung ${link.type?.name} → ${type.name}`);
    const id = uuidv7();
    await this.context.database.db
      .insert(issueLinks)
      .values({ id, typeId: type.id, sourceId, targetId })
      .onConflictDoNothing();
    await this.remember('link', String(link.id), id);
    this.count('Verknüpfungen');
  }

  /** Scrum boards and their sprints with the issues in them. */
  private async boards(key: string, projectKey: string | null, issueIds: Map<string, string>) {
    let list: Json[];
    try {
      list = await this.source.all(
        `/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(key)}`,
      );
    } catch {
      this.note('skipped', 'Boards und Sprints: Agile-Schnittstelle nicht erreichbar');
      return;
    }
    const db = this.context.database.db;
    for (const jiraBoard of list) {
      if (jiraBoard.type !== 'scrum' && jiraBoard.type !== 'kanban') continue;
      let boardId = await this.mapped('board', String(jiraBoard.id));
      if (!boardId && !this.context.dryRun && projectKey) {
        const created = await this.context.boards.create(this.context.principal, {
          name: String(jiraBoard.name).slice(0, 80),
          projectKey,
          type: jiraBoard.type,
        } as never);
        boardId = created.id;
        await this.remember('board', String(jiraBoard.id), boardId);
      }
      this.count('Boards');
      if (jiraBoard.type !== 'scrum') continue;
      const jiraSprints = await this.source.all(`/rest/agile/1.0/board/${jiraBoard.id}/sprint`);
      const active = jiraSprints.filter((entry) => entry.state === 'active').length;
      if (boardId && active > 1)
        await db.update(boards).set({ parallelSprints: true }).where(eq(boards.id, boardId));
      for (const jiraSprint of jiraSprints) {
        this.count('Sprints');
        if (!boardId || this.context.dryRun) continue;
        let sprintId = await this.mapped('sprint', String(jiraSprint.id));
        if (!sprintId) {
          sprintId = uuidv7();
          await db.insert(sprints).values({
            id: sprintId,
            boardId,
            name: String(jiraSprint.name).slice(0, 80),
            goal: String(jiraSprint.goal ?? ''),
            state:
              jiraSprint.state === 'active'
                ? 'active'
                : jiraSprint.state === 'closed'
                  ? 'closed'
                  : 'future',
            startDate:
              typeof jiraSprint.startDate === 'string' ? jiraSprint.startDate.slice(0, 10) : null,
            endDate:
              typeof jiraSprint.endDate === 'string' ? jiraSprint.endDate.slice(0, 10) : null,
            startedAt: jiraSprint.state !== 'future' ? dateOf(jiraSprint.startDate) : null,
            completedAt: dateOf(jiraSprint.completeDate),
          });
          await this.remember('sprint', String(jiraSprint.id), sprintId);
        }
        const members = await this.source.all(
          `/rest/agile/1.0/sprint/${jiraSprint.id}/issue?fields=key`,
          'issues',
          100,
        );
        for (const member of members) {
          const issueId = issueIds.get(String(member.key));
          if (!issueId) continue;
          const [present] = await db
            .select({ id: sprintIssues.id })
            .from(sprintIssues)
            .where(and(eq(sprintIssues.sprintId, sprintId), eq(sprintIssues.issueId, issueId)));
          if (!present) await db.insert(sprintIssues).values({ id: uuidv7(), sprintId, issueId });
        }
      }
    }
  }
}
