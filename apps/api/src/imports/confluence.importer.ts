import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { markdownToDoc } from '@toolvibes/editor';
import type { ImportReport } from '@toolvibes/shared';
import { and, eq } from 'drizzle-orm';
import { Unzip, UnzipInflate, UnzipPassThrough } from 'fflate';
import { Parser } from 'htmlparser2';
import { v7 as uuidv7 } from 'uuid';
import type { Principal } from '../core/http/principal.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  importMappings,
  pageAttachments,
  pageComments,
  pages,
  pageVersions,
  spaces,
  users,
} from '../db/schema/index.js';
import type { FileStore } from '../storage/file-store.js';
import { contentTypeOf } from '../storage/upload.js';
import { rankBetween } from '../tracking/rank.js';
import { plainText } from '../tracking/rich-text.js';
import type { SpaceService } from '../wiki/space.service.js';
import { storageToMarkdown } from './confluence-storage.js';

/** One object of entities.xml: its class, id and properties (values or references). */
interface Entity {
  cls: string;
  id: string;
  values: Record<string, string>;
  refs: Record<string, string>;
}

const KEPT = new Set([
  'Space',
  'Page',
  'BlogPost',
  'BodyContent',
  'Comment',
  'Attachment',
  'Labelling',
  'Label',
  'ConfluenceUserImpl',
]);

/** Reads the files of a ZIP one by one as streams; `wanted` decides which are inflated. */
function readZip(
  path: string,
  wanted: (name: string) => boolean,
  onFile: (name: string, chunk: Uint8Array, final: boolean) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const unzip = new Unzip((file) => {
      if (!wanted(file.name)) return;
      file.ondata = (error, chunk, final) => {
        if (error) reject(error);
        else onFile(file.name, chunk, final);
      };
      file.start();
    });
    unzip.register(UnzipInflate);
    unzip.register(UnzipPassThrough);
    const input = createReadStream(path);
    input.on('data', (chunk) => unzip.push(chunk as Uint8Array));
    input.on('end', () => {
      unzip.push(new Uint8Array(0), true);
      resolve();
    });
    input.on('error', reject);
  });
}

/** Parses entities.xml while it streams out of the ZIP; keeps only the classes needed. */
async function readEntities(zipPath: string): Promise<Entity[]> {
  const entities: Entity[] = [];
  let current: Entity | null = null;
  let property: { name: string; ref: boolean } | null = null;
  let idName = '';
  let text = '';
  let depth = 0;
  let objectDepth = -1;
  const parser = new Parser(
    {
      onopentag(name, attribs) {
        depth += 1;
        text = '';
        if (name === 'object' && !current) {
          current = { cls: attribs.class ?? '', id: '', values: {}, refs: {} };
          objectDepth = depth;
        } else if (current && name === 'property' && depth === objectDepth + 1) {
          property = { name: attribs.name ?? '', ref: !!attribs.class };
        } else if (name === 'id') {
          idName = attribs.name ?? 'id';
        }
      },
      ontext(data) {
        text += data;
      },
      onclosetag(name) {
        if (current) {
          if (name === 'id') {
            if (property?.ref) current.refs[property.name] = text.trim();
            else if (depth === objectDepth + 1 && idName) current.id = text.trim();
          } else if (name === 'property' && property && depth === objectDepth + 1) {
            if (!property.ref) current.values[property.name] = text;
            property = null;
          } else if (name === 'object' && depth === objectDepth) {
            if (KEPT.has(current.cls)) entities.push(current);
            current = null;
          }
        }
        text = '';
        depth -= 1;
      },
    },
    { xmlMode: true, recognizeCDATA: true, decodeEntities: true },
  );
  const decoder = new TextDecoder();
  await readZip(
    zipPath,
    (name) => name === 'entities.xml',
    (_, chunk, final) => {
      parser.write(decoder.decode(chunk, { stream: !final }));
      if (final) parser.end();
    },
  );
  return entities;
}

export interface ConfluenceContext {
  database: DatabaseHandle;
  store: FileStore;
  spaces: SpaceService;
  principal: Principal;
  dryRun: boolean;
  progress: (text: string) => Promise<void>;
}

const dateOf = (value: string | undefined) => {
  if (!value) return new Date();
  const parsed = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

/**
 * A Confluence Server/DC space export (P-ADM-11, E-118): pages with all versions, blog posts,
 * comments, attachments and labels; storage format converted with the macro map.
 */
export class ConfluenceImporter {
  private readonly report: ImportReport = { counts: {}, mappings: [], skipped: [] };
  private readonly origin: string;

  constructor(
    private readonly zipPath: string,
    sourceName: string,
    private readonly context: ConfluenceContext,
  ) {
    this.origin = `confluence:${sourceName}`;
  }

  private count(what: string, by = 1) {
    this.report.counts[what] = (this.report.counts[what] ?? 0) + by;
  }

  private async mapped(kind: string, sourceId: string) {
    const [row] = await this.context.database.db
      .select({ targetId: importMappings.targetId })
      .from(importMappings)
      .where(
        and(
          eq(importMappings.origin, this.origin),
          eq(importMappings.kind, kind),
          eq(importMappings.sourceId, sourceId),
        ),
      );
    return row?.targetId ?? null;
  }

  private async remember(kind: string, sourceId: string, targetId: string) {
    await this.context.database.db
      .insert(importMappings)
      .values({ origin: this.origin, kind, sourceId, targetId })
      .onConflictDoNothing();
  }

  async run(targetKey: string | undefined): Promise<ImportReport> {
    const { database, dryRun } = this.context;
    const db = database.db;
    await this.context.progress('entities.xml lesen');
    const entities = await readEntities(this.zipPath);
    const byClass = (cls: string) => entities.filter((entity) => entity.cls === cls);
    const space = byClass('Space')[0];
    if (!space) throw new Error('Kein Bereich im Export gefunden (entities.xml ohne Space)');
    const key = (targetKey || space.values.key || 'CONF')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10);
    const bodies = new Map(
      byClass('BodyContent').map((body) => [body.refs.content ?? '', body.values.body ?? '']),
    );
    const people = new Map(byClass('ConfluenceUserImpl').map((user) => [user.id, user]));

    // Current pages and blog posts; older versions point at them with originalVersion.
    const contents = [...byClass('Page'), ...byClass('BlogPost')];
    const current = contents.filter(
      (entry) =>
        !entry.refs.originalVersion && (entry.values.contentStatus ?? 'current') === 'current',
    );
    const history = new Map<string, Entity[]>();
    for (const entry of contents.filter((item) => item.refs.originalVersion)) {
      const list = history.get(entry.refs.originalVersion as string) ?? [];
      list.push(entry);
      history.set(entry.refs.originalVersion as string, list);
    }
    this.count('Seiten', current.filter((entry) => entry.cls === 'Page').length);
    this.count('Blogbeiträge', current.filter((entry) => entry.cls === 'BlogPost').length);
    this.count('Versionen', contents.length);
    const comments = byClass('Comment').filter(
      (entry) =>
        (entry.values.contentStatus ?? 'current') === 'current' && !entry.refs.originalVersion,
    );
    this.count('Kommentare', comments.length);
    const attachments = byClass('Attachment').filter(
      (entry) =>
        !entry.refs.originalVersion && (entry.values.contentStatus ?? 'current') === 'current',
    );
    this.count('Anhänge', attachments.length);
    const labels = new Map(byClass('Label').map((label) => [label.id, label.values.name ?? '']));
    const labelling = byClass('Labelling');

    // People: by e-mail, else deactivated accounts (E-118).
    const userIds = new Map<string, string | null>();
    const user = async (keyRef: string | undefined): Promise<string | null> => {
      if (!keyRef) return null;
      if (userIds.has(keyRef)) return userIds.get(keyRef) ?? null;
      const person = people.get(keyRef);
      const email = (
        person?.values.email ||
        `${(person?.values.lowerName ?? keyRef).replace(/[^a-z0-9._-]/gi, '-').toLowerCase()}@confluence.invalid`
      ).toLowerCase();
      let id = await this.mapped('user', keyRef);
      if (!id) {
        const [existing] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email));
        if (existing) id = existing.id;
        else if (!dryRun) {
          id = uuidv7();
          await db.insert(users).values({
            id,
            email,
            displayName: person?.values.name ?? email,
            status: 'deactivated',
          });
          this.count('Personen angelegt (deaktiviert)');
        }
        if (id && !dryRun) await this.remember('user', keyRef, id);
      }
      userIds.set(keyRef, id);
      return id;
    };

    const unknown = new Set<string>();
    if (dryRun) {
      for (const entry of current) {
        storageToMarkdown(bodies.get(entry.id) ?? '', {
          spaceKey: key,
          pageId: () => null,
          attachmentId: () => null,
          userName: () => null,
          unknownMacro: (name) => unknown.add(name),
        });
      }
      for (const name of unknown)
        this.report.skipped.push(`Makro „${name}“: ohne Gegenstück, als Hinweis übernommen`);
      const [taken] = await db.select({ id: spaces.id }).from(spaces).where(eq(spaces.key, key));
      if (taken && !(await this.mapped('space', space.id))) {
        this.report.skipped.push(
          `Den Bereichsschlüssel ${key} gibt es schon; einen anderen Zielschlüssel wählen`,
        );
      }
      this.report.mappings.push(`Bereich ${space.values.key} → ${key}`);
      return this.report;
    }

    // The space.
    let spaceId = await this.mapped('space', space.id);
    if (!spaceId) {
      const [taken] = await db.select({ id: spaces.id }).from(spaces).where(eq(spaces.key, key));
      if (taken)
        throw new Error(
          `Den Bereichsschlüssel ${key} gibt es in Lenipo schon; einen anderen Zielschlüssel wählen`,
        );
      const created = await this.context.spaces.create(this.context.principal, {
        key,
        name: (space.values.name ?? key).slice(0, 80),
        description: '',
      } as never);
      spaceId = created.id;
      await this.remember('space', space.id, spaceId);
    }

    // Page ids first, so links between pages resolve; parents before children.
    const ids = new Map<string, string>();
    for (const entry of current) {
      ids.set(entry.id, (await this.mapped('page', entry.id)) ?? uuidv7());
    }
    const titleToId = new Map(
      current
        .filter((entry) => entry.cls === 'Page')
        .map((entry) => [entry.values.title ?? '', ids.get(entry.id) as string]),
    );
    const homeId = space.refs.homePage ? ids.get(space.refs.homePage) : undefined;
    const parentOf = (entry: Entity): string | null => {
      if (entry.cls === 'BlogPost') return null;
      if (entry.id === space.refs.homePage) return null;
      const parent = entry.refs.parent ? ids.get(entry.refs.parent) : undefined;
      return parent ?? homeId ?? null;
    };
    const ordered: Entity[] = [];
    const placed = new Set<string>();
    const place = (entry: Entity) => {
      if (placed.has(entry.id)) return;
      if (entry.refs.parent && entry.refs.parent !== entry.id) {
        const parent = current.find((item) => item.id === entry.refs.parent);
        if (parent) place(parent);
      }
      placed.add(entry.id);
      ordered.push(entry);
    };
    const home = current.find((entry) => entry.id === space.refs.homePage);
    if (home) place(home);
    for (const entry of [...current].sort(
      (a, b) => Number(a.values.position ?? 0) - Number(b.values.position ?? 0),
    ))
      place(entry);

    // Attachments before content, so images can point at them.
    const attachmentIds = new Map<string, Map<string, string>>();
    const wantedFiles = new Map<string, Entity>();
    for (const attachment of attachments) {
      const pageId = ids.get(attachment.refs.containerContent ?? '');
      if (!pageId) continue;
      const known = await this.mapped('attachment', attachment.id);
      const id = known ?? uuidv7();
      const files = attachmentIds.get(pageId) ?? new Map<string, string>();
      files.set(attachment.values.title ?? '', id);
      attachmentIds.set(pageId, files);
      if (!known)
        wantedFiles.set(
          `attachments/${attachment.refs.containerContent}/${attachment.id}/${attachment.values.version ?? '1'}`,
          attachment,
        );
    }

    const ranks = new Map<string | null, string | null>();
    let done = 0;
    for (const entry of ordered) {
      const pageId = ids.get(entry.id) as string;
      if (await this.mapped('page', entry.id)) continue;
      const parentId = parentOf(entry);
      const rank = rankBetween(ranks.get(parentId) ?? null, null);
      ranks.set(parentId, rank);
      const versions = [...(history.get(entry.id) ?? []), entry].sort(
        (a, b) => Number(a.values.version ?? 0) - Number(b.values.version ?? 0),
      );
      const pageLabels = labelling
        .filter((link) => link.refs.content === entry.id)
        .map((link) => labels.get(link.refs.label ?? '') ?? '')
        .filter(Boolean);
      const files = attachmentIds.get(pageId) ?? new Map<string, string>();
      const convert = (body: string) =>
        markdownToDoc(
          storageToMarkdown(body, {
            spaceKey: key,
            pageId: (title) => titleToId.get(title) ?? null,
            attachmentId: (name) => files.get(name) ?? null,
            userName: (userKey) => people.get(userKey)?.values.name ?? null,
            unknownMacro: (name) => unknown.add(name),
          }),
        );
      const last = versions.at(-1) as Entity;
      await db.insert(pages).values({
        id: pageId,
        spaceId,
        parentId,
        rank,
        title: (entry.values.title ?? 'Ohne Titel').slice(0, 255),
        version: versions.length,
        publishedAt: dateOf(last.values.lastModificationDate),
        createdById: await user(entry.refs.creator),
        createdAt: dateOf(entry.values.creationDate),
        updatedAt: dateOf(last.values.lastModificationDate),
        kind: entry.cls === 'BlogPost' ? 'blog' : 'page',
        labels: [...new Set(pageLabels.map((label) => label.toLowerCase()))],
      } as never);
      let number = 0;
      for (const version of versions) {
        number += 1;
        const doc = convert(bodies.get(version.id) ?? '');
        await db.insert(pageVersions).values({
          id: uuidv7(),
          pageId,
          number,
          title: (version.values.title ?? entry.values.title ?? '').slice(0, 255),
          content: doc,
          text: plainText(doc),
          authorId: await user(version.refs.lastModifier ?? version.refs.creator),
          comment: (version.values.versionComment ?? '').slice(0, 500),
          createdAt: dateOf(version.values.lastModificationDate),
        } as never);
      }
      await this.remember('page', entry.id, pageId);
      done += 1;
      if (done % 20 === 0) await this.context.progress(`${done} von ${ordered.length} Seiten`);
    }
    if (homeId) await db.update(spaces).set({ homePageId: homeId }).where(eq(spaces.id, spaceId));

    // Comments, threads after their parents.
    const commentIds = new Map<string, string>();
    for (const comment of [...comments].sort(
      (a, b) => (a.refs.parent ? 1 : 0) - (b.refs.parent ? 1 : 0),
    )) {
      const pageId = ids.get(comment.refs.containerContent ?? '');
      if (!pageId || (await this.mapped('comment', comment.id))) continue;
      const doc = markdownToDoc(
        storageToMarkdown(bodies.get(comment.id) ?? '', {
          spaceKey: key,
          pageId: (title) => titleToId.get(title) ?? null,
          attachmentId: () => null,
          userName: (userKey) => people.get(userKey)?.values.name ?? null,
          unknownMacro: (name) => unknown.add(name),
        }),
      );
      const id = uuidv7();
      await db.insert(pageComments).values({
        id,
        pageId,
        parentId: comment.refs.parent ? (commentIds.get(comment.refs.parent) ?? null) : null,
        authorId: await user(comment.refs.creator),
        body: doc,
        bodyText: plainText(doc),
        createdAt: dateOf(comment.values.creationDate),
        updatedAt: dateOf(comment.values.lastModificationDate ?? comment.values.creationDate),
      } as never);
      commentIds.set(comment.id, id);
      await this.remember('comment', comment.id, id);
    }

    // Attachment files: a second pass over the ZIP.
    if (wantedFiles.size > 0) {
      await this.context.progress('Anhänge übernehmen');
      const buffers = new Map<string, Uint8Array[]>();
      const finished: Array<{ name: string; data: Buffer }> = [];
      await readZip(
        this.zipPath,
        (name) => wantedFiles.has(name),
        (name, chunk, final) => {
          const parts = buffers.get(name) ?? [];
          parts.push(chunk);
          buffers.set(name, parts);
          if (final) {
            finished.push({ name, data: Buffer.concat(parts) });
            buffers.delete(name);
          }
        },
      );
      const folder = await mkdtemp(join(tmpdir(), 'tl-confluence-'));
      try {
        for (const { name, data } of finished) {
          const attachment = wantedFiles.get(name) as Entity;
          const pageId = ids.get(attachment.refs.containerContent ?? '') as string;
          const id = attachmentIds.get(pageId)?.get(attachment.values.title ?? '') as string;
          const storageKey = `page-attachments/${id}`;
          const file = join(folder, id);
          await writeFile(file, data);
          const { type, image } = contentTypeOf(
            data.subarray(0, 64),
            attachment.values.contentType ?? '',
          );
          await this.context.store.put(storageKey, file, type);
          await db.insert(pageAttachments).values({
            id,
            pageId,
            authorId: await user(attachment.refs.creator),
            fileName: (attachment.values.title ?? 'datei').slice(0, 255),
            contentType: type,
            size: data.length,
            image,
            storageKey,
            sha256: createHash('sha256').update(data).digest('hex'),
            createdAt: dateOf(attachment.values.creationDate),
          } as never);
          await this.remember('attachment', attachment.id, id);
        }
      } finally {
        await rm(folder, { recursive: true, force: true });
      }
      const missing = wantedFiles.size - finished.length;
      if (missing > 0) this.report.skipped.push(`${missing} Anhänge fehlen im Export`);
    }
    for (const name of unknown)
      this.report.skipped.push(`Makro „${name}“: ohne Gegenstück, als Hinweis übernommen`);
    this.report.mappings.push(`Bereich ${space.values.key} → ${key}`);
    return this.report;
  }
}
