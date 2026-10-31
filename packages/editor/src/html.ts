/**
 * Stored rich text as HTML without a DOM, for exports (W-EXP-03, E-111). Everything from the
 * document is escaped; links keep only safe addresses. Macros that need data the converter
 * does not have (issue lists, reports, child pages) are filled in by the caller or shown as a
 * short note.
 */

export interface HtmlNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: HtmlNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export interface HtmlOptions {
  /** The address of an image attachment, or null to show its alternative text instead. */
  imageSrc?: (attachmentId: string) => string | null;
  /** Where a link inside the instance points to, e.g. another exported page. */
  href?: (href: string) => string;
  /** The address of an issue, if keys should be links. */
  issueHref?: (key: string) => string | null;
  /** HTML for a macro the converter cannot show itself; null falls back to a note. */
  macro?: (node: HtmlNode) => string | null;
  /** Text of the fallback note for a macro, by node name. */
  macroNote?: (name: string) => string;
}

export interface Heading {
  level: number;
  text: string;
  id: string;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SAFE_HREF = /^(https?:|mailto:|\/(?!\/)|#|\.{0,2}\/|[^:]*$)/i;

/** Text of a node and its descendants. */
export function nodeText(node: HtmlNode): string {
  if (node.text) return node.text;
  return (node.content ?? []).map(nodeText).join('');
}

function slugOf(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'abschnitt'
  );
}

/** The headings of a document with ids that are unique within it, in document order. */
export function documentHeadings(doc: unknown, prefix = ''): Heading[] {
  const headings: Heading[] = [];
  const used = new Map<string, number>();
  const visit = (node: HtmlNode) => {
    if (node.type === 'heading') {
      const text = nodeText(node).trim();
      const base = prefix + slugOf(text);
      const seen = used.get(base) ?? 0;
      used.set(base, seen + 1);
      headings.push({
        level: Number(node.attrs?.level ?? 1),
        text,
        id: seen ? `${base}-${seen + 1}` : base,
      });
      return;
    }
    for (const child of node.content ?? []) visit(child);
  };
  if (doc && typeof doc === 'object') visit(doc as HtmlNode);
  return headings;
}

function attr(name: string, value: unknown): string {
  return value === null || value === undefined || value === ''
    ? ''
    : ` ${name}="${escapeHtml(String(value))}"`;
}

export function docToHtml(doc: unknown, options: HtmlOptions = {}, headingPrefix = ''): string {
  if (!doc || typeof doc !== 'object') return '';
  const headings = documentHeadings(doc, headingPrefix);
  let headingIndex = 0;
  const note = (name: string) =>
    `<p class="tl-macro-note">${escapeHtml(options.macroNote?.(name) ?? name)}</p>`;

  const marked = (node: HtmlNode): string => {
    let html = escapeHtml(node.text ?? '');
    for (const mark of node.marks ?? []) {
      switch (mark.type) {
        case 'bold':
          html = `<strong>${html}</strong>`;
          break;
        case 'italic':
          html = `<em>${html}</em>`;
          break;
        case 'strike':
          html = `<s>${html}</s>`;
          break;
        case 'underline':
          html = `<u>${html}</u>`;
          break;
        case 'code':
          html = `<code>${html}</code>`;
          break;
        case 'link': {
          const raw = String(mark.attrs?.href ?? '');
          const href = SAFE_HREF.test(raw) ? (options.href?.(raw) ?? raw) : '';
          html = href ? `<a href="${escapeHtml(href)}">${html}</a>` : html;
          break;
        }
      }
    }
    return html;
  };

  const children = (node: HtmlNode) => (node.content ?? []).map(render).join('');

  const render = (node: HtmlNode): string => {
    const a = node.attrs ?? {};
    switch (node.type) {
      case 'doc':
        return children(node);
      case 'text':
        return marked(node);
      case 'paragraph':
        return `<p>${children(node)}</p>`;
      case 'heading': {
        const level = Math.min(6, Math.max(1, Number(a.level ?? 1)));
        const id = headings[headingIndex++]?.id ?? '';
        return `<h${level}${attr('id', id)}>${children(node)}</h${level}>`;
      }
      case 'hardBreak':
        return '<br>';
      case 'horizontalRule':
        return '<hr>';
      case 'blockquote':
        return `<blockquote>${children(node)}</blockquote>`;
      case 'bulletList':
        return `<ul>${children(node)}</ul>`;
      case 'orderedList':
        return `<ol${Number(a.start ?? 1) !== 1 ? attr('start', a.start) : ''}>${children(node)}</ol>`;
      case 'listItem':
        return `<li>${children(node)}</li>`;
      case 'taskList':
        return `<ul class="tl-tasks">${children(node)}</ul>`;
      case 'taskItem':
        return `<li><input type="checkbox" disabled${a.checked ? ' checked' : ''}> ${children(node)}</li>`;
      case 'codeBlock':
        return `<figure class="tl-code">${a.title ? `<figcaption>${escapeHtml(String(a.title))}</figcaption>` : ''}<pre><code${attr('data-language', a.language)}>${escapeHtml(nodeText(node))}</code></pre></figure>`;
      case 'table':
        return `<table>${children(node)}</table>`;
      case 'tableRow':
        return `<tr>${children(node)}</tr>`;
      case 'tableHeader':
      case 'tableCell': {
        const tag = node.type === 'tableHeader' ? 'th' : 'td';
        const span = (name: string, value: unknown) =>
          Number(value ?? 1) > 1 ? attr(name, value) : '';
        return `<${tag}${span('colspan', a.colspan)}${span('rowspan', a.rowspan)}>${children(node)}</${tag}>`;
      }
      case 'image': {
        const src = options.imageSrc?.(String(a.attachmentId ?? ''));
        const alt = String(a.alt ?? '');
        const style = a.width ? ` style="width:${Number(a.width)}%"` : '';
        const body = src
          ? `<img src="${escapeHtml(src)}"${attr('alt', alt)}${style}>`
          : `<span class="tl-macro-note">${escapeHtml(alt || 'Bild')}</span>`;
        const caption = a.caption
          ? `<figcaption>${escapeHtml(String(a.caption))}</figcaption>`
          : '';
        return `<figure class="tl-image"${attr('data-align', a.align)}>${body}${caption}</figure>`;
      }
      case 'mention':
        return `<span class="tl-mention">@${escapeHtml(String(a.label ?? a.id ?? ''))}</span>`;
      case 'status':
        return `<span class="tl-status"${attr('data-color', a.color)}>${escapeHtml(String(a.text ?? ''))}</span>`;
      case 'issue': {
        const key = String(a.key ?? '');
        const href = options.issueHref?.(key);
        return href
          ? `<a class="tl-issue" href="${escapeHtml(href)}">${escapeHtml(key)}</a>`
          : `<span class="tl-issue">${escapeHtml(key)}</span>`;
      }
      case 'panel':
        return `<aside class="tl-panel"${attr('data-kind', a.kind)}>${children(node)}</aside>`;
      case 'expand':
        return `<details open><summary>${escapeHtml(String(a.title ?? ''))}</summary>${children(node)}</details>`;
      case 'columns':
        return `<div class="tl-columns"${attr('data-columns', a.layout)}>${children(node)}</div>`;
      case 'column':
        return `<div class="tl-column">${children(node)}</div>`;
      case 'section':
        return `<section class="tl-section"${attr('data-tone', a.tone)}>${children(node)}</section>`;
      case 'excerpt':
        return `<div class="tl-excerpt">${children(node)}</div>`;
      case 'pageProperties':
        return `<div class="tl-properties">${children(node)}</div>`;
      case 'chart':
        return `<figure class="tl-chart">${a.title ? `<figcaption>${escapeHtml(String(a.title))}</figcaption>` : ''}${children(node)}</figure>`;
      case 'placeholder':
        return '';
      case 'tableOfContents': {
        const max = Number(a.maxLevel ?? 3);
        const items = headings
          .filter((heading) => heading.level <= max)
          .map(
            (heading) =>
              `<li class="tl-toc-${heading.level}"><a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.text)}</a></li>`,
          )
          .join('');
        return items ? `<nav class="tl-toc"><ul>${items}</ul></nav>` : '';
      }
      default: {
        const custom = options.macro?.(node);
        if (custom !== null && custom !== undefined) return custom;
        if (node.content) return children(node);
        return node.type ? note(node.type) : '';
      }
    }
  };
  return render(doc as HtmlNode);
}
