import type { ChildNode, Element } from 'domhandler';
import { parseDocument } from 'htmlparser2';

/** What the converter needs to know about the imported space. */
export interface StorageContext {
  spaceKey: string;
  /** Tasklore page id for a Confluence page title, if imported. */
  pageId(title: string): string | null;
  /** Tasklore attachment id of a file on the current page. */
  attachmentId(fileName: string): string | null;
  /** Display name for a Confluence user key. */
  userName(key: string): string | null;
  /** Called for macros without a counterpart, for the import report. */
  unknownMacro(name: string): void;
}

const CALLOUTS: Record<string, string> = {
  info: 'NOTE',
  note: 'IMPORTANT',
  tip: 'TIP',
  warning: 'WARNING',
  panel: 'IMPORTANT',
};
const STATUS_COLORS = ['grey', 'blue', 'green', 'yellow', 'red', 'purple'];

const isElement = (node: ChildNode): node is Element =>
  node.type === 'tag' || node.type === 'script' || node.type === 'style';

function textOf(node: ChildNode): string {
  if (node.type === 'text') return (node as unknown as { data: string }).data;
  if (node.type === 'cdata')
    return (node as unknown as { children: ChildNode[] }).children.map(textOf).join('');
  if ('children' in node) return (node.children as ChildNode[]).map(textOf).join('');
  return '';
}

function param(macro: Element, name: string): string {
  const found = macro.children.find(
    (child) =>
      isElement(child) && child.name === 'ac:parameter' && child.attribs['ac:name'] === name,
  );
  return found ? textOf(found).trim() : '';
}

function child(element: Element, name: string): Element | undefined {
  return element.children.find((node): node is Element => isElement(node) && node.name === name);
}

const escapeInline = (text: string) => text.replace(/([\\`*_[\]])/g, '\\$1');
const quote = (text: string) => text.replace(/"/g, "'");

/**
 * Confluence storage format (XHTML with ac:/ri: elements) as Markdown with Tasklore's
 * directives (P-ADM-11, E-118): callouts, expand, toc, child pages, issue macros, status,
 * excerpts, includes, columns. Unknown macros become a visible note.
 */
export function storageToMarkdown(xhtml: string, context: StorageContext): string {
  const document = parseDocument(xhtml, {
    recognizeCDATA: true,
    recognizeSelfClosing: true,
    decodeEntities: true,
  });

  const inline = (nodes: ChildNode[]): string => nodes.map(inlineNode).join('');

  const inlineNode = (node: ChildNode): string => {
    if (node.type === 'text')
      return escapeInline((node as unknown as { data: string }).data.replace(/\s+/g, ' '));
    if (!isElement(node)) return '';
    const content = () => inline(node.children);
    switch (node.name) {
      case 'strong':
      case 'b':
        return wrap('**', content());
      case 'em':
      case 'i':
        return wrap('*', content());
      case 's':
      case 'del':
        return wrap('~~', content());
      case 'code':
        return `\`${textOf(node).replace(/`/g, '')}\``;
      case 'br':
        return '  \n';
      case 'a': {
        const href = node.attribs.href ?? '';
        const label = content() || escapeInline(href);
        return /^(https?:|mailto:)/.test(href) ? `[${label}](${href})` : label;
      }
      case 'ac:link': {
        const page = child(node, 'ri:page');
        const user = child(node, 'ri:user');
        const label = textOf(
          child(node, 'ac:plain-text-link-body') ?? child(node, 'ac:link-body') ?? node,
        ).trim();
        if (user)
          return `@${context.userName(user.attribs['ri:userkey'] ?? '') ?? (label || 'jemand')}`;
        if (page) {
          const title = page.attribs['ri:content-title'] ?? '';
          const id = context.pageId(title);
          const text = escapeInline(label || title);
          return id ? `[${text}](/spaces/${context.spaceKey}/pages/${id})` : text;
        }
        const attachment = child(node, 'ri:attachment');
        if (attachment) return escapeInline(label || attachment.attribs['ri:filename'] || '');
        return escapeInline(label);
      }
      case 'ac:emoticon':
        return node.attribs['ac:emoji-fallback'] ?? '';
      case 'ac:structured-macro':
      case 'ac:macro': {
        const name = node.attribs['ac:name'] ?? '';
        if (name === 'status') {
          const color = param(node, 'colour').toLowerCase();
          const title = param(node, 'title') || color || 'Status';
          return `:status[${title.replace(/[[\]]/g, '')}]{color=${STATUS_COLORS.includes(color) ? color : 'grey'}}`;
        }
        if (name === 'jira' && param(node, 'key')) return `:issue[${param(node, 'key')}]`;
        return '';
      }
      default:
        return content();
    }
  };

  const wrap = (mark: string, text: string) => {
    const trimmed = text.trim();
    return trimmed ? `${mark}${trimmed}${mark}` : text;
  };

  const blocks = (nodes: ChildNode[], indent = ''): string[] => {
    const out: string[] = [];
    let pending: ChildNode[] = [];
    const flush = () => {
      const text = inline(pending).trim();
      if (text) out.push(text);
      pending = [];
    };
    for (const node of nodes) {
      if (!isElement(node) || INLINE.has(node.name)) {
        if (
          isElement(node) &&
          (node.name === 'ac:structured-macro' || node.name === 'ac:macro') &&
          !INLINE_MACROS.has(node.attribs['ac:name'] ?? '')
        ) {
          flush();
          out.push(...macro(node));
          continue;
        }
        pending.push(node);
        continue;
      }
      flush();
      out.push(...block(node));
    }
    flush();
    return out.map((entry) => entry.replace(/^/gm, indent));
  };

  const list = (element: Element, ordered: boolean, depth: number): string => {
    const items: string[] = [];
    for (const item of element.children) {
      if (!isElement(item) || item.name !== 'li') continue;
      const nested = item.children.filter(
        (entry) => isElement(entry) && (entry.name === 'ul' || entry.name === 'ol'),
      ) as Element[];
      const own = item.children.filter((entry) => !nested.includes(entry as Element));
      const prefix = `${'  '.repeat(depth)}${ordered ? '1.' : '-'} `;
      items.push(prefix + blocks(own).join(' ').replace(/\n+/g, ' '));
      for (const sub of nested) items.push(list(sub, sub.name === 'ol', depth + 1));
    }
    return items.join('\n');
  };

  const block = (element: Element): string[] => {
    switch (element.name) {
      case 'p':
      case 'div':
      case 'span':
        return blocks(element.children);
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        return [`${'#'.repeat(Number(element.name[1]))} ${inline(element.children).trim()}`];
      case 'ul':
      case 'ol':
        return [list(element, element.name === 'ol', 0)];
      case 'ac:task-list':
        return [
          element.children
            .filter((entry): entry is Element => isElement(entry) && entry.name === 'ac:task')
            .map((task) => {
              const done = textOf(child(task, 'ac:task-status') ?? task).includes('complete');
              const body = child(task, 'ac:task-body');
              return `- [${done ? 'x' : ' '}] ${body ? inline(body.children).trim() : ''}`;
            })
            .join('\n'),
        ];
      case 'blockquote':
        return [blocks(element.children).join('\n\n').replace(/^/gm, '> ')];
      case 'hr':
        return ['---'];
      case 'pre':
        return [`\`\`\`\n${textOf(element).replace(/\n$/, '')}\n\`\`\``];
      case 'table':
        return [table(element)];
      case 'ac:image': {
        const attachment = child(element, 'ri:attachment');
        const url = child(element, 'ri:url');
        const alt = (element.attribs['ac:alt'] ?? '').replace(/[[\]\\]/g, '');
        if (attachment) {
          const id = context.attachmentId(attachment.attribs['ri:filename'] ?? '');
          return id
            ? [`![${alt}](attachment:${id})`]
            : [`*[Bild: ${attachment.attribs['ri:filename'] ?? ''}]*`];
        }
        return url ? [`[${alt || 'Bild'}](${url.attribs['ri:value']})`] : [];
      }
      case 'ac:layout':
      case 'ac:layout-section':
      case 'ac:layout-cell':
      case 'tbody':
        return blocks(element.children);
      default:
        return blocks(element.children);
    }
  };

  const table = (element: Element): string => {
    const rows: string[][] = [];
    let header = false;
    const visit = (node: Element) => {
      for (const entry of node.children) {
        if (!isElement(entry)) continue;
        if (entry.name === 'tr') {
          const cells = entry.children.filter(
            (cell): cell is Element =>
              isElement(cell) && (cell.name === 'td' || cell.name === 'th'),
          );
          if (rows.length === 0 && cells.every((cell) => cell.name === 'th')) header = true;
          rows.push(
            cells.map((cell) =>
              blocks(cell.children).join(' ').replace(/\n+/g, ' ').replace(/\|/g, '\\|').trim(),
            ),
          );
        } else {
          visit(entry);
        }
      }
    };
    visit(element);
    if (rows.length === 0) return '';
    const width = Math.max(...rows.map((row) => row.length));
    const pad = (row: string[]) => [...row, ...Array(width - row.length).fill('')];
    const head = header ? (rows.shift() as string[]) : Array(width).fill(' ');
    return [
      `| ${pad(head).join(' | ')} |`,
      `| ${Array(width).fill('---').join(' | ')} |`,
      ...rows.map((row) => `| ${pad(row).join(' | ')} |`),
    ].join('\n');
  };

  const body = (macroElement: Element) => {
    const rich = child(macroElement, 'ac:rich-text-body');
    return rich ? blocks(rich.children).join('\n\n') : '';
  };

  const macro = (element: Element): string[] => {
    const name = element.attribs['ac:name'] ?? '';
    const callout = CALLOUTS[name];
    if (callout) {
      const title = param(element, 'title');
      const text = [title ? `**${title}**` : '', body(element)].filter(Boolean).join('\n\n');
      return [`> [!${callout}]\n${text.replace(/^/gm, '> ')}`];
    }
    switch (name) {
      case 'code':
      case 'noformat': {
        const code = textOf(child(element, 'ac:plain-text-body') ?? element).replace(/\n$/, '');
        const language =
          name === 'code'
            ? param(element, 'language')
                .toLowerCase()
                .replace(/[^a-z0-9+#-]/g, '')
            : '';
        const fence = code.includes('```') ? '````' : '```';
        return [`${fence}${language}\n${code}\n${fence}`];
      }
      case 'expand':
        return [`:::expand ${param(element, 'title') || 'Details'}\n${body(element)}\n:::`];
      case 'toc':
        return ['::toc'];
      case 'children':
        return ['::children'];
      case 'jira': {
        const key = param(element, 'key');
        if (key) return [`:issue[${key}]`];
        const query = param(element, 'jqlQuery');
        return query ? [`::issues{query="${quote(query)}"}`] : [];
      }
      case 'excerpt':
        return [`:::excerpt\n${body(element)}\n:::`];
      case 'include':
      case 'excerpt-include': {
        const page = child(
          (element.children.find(
            (entry) => isElement(entry) && entry.name === 'ac:parameter',
          ) as Element) ?? element,
          'ac:link',
        );
        const title = page
          ? (child(page, 'ri:page')?.attribs['ri:content-title'] ?? '')
          : param(element, '');
        const id = context.pageId(title);
        if (!id) return [`*[${name === 'include' ? 'Eingebundene Seite' : 'Auszug'}: ${title}]*`];
        return [name === 'include' ? `::include{page="${id}"}` : `::excerpt-include{page="${id}"}`];
      }
      case 'section': {
        const columns = element.children.length
          ? (child(element, 'ac:rich-text-body')?.children ?? []).filter(
              (entry): entry is Element =>
                isElement(entry) &&
                entry.name === 'ac:structured-macro' &&
                entry.attribs['ac:name'] === 'column',
            )
          : [];
        if (columns.length < 2 || columns.length > 3) return [body(element)];
        return [
          `:::columns{layout=${columns.length === 3 ? '1-1-1' : '1-1'}}\n${columns
            .map((column) => `:::column\n${body(column)}\n:::`)
            .join('\n')}\n:::`,
        ];
      }
      case 'column':
        return [body(element)];
      case 'attachments':
        return ['::attachments'];
      case 'view-file': {
        const attachment = element.children
          .map((entry) => (isElement(entry) ? child(entry, 'ri:attachment') : undefined))
          .find(Boolean);
        return [`*[Datei: ${attachment?.attribs['ri:filename'] ?? ''}]*`];
      }
      default:
        context.unknownMacro(name);
        return [
          `*[Makro „${name}“ aus Confluence nicht übernommen]*`,
          ...(child(element, 'ac:rich-text-body') ? [body(element)] : []),
        ];
    }
  };

  return blocks(document.children)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const INLINE = new Set([
  'strong',
  'b',
  'em',
  'i',
  's',
  'del',
  'code',
  'br',
  'a',
  'ac:link',
  'ac:emoticon',
  'u',
  'sup',
  'sub',
  'ac:structured-macro',
  'ac:macro',
  'time',
]);
/** Macros that sit inside running text. */
const INLINE_MACROS = new Set(['status']);
