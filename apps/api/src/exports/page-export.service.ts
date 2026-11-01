import { posix } from 'node:path';
import { PassThrough, type Readable } from 'node:stream';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { docToHtml, docToMarkdown, escapeHtml, type HtmlNode } from '@toolvibes/editor';
import type {
  Attachment,
  Page,
  PageExportFormat,
  PageTreeEntry,
  SpaceExportFormat,
} from '@toolvibes/shared';
import { strToU8, Zip, ZipDeflate, ZipPassThrough } from 'fflate';
import type { AppConfig } from '../core/config.js';
import type { Principal } from '../core/http/principal.js';
import { CONFIG } from '../core/tokens.js';
import { SearchService } from '../search/search.service.js';
import { type JsonNode, rewriteLinks, slug } from '../wiki/markdown-folder.js';
import { PageService } from '../wiki/page.service.js';
import { PageAttachmentService } from '../wiki/page-attachment.service.js';
import { SpaceService } from '../wiki/space.service.js';
import { type DocxImage, imageSize, type MacroTable, toDocx } from './docx.js';
import { EXPORT_CSS } from './export-css.js';

/** Child pages exported along with a page, and pages of a space export. */
const PAGE_LIMIT = 200;
const SPACE_LIMIT = 2000;
/** Larger images stay out of single files (Word, one HTML file); ZIPs keep every attachment. */
const INLINE_IMAGE_BYTES = 10 * 1024 * 1024;

type Locale = 'de' | 'en';

const WORDS = {
  de: {
    page: 'Seite',
    contents: 'Inhalt',
    image: 'Bild',
    issues: ['Schlüssel', 'Zusammenfassung', 'Status', 'Bearbeitung'],
    count: (count: number) => `${count} Vorgänge`,
    meta: (version: number, name: string, date: string) => `Version ${version} · ${name} · ${date}`,
    macro: (name: string) => `[${name} – in Lenipo ansehen]`,
    macros: {
      report: 'Bericht',
      childPages: 'Unterseiten',
      includePage: 'Eingebundene Seite',
      excerptInclude: 'Eingebundener Auszug',
      propertiesReport: 'Seiteneigenschaften-Bericht',
      contentByLabel: 'Seiten mit Stichwort',
      recentlyUpdated: 'Zuletzt geändert',
      taskReport: 'Aufgabenbericht',
      attachmentList: 'Anhänge',
      documentPreview: 'Dokumentvorschau',
      embed: 'Eingebettete Seite',
      liveSearch: 'Suche',
    } as Record<string, string>,
  },
  en: {
    page: 'Page',
    contents: 'Contents',
    image: 'Image',
    issues: ['Key', 'Summary', 'Status', 'Assignee'],
    count: (count: number) => `${count} issues`,
    meta: (version: number, name: string, date: string) => `Version ${version} · ${name} · ${date}`,
    macro: (name: string) => `[${name} – view in Lenipo]`,
    macros: {
      report: 'Report',
      childPages: 'Child pages',
      includePage: 'Included page',
      excerptInclude: 'Included excerpt',
      propertiesReport: 'Page properties report',
      contentByLabel: 'Pages by label',
      recentlyUpdated: 'Recently updated',
      taskReport: 'Task report',
      attachmentList: 'Attachments',
      documentPreview: 'Document preview',
      embed: 'Embedded page',
      liveSearch: 'Search',
    } as Record<string, string>,
  },
};

interface Entry {
  page: Page;
  /** Path inside an archive, without extension, e.g. `betrieb/01-backup`. */
  path: string;
  depth: number;
}

export interface ExportFile {
  body: Readable | Buffer | string;
  type: string;
  fileName: string;
}

interface ZipWriter {
  text(name: string, text: string): void;
  stream(name: string, content: Readable): Promise<void>;
}

/** A ZIP written while it is sent: text compressed, attachments stored as they are. */
function zipStream(fill: (zip: ZipWriter) => Promise<void>): Readable {
  const out = new PassThrough();
  const zip = new Zip((error, chunk, final) => {
    if (error) {
      out.destroy(error);
      return;
    }
    out.write(chunk);
    if (final) out.end();
  });
  const writer: ZipWriter = {
    text(name, text) {
      const file = new ZipDeflate(name, { level: 6 });
      zip.add(file);
      file.push(strToU8(text), true);
    },
    async stream(name, content) {
      const file = new ZipPassThrough(name);
      zip.add(file);
      for await (const chunk of content) file.push(chunk as Uint8Array);
      file.push(new Uint8Array(0), true);
    },
  };
  fill(writer).then(
    () => zip.end(),
    (error: Error) => out.destroy(error),
  );
  return out;
}

const INTERNAL = /^\/spaces\/[A-Z0-9]+\/pages\/([0-9a-f-]{36})(#.*)?$/i;

/** Pages and spaces as Word, Markdown and HTML (W-EXP-01..03, E-111). */
@Injectable()
export class PageExportService {
  constructor(
    @Inject(PageService) private readonly pages: PageService,
    @Inject(SpaceService) private readonly spaces: SpaceService,
    @Inject(PageAttachmentService) private readonly attachments: PageAttachmentService,
    @Inject(SearchService) private readonly search: SearchService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  private get base(): string {
    return (this.config.PUBLIC_URL ?? '').replace(/\/$/, '');
  }

  /** The page and, with a tree, its published descendants in tree order, with archive paths. */
  private async collect(
    principal: Principal,
    root: Page,
    tree: PageTreeEntry[] | null,
    limit: number,
  ): Promise<Entry[]> {
    if (root.version === 0) {
      throw new BadRequestException('Drafts that were never published cannot be exported');
    }
    const planned: Array<{ id: string; path: string; depth: number }> = [];
    const below = (parentId: string, path: string, depth: number) => {
      const children = (tree ?? []).filter(
        (entry) => entry.parentId === parentId && entry.published,
      );
      children.forEach((child, index) => {
        if (planned.length + 1 >= limit) return;
        const childPath = `${path}/${String(index + 1).padStart(2, '0')}-${slug(child.title)}`;
        planned.push({ id: child.id, path: childPath, depth });
        below(child.id, childPath, depth + 1);
      });
    };
    const entries: Entry[] = [{ page: root, path: slug(root.title), depth: 0 }];
    below(root.id, slug(root.title), 1);
    for (const entry of planned) {
      entries.push({ ...entry, page: await this.pages.get(principal, entry.id) });
    }
    return entries;
  }

  /** Results of the data macros: issue lists as tables, child pages as their titles. */
  private async macros(
    principal: Principal,
    entries: Entry[],
    tree: PageTreeEntry[] | null,
    words: (typeof WORDS)[Locale],
  ): Promise<(page: Page, node: HtmlNode) => MacroTable | string | null> {
    const lists = new Map<string, MacroTable | string>();
    const visit = async (node: HtmlNode) => {
      if (node.type === 'issueList') {
        const attrs = node.attrs ?? {};
        const key = JSON.stringify(attrs);
        if (lists.has(key)) return;
        try {
          const result = await this.search.search(principal, {
            query: String(attrs.query ?? ''),
            limit: Math.min(100, Number(attrs.limit ?? 20)),
            offset: 0,
          });
          lists.set(
            key,
            attrs.display === 'count'
              ? words.count(result.total)
              : [
                  words.issues,
                  ...result.issues.map((issue) => [
                    issue.key,
                    issue.summary,
                    issue.status.name,
                    issue.assignee?.displayName ?? '',
                  ]),
                ],
          );
        } catch {
          lists.set(key, words.macro(words.issues[0] ?? ''));
        }
      }
      for (const child of node.content ?? []) await visit(child);
    };
    for (const entry of entries) await visit((entry.page.content ?? {}) as HtmlNode);
    return (page, node) => {
      if (node.type === 'issueList') return lists.get(JSON.stringify(node.attrs ?? {})) ?? null;
      if (node.type === 'childPages' && tree) {
        const titles = tree
          .filter((entry) => entry.parentId === page.id && entry.published)
          .map((entry) => entry.title);
        return titles.length > 0 ? `${words.macros.childPages}: ${titles.join(', ')}` : '';
      }
      if (node.type === 'embed') return String(node.attrs?.url ?? '');
      const name = words.macros[node.type ?? ''];
      return name ? words.macro(name) : null;
    };
  }

  private meta(page: Page, words: (typeof WORDS)[Locale]): { path: string; meta: string } {
    return {
      path: [page.space.name, ...page.ancestors.map((ancestor) => ancestor.title)].join(' / '),
      meta: words.meta(
        page.version,
        page.publishedBy?.displayName ?? '?',
        (page.publishedAt ?? '').slice(0, 10),
      ),
    };
  }

  private async bytes(principal: Principal, attachment: Attachment): Promise<Buffer | null> {
    if (attachment.size > INLINE_IMAGE_BYTES) return null;
    try {
      const { stream } = await this.attachments.content(principal, attachment.id);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      return Buffer.concat(chunks);
    } catch {
      return null;
    }
  }

  private async attachmentsOf(
    principal: Principal,
    entries: Entry[],
  ): Promise<Map<string, Attachment>> {
    const all = new Map<string, Attachment>();
    for (const entry of entries) {
      for (const attachment of await this.attachments.list(principal, entry.page.id)) {
        all.set(attachment.id, attachment);
      }
    }
    return all;
  }

  /** Unique archive paths for attachments: `attachments/<name>`, numbered on collisions. */
  private attachmentPaths(attachments: Map<string, Attachment>): Map<string, string> {
    const used = new Set<string>();
    const paths = new Map<string, string>();
    for (const attachment of attachments.values()) {
      const dot = attachment.fileName.lastIndexOf('.');
      const stem = dot > 0 ? attachment.fileName.slice(0, dot) : attachment.fileName;
      const extension = dot > 0 ? attachment.fileName.slice(dot) : '';
      let path = `attachments/${attachment.fileName}`;
      for (let n = 2; used.has(path.toLowerCase()); n++)
        path = `attachments/${stem}-${n}${extension}`;
      used.add(path.toLowerCase());
      paths.set(attachment.id, path);
    }
    return paths;
  }

  private html(
    entries: Entry[],
    options: {
      title: string;
      locale: Locale;
      words: (typeof WORDS)[Locale];
      macro: (page: Page, node: HtmlNode) => MacroTable | string | null;
      imageSrc: (id: string) => string | null;
      href: (from: Entry, href: string) => string;
      contents: boolean;
    },
  ): string {
    const tableHtml = (rows: MacroTable) =>
      `<table>${rows
        .map(
          (row, index) =>
            `<tr>${row.map((cell) => (index === 0 ? `<th>${escapeHtml(cell)}</th>` : `<td>${escapeHtml(cell)}</td>`)).join('')}</tr>`,
        )
        .join('')}</table>`;
    const articles = entries.map((entry, index) => {
      const { path, meta } = this.meta(entry.page, options.words);
      const body = docToHtml(
        entry.page.content,
        {
          imageSrc: options.imageSrc,
          href: (href) => options.href(entry, href),
          issueHref: (key) => (this.base ? `${this.base}/issues/${key}` : null),
          macro: (node) => {
            const resolved = options.macro(entry.page, node);
            if (resolved === null) return null;
            return Array.isArray(resolved)
              ? tableHtml(resolved)
              : `<p class="tl-macro-note">${escapeHtml(resolved)}</p>`;
          },
          macroNote: (name) => options.words.macro(options.words.macros[name] ?? name),
        },
        `p${index}-`,
      );
      return `<article id="page-${entry.page.id}"${index > 0 ? ' class="tl-break"' : ''}><p class="tl-path">${escapeHtml(path)}</p><h1>${escapeHtml(entry.page.title)}</h1><p class="tl-meta">${escapeHtml(meta)}</p>${body}</article>`;
    });
    const contents =
      options.contents && entries.length > 1
        ? `<nav class="tl-contents"><h2>${escapeHtml(options.words.contents)}</h2><ol>${entries
            .map(
              (entry) =>
                `<li style="margin-left:${(entry.depth * 1.2).toFixed(1)}em"><a href="#page-${entry.page.id}">${escapeHtml(entry.page.title)}</a></li>`,
            )
            .join('')}</ol></nav>`
        : '';
    return `<!doctype html>
<html lang="${options.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Lenipo">
<title>${escapeHtml(options.title)}</title>
<style>${EXPORT_CSS}</style>
</head>
<body>
<main>${contents}${articles.join('\n')}</main>
</body>
</html>
`;
  }

  /** Where an internal page link of `from` points to inside an archive of `entries`. */
  private archiveHref(entries: Entry[], extension: string) {
    const byId = new Map(entries.map((entry) => [entry.page.id, entry]));
    return (from: Entry, href: string): string => {
      const link = INTERNAL.exec(href);
      const target = link && byId.get(link[1]?.toLowerCase() ?? '');
      if (!target) return link && this.base ? this.base + href : href;
      return posix.relative(posix.dirname(from.path), target.path + extension) + (link?.[2] ?? '');
    };
  }

  async page(
    principal: Principal,
    id: string,
    format: PageExportFormat,
    options: { children: boolean; locale: Locale },
  ): Promise<ExportFile> {
    const root = await this.pages.get(principal, id);
    const tree = options.children ? await this.pages.tree(principal, root.space.key) : null;
    const entries = await this.collect(principal, root, tree, PAGE_LIMIT);
    const words = WORDS[options.locale];
    const macro = await this.macros(principal, entries, tree, words);
    const attachments = await this.attachmentsOf(principal, entries);
    const name = slug(root.title);

    if (format === 'markdown')
      return this.markdownZip(principal, entries, attachments, `${name}.zip`);

    // Single files carry their images.
    const images = new Map<string, Buffer>();
    for (const attachment of attachments.values()) {
      if (!attachment.image) continue;
      const data = await this.bytes(principal, attachment);
      if (data) images.set(attachment.id, data);
    }
    if (format === 'html') {
      const byId = new Map(entries.map((entry) => [entry.page.id, entry]));
      const html = this.html(entries, {
        title: root.title,
        locale: options.locale,
        words,
        macro,
        contents: true,
        imageSrc: (attachmentId) => {
          const data = images.get(attachmentId);
          const type = attachments.get(attachmentId)?.contentType;
          return data && type ? `data:${type};base64,${data.toString('base64')}` : null;
        },
        href: (_from, href) => {
          const link = INTERNAL.exec(href);
          if (link && byId.has(link[1]?.toLowerCase() ?? '')) return `#page-${link[1]}`;
          return link && this.base ? this.base + href : href;
        },
      });
      return { body: html, type: 'text/html; charset=utf-8', fileName: `${name}.html` };
    }

    const docxImages = new Map<string, DocxImage>();
    for (const [attachmentId, data] of images) {
      const size = imageSize(data);
      if (size) docxImages.set(attachmentId, { data, ...size });
    }
    const body = await toDocx(
      entries.map((entry) => ({
        title: entry.page.title,
        content: entry.page.content,
        ...this.meta(entry.page, words),
      })),
      {
        images: docxImages,
        macro: (node, index) => macro(entries[index]?.page ?? root, node),
        note: (nodeName) =>
          words.macro(words.macros[nodeName] ?? (nodeName === 'image' ? words.image : nodeName)),
        header: `${root.space.name} · ${root.title}`,
        pageWord: words.page,
        contents: entries.length > 1 ? words.contents : null,
      },
    );
    return {
      body,
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileName: `${name}.docx`,
    };
  }

  private markdownZip(
    principal: Principal,
    entries: Entry[],
    attachments: Map<string, Attachment>,
    fileName: string,
  ): ExportFile {
    // Macros stay directives, so the files can be imported again.
    const paths = this.attachmentPaths(attachments);
    const href = this.archiveHref(entries, '.md');
    const body = zipStream(async (zip) => {
      for (const entry of entries) {
        const doc = structuredClone(entry.page.content ?? { type: 'doc', content: [] }) as JsonNode;
        rewriteLinks(doc, (link) => href(entry, link));
        let markdown = docToMarkdown(doc).trim();
        markdown = markdown.replace(
          /\]\(attachment:([0-9a-f-]{36})/gi,
          (whole, attachmentId: string) => {
            const path = paths.get(attachmentId.toLowerCase());
            return path ? `](${encodeURI(posix.relative(posix.dirname(entry.path), path))}` : whole;
          },
        );
        zip.text(`${entry.path}.md`, `# ${entry.page.title}\n${markdown ? `\n${markdown}\n` : ''}`);
      }
      for (const [attachmentId, path] of paths) {
        const { stream } = await this.attachments.content(principal, attachmentId);
        await zip.stream(path, stream);
      }
    });
    return { body, type: 'application/zip', fileName };
  }

  async space(
    principal: Principal,
    key: string,
    format: SpaceExportFormat,
    options: { locale: Locale },
  ): Promise<ExportFile> {
    const space = await this.spaces.get(principal, key.toUpperCase());
    if (!space.homePageId) throw new BadRequestException('The space has no home page');
    const root = await this.pages.get(principal, space.homePageId);
    const tree = await this.pages.tree(principal, space.key);
    const entries = await this.collect(principal, root, tree, SPACE_LIMIT);
    const words = WORDS[options.locale];
    const macro = await this.macros(principal, entries, tree, words);
    const attachments = await this.attachmentsOf(principal, entries);
    const fileName = `${slug(space.key)}-${format}.zip`;
    if (format === 'markdown') return this.markdownZip(principal, entries, attachments, fileName);

    const paths = this.attachmentPaths(attachments);
    const href = this.archiveHref(entries, '.html');
    const body = zipStream(async (zip) => {
      for (const entry of entries) {
        zip.text(
          `${entry.path}.html`,
          this.html([entry], {
            title: entry.page.title,
            locale: options.locale,
            words,
            macro,
            contents: false,
            imageSrc: (attachmentId) => {
              const path = paths.get(attachmentId);
              return path ? encodeURI(posix.relative(posix.dirname(entry.path), path)) : null;
            },
            href,
          }),
        );
      }
      const list = entries
        .map(
          (entry) =>
            `<li style="margin-left:${(entry.depth * 1.2).toFixed(1)}em"><a href="${escapeHtml(encodeURI(`${entry.path}.html`))}">${escapeHtml(entry.page.title)}</a></li>`,
        )
        .join('');
      zip.text(
        'index.html',
        `<!doctype html>\n<html lang="${options.locale}"><head><meta charset="utf-8"><title>${escapeHtml(space.name)}</title><style>${EXPORT_CSS}</style></head><body><main><h1>${escapeHtml(space.name)}</h1><nav class="tl-contents"><h2>${escapeHtml(words.contents)}</h2><ol>${list}</ol></nav></main></body></html>\n`,
      );
      for (const [attachmentId, path] of paths) {
        const { stream } = await this.attachments.content(principal, attachmentId);
        await zip.stream(path, stream);
      }
    });
    return { body, type: 'application/zip', fileName };
  }
}
