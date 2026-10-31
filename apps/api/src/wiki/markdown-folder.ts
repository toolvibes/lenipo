import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { docToMarkdown, markdownToDoc } from '@tasklore/editor';
import type { Page, PageTreeEntry, RichText } from '@tasklore/shared';
import type { Principal } from '../core/http/principal.js';
import type { PageService } from './page.service.js';
import type { SpaceService } from './space.service.js';

/**
 * A folder of Markdown files as a snapshot of a wiki space (E-76). The wiki is the master;
 * `exportFolder` writes its published pages below the home page as files, one per page, each
 * starting with a marker that names page and version. `importFolder` brings edited files
 * back as new versions, but only when the page has not changed since the file was exported,
 * so nothing written in the wiki is lost. Files without a marker become new pages; every file
 * the import publishes gets the marker of its new version.
 */

export interface FolderServices {
  spaces: SpaceService;
  pages: PageService;
}

const MARKER = /^<!-- tasklore page=([0-9a-f-]{36}) version=(\d+)\b[^\n]*-->\n/;
const marker = (page: Page) =>
  `<!-- tasklore page=${page.id} version=${page.version} · Schnappschuss aus dem Wiki, Änderungen bitte dort -->\n`;

/** Pages link to each other by their path in the web app. */
const pageHref = (spaceKey: string, id: string) => `/spaces/${spaceKey}/pages/${id}`;

interface MarkdownFile {
  /** Path relative to the folder, with forward slashes. */
  path: string;
  page: { id: string; version: number } | null;
  title: string;
  body: string;
  /** The file without its marker. */
  text: string;
}

interface Mark {
  type: string;
  attrs?: Record<string, unknown>;
}
export interface JsonNode {
  marks?: Mark[];
  content?: JsonNode[];
}

/** Calls `change` with every link target in the document and stores what it returns. */
export function rewriteLinks(node: JsonNode, change: (href: string) => string): void {
  for (const mark of node.marks ?? []) {
    if (mark.type === 'link' && typeof mark.attrs?.href === 'string') {
      mark.attrs.href = change(mark.attrs.href);
    }
  }
  for (const child of node.content ?? []) rewriteLinks(child, change);
}

async function markdownFiles(folder: string, below = ''): Promise<string[]> {
  const entries = await readdir(join(folder, below), { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    },
  );
  const found: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = below ? `${below}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...(await markdownFiles(folder, path)));
    else if (entry.name.endsWith('.md')) found.push(path);
  }
  return found;
}

/** Splits a file into its marker, its title (the first `# ` heading) and the rest. */
export function parseMarkdownFile(path: string, content: string): MarkdownFile {
  let rest = content.replace(/\r\n/g, '\n');
  const found = MARKER.exec(rest);
  if (found) rest = rest.slice(found[0].length);
  const text = rest;
  const heading = /^\s*# (.+)\n?/.exec(rest);
  const title = heading?.[1]?.trim() ?? posix.basename(path, '.md');
  if (heading) rest = rest.slice(heading[0].length);
  return {
    path,
    page: found ? { id: found[1] as string, version: Number(found[2]) } : null,
    title,
    body: rest.trim(),
    text,
  };
}

export const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'seite';

export interface ImportResult {
  created: string[];
  updated: string[];
  unchanged: string[];
  /** Links to Markdown files that are not part of the folder. */
  unresolved: string[];
}

/**
 * Brings the files of `folder` into the space, below its home page, creating the space and
 * the home page when needed. Checks every file first and changes nothing on a conflict.
 */
export async function importFolder(
  services: FolderServices,
  principal: Principal,
  folder: string,
  options: { spaceKey: string; spaceName?: string; skip?: string[] },
): Promise<ImportResult> {
  const { spaces, pages } = services;
  const skip = new Set(options.skip ?? []);
  const files: MarkdownFile[] = [];
  for (const path of await markdownFiles(folder)) {
    if (skip.has(path)) continue;
    files.push(parseMarkdownFile(path, await readFile(join(folder, path), 'utf8')));
  }

  const spaceKey = options.spaceKey.toUpperCase();
  let space = await spaces.get(principal, spaceKey).catch((error: unknown) => {
    if (error instanceof NotFoundException) return null;
    throw error;
  });
  const tree = space ? await pages.tree(principal, spaceKey) : [];

  // Check everything before the first write.
  const current = new Map<string, Page>();
  for (const file of files) {
    if (!file.page) {
      continue;
    }
    if (!space) throw new ConflictException(`${file.path}: the space ${spaceKey} does not exist`);
    const page = await pages.get(principal, file.page.id).catch((error: unknown) => {
      if (error instanceof NotFoundException) return null;
      throw error;
    });
    if (!page || page.space.key !== spaceKey) {
      throw new ConflictException(`${file.path}: page ${file.page.id} is not in ${spaceKey}`);
    }
    if (page.version !== file.page.version) {
      throw new ConflictException(
        `${file.path}: the page has changed in the wiki since version ${file.page.version} (now ${page.version}); export first`,
      );
    }
    current.set(file.path, page);
  }

  if (!space) {
    space = await spaces.create(principal, {
      key: spaceKey,
      name: options.spaceName ?? spaceKey,
      description: '',
    });
  }
  let homeId = space.homePageId;
  if (!homeId) {
    const home = await pages.create(principal, spaceKey, {
      title: options.spaceName ?? space.name,
      parentId: null,
    });
    await pages.publish(principal, home.id, {
      title: home.title,
      content: markdownToDoc('::children') as RichText,
      comment: '',
    });
    homeId = home.id;
  }

  // New pages first, so every link between files can point at a page.
  const result: ImportResult = { created: [], updated: [], unchanged: [], unresolved: [] };
  const ids = new Map<string, string>();
  const parentOf = (path: string) => {
    const folderPath = posix.dirname(path);
    return folderPath === '.' ? homeId : (ids.get(`${folderPath}.md`) ?? homeId);
  };
  for (const file of [...files].sort(
    (a, b) => a.path.split('/').length - b.path.split('/').length,
  )) {
    if (file.page) {
      ids.set(file.path, file.page.id);
      continue;
    }
    const parentId = parentOf(file.path);
    if (tree.some((entry) => entry.parentId === parentId && entry.title === file.title)) {
      throw new ConflictException(
        `${file.path}: a page "${file.title}" already exists there; export first`,
      );
    }
    const page = await pages.create(principal, spaceKey, { title: file.title, parentId });
    ids.set(file.path, page.id);
    current.set(file.path, page);
    result.created.push(file.path);
  }

  for (const file of files) {
    const page = current.get(file.path) as Page;
    const doc = markdownToDoc(file.body) as RichText & JsonNode;
    rewriteLinks(doc, (href) => {
      const link = /^(?![a-z][a-z0-9+.-]*:|\/)([^#?]+\.md)(#.*)?$/i.exec(href);
      if (!link) return href;
      const target = posix.normalize(posix.join(posix.dirname(file.path), link[1] as string));
      const id = ids.get(target);
      if (!id) {
        result.unresolved.push(`${file.path} → ${href}`);
        return href;
      }
      return pageHref(spaceKey, id) + (link[2] ?? '');
    });
    if (
      page.version > 0 &&
      page.title === file.title &&
      docToMarkdown(page.content).trim() === docToMarkdown(doc).trim()
    ) {
      result.unchanged.push(file.path);
      continue;
    }
    const published = await pages.publish(principal, page.id, {
      title: file.title,
      content: doc,
      comment: page.version === 0 ? 'Import aus Markdown' : 'Aus dem Markdown-Schnappschuss',
    });
    if (page.version > 0) result.updated.push(file.path);
    // The file now matches the new version, so the next import or export knows its page.
    await writeFile(join(folder, file.path), marker(published) + file.text);
  }
  return result;
}

export interface ExportResult {
  written: string[];
  removed: string[];
  /** Pages that were never published and so have no content to export. */
  drafts: string[];
}

/**
 * Writes the published pages below the space's home page into `folder`. A page keeps the file
 * it was exported to before; new pages get a numbered name, child pages a folder named after
 * their parent's file. Files of pages that are gone are removed; files without a marker stay.
 */
export async function exportFolder(
  services: FolderServices,
  principal: Principal,
  folder: string,
  options: { spaceKey: string },
): Promise<ExportResult> {
  const { spaces, pages } = services;
  const spaceKey = options.spaceKey.toUpperCase();
  const space = await spaces.get(principal, spaceKey);
  if (!space.homePageId) throw new NotFoundException(`The space ${spaceKey} has no home page`);
  const tree = await pages.tree(principal, spaceKey);

  const known = new Map<string, string>();
  const markedFiles: string[] = [];
  for (const path of await markdownFiles(folder)) {
    const file = parseMarkdownFile(path, await readFile(join(folder, path), 'utf8'));
    if (!file.page) continue;
    markedFiles.push(path);
    known.set(file.page.id, path);
  }

  // Decide every path first, so links can point at files written later.
  const result: ExportResult = { written: [], removed: [], drafts: [] };
  const paths = new Map<string, string>();
  const place = (parentId: string, below: string) => {
    const children = tree.filter((entry) => entry.parentId === parentId);
    children.forEach((entry: PageTreeEntry, index) => {
      if (!entry.published) {
        result.drafts.push(entry.title);
        return;
      }
      const path =
        known.get(entry.id) ??
        `${below}${String(index + 1).padStart(2, '0')}-${slug(entry.title)}.md`;
      paths.set(entry.id, path);
      place(entry.id, `${path.slice(0, -3)}/`);
    });
  };
  place(space.homePageId, '');

  const internal = new RegExp(`^/spaces/${spaceKey}/pages/([0-9a-f-]{36})(#.*)?$`, 'i');
  for (const [id, path] of paths) {
    const page = await pages.get(principal, id);
    const doc = structuredClone(page.content) as JsonNode;
    rewriteLinks(doc, (href) => {
      const link = internal.exec(href);
      const target = link && paths.get(link[1] as string);
      if (!target) return href;
      return posix.relative(posix.dirname(path), target) + (link[2] ?? '');
    });
    const body = docToMarkdown(doc).trim();
    const text = `${marker(page)}# ${page.title}\n${body ? `\n${body}\n` : ''}`;
    const file = join(folder, path);
    const before = await readFile(file, 'utf8').catch(() => null);
    if (before !== text) {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, text);
      result.written.push(path);
    }
  }
  const kept = new Set(paths.values());
  for (const path of markedFiles) {
    if (kept.has(path)) continue;
    await rm(join(folder, path));
    result.removed.push(path);
  }
  return result;
}
