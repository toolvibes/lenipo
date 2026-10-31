import type { Node as PMNode } from '@tiptap/pm/model';
import MarkdownIt from 'markdown-it';
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs';
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';
import {
  defaultMarkdownSerializer,
  MarkdownParser,
  MarkdownSerializer,
  type MarkdownSerializerState,
} from 'prosemirror-markdown';
import {
  CONTAINER_MACROS,
  LEAF_MACRO_NAMES,
  LEAF_MACROS,
  type LeafMacroName,
} from './layout-macros.js';
import { richTextSchema } from './schema.js';

/** A rich text document as stored: ProseMirror JSON of {@link richTextSchema}. */
export interface RichTextDoc {
  type: 'doc';
  content?: unknown[];
}

// ---------------------------------------------------------------- Markdown → document

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const MENTION = new RegExp(`^@\\[((?:[^\\]\\\\\\n]|\\\\.)*)\\]\\(user:(${UUID})\\)`, 'i');
const EMAIL_MENTION = /^@([A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/;

/**
 * `@[Name](user:<uuid>)` and `@person@example.org` become mention tokens (E-51). An e-mail
 * mention has no id yet; the API resolves it or turns it back into text.
 */
function mentionRule(state: StateInline, silent: boolean): boolean {
  if (state.src.charCodeAt(state.pos) !== 0x40 /* @ */) return false;
  const before = state.pos > 0 ? state.src[state.pos - 1] : '';
  if (before && /[\p{L}\p{N}_]/u.test(before)) return false;
  const rest = state.src.slice(state.pos);
  const full = MENTION.exec(rest);
  const email = full ? null : EMAIL_MENTION.exec(rest);
  const match = full ?? email;
  if (!match) return false;
  if (!silent) {
    const token = state.push('mention', '', 0);
    token.meta = full
      ? {
          id: (full[2] as string).toLowerCase(),
          label: (full[1] as string).replace(/\\(.)/g, '$1'),
        }
      : { id: null, label: email?.[1] };
  }
  state.pos += match[0].length;
  return true;
}

const IMAGE = new RegExp(
  `^!\\[((?:[^\\]\\\\\\n]|\\\\.)*)\\]\\(attachment:(${UUID})(?:\\s+"((?:[^"\\\\\\n]|\\\\.)*)")?\\)\\s*$`,
  'i',
);
const unescapeMarkdown = (text: string) => text.replace(/\\(.)/g, '$1');

/** A line `![alt](attachment:<uuid> "caption")` is an image of a page attachment (E-61). */
function attachmentImageRule(
  state: StateBlock,
  startLine: number,
  _endLine: number,
  silent: boolean,
): boolean {
  const start = (state.bMarks[startLine] as number) + (state.tShift[startLine] as number);
  const line = state.src.slice(start, state.eMarks[startLine]);
  const match = IMAGE.exec(line);
  if (!match) return false;
  if (silent) return true;
  const token = state.push('attachment_image', '', 0);
  token.map = [startLine, startLine + 1];
  token.meta = {
    attachmentId: (match[2] as string).toLowerCase(),
    alt: match[1] ? unescapeMarkdown(match[1]) : null,
    caption: match[3] ? unescapeMarkdown(match[3]) : '',
  };
  state.line = startLine + 1;
  return true;
}

const TASK = /^\[([ xX])\] /;

/**
 * Before inline parsing: bullet lists whose items all start with `[ ]` or `[x]` become task
 * lists, and table cells get a paragraph, since cells hold blocks in the editor (E-61).
 */
function blockShapes(state: StateCore): void {
  const tokens = state.tokens;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index] as (typeof tokens)[number];
    if (token.type === 'th_open' || token.type === 'td_open') {
      const Token = state.Token;
      tokens.splice(index + 1, 0, new Token('paragraph_open', 'p', 1));
      tokens.splice(index + 3, 0, new Token('paragraph_close', 'p', -1));
      index += 3;
      continue;
    }
    if (token.type !== 'bullet_list_open') continue;
    let depth = 0;
    const items: number[] = [];
    let close = index;
    for (let cursor = index; cursor < tokens.length; cursor++) {
      const current = tokens[cursor] as (typeof tokens)[number];
      if (current.type === 'bullet_list_open' || current.type === 'ordered_list_open') depth++;
      if (current.type === 'bullet_list_close' || current.type === 'ordered_list_close') depth--;
      if (current.type === 'list_item_open' && depth === 1) items.push(cursor);
      if (depth === 0) {
        close = cursor;
        break;
      }
    }
    const firstInline = (item: number) =>
      tokens[item + 1]?.type === 'paragraph_open' ? tokens[item + 2] : undefined;
    const tasks =
      items.length > 0 && items.every((item) => TASK.test(firstInline(item)?.content ?? ''));
    if (!tasks) continue;
    token.type = 'task_list_open';
    (tokens[close] as (typeof tokens)[number]).type = 'task_list_close';
    for (const item of items) {
      const inline = firstInline(item) as (typeof tokens)[number];
      const open = tokens[item] as (typeof tokens)[number];
      open.type = 'task_item_open';
      open.meta = { checked: (TASK.exec(inline.content)?.[1] ?? ' ') !== ' ' };
      inline.content = inline.content.replace(TASK, '');
      let depthAt = 0;
      for (let cursor = item; cursor < tokens.length; cursor++) {
        const current = tokens[cursor] as (typeof tokens)[number];
        if (current.type === 'list_item_open' || current.type === 'task_item_open') depthAt++;
        if (current.type === 'list_item_close') {
          depthAt--;
          if (depthAt === 0) {
            current.type = 'task_item_close';
            break;
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------- macros (E-66)

/** `key=value key="quoted value" flag` as found in directive braces and fence info strings. */
export function parseDirectiveAttrs(text: string): Record<string, string | true> {
  const attrs: Record<string, string | true> = {};
  const pattern = /([A-Za-z][\w-]*)(?:=(?:"((?:[^"\\]|\\.)*)"|([^\s"}]+)))?/g;
  for (const match of text.matchAll(pattern)) {
    const [, name, quoted, plain] = match as unknown as [string, string, string?, string?];
    attrs[name] = quoted !== undefined ? quoted.replace(/\\(.)/g, '$1') : (plain ?? true);
  }
  return attrs;
}

const quoteAttr = (value: string) => `"${value.replace(/[\\"]/g, (char) => `\\${char}`)}"`;
const intAttr = (value: string | true | undefined, fallback: number) => {
  const number = typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isInteger(number) ? number : fallback;
};

const ALERTS: Record<string, string> = {
  NOTE: 'info',
  TIP: 'success',
  IMPORTANT: 'note',
  WARNING: 'warning',
  CAUTION: 'warning',
};
const ALERT_OF: Record<string, string> = {
  info: 'NOTE',
  success: 'TIP',
  note: 'IMPORTANT',
  warning: 'WARNING',
};
const ALERT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\n|$)/i;

/** GitHub alerts (`> [!NOTE]` …) become info boxes. */
function alertPanels(state: StateCore): void {
  const tokens = state.tokens;
  for (let index = 0; index < tokens.length; index++) {
    const open = tokens[index] as (typeof tokens)[number];
    const inline = tokens[index + 2];
    if (open.type !== 'blockquote_open' || tokens[index + 1]?.type !== 'paragraph_open') continue;
    const match = inline ? ALERT.exec(inline.content) : null;
    if (!inline || !match) continue;
    const close = tokens.findIndex(
      (token, at) => at > index && token.type === 'blockquote_close' && token.level === open.level,
    );
    if (close === -1) continue;
    open.type = 'panel_open';
    open.meta = { kind: ALERTS[(match[1] as string).toUpperCase()] };
    (tokens[close] as (typeof tokens)[number]).type = 'panel_close';
    inline.content = inline.content.slice(match[0].length);
    // A marker on its own line leaves an empty paragraph, unless it is all there is.
    if (!inline.content.trim() && tokens[index + 4]?.type !== 'panel_close') {
      tokens.splice(index + 1, 3);
    }
  }
}

const EXPAND =
  /^:::(expand|columns|column|section|excerpt|properties|chart)(?:\{([^}]*)\}|[ \t]+(.*))?$/;
const ANY_CONTAINER = /^:::[a-z]/;

/** The node and attributes of a container directive (E-66, TL-26). */
function containerOf(name: string, braces: string | undefined, rest: string | undefined) {
  const attrs = parseDirectiveAttrs(braces ?? '');
  const text = (value: string | true | undefined, fallback: string) =>
    typeof value === 'string' ? value : fallback;
  switch (name) {
    case 'expand':
      return { type: 'expand', attrs: { title: (rest ?? '').trim() } };
    case 'columns':
      return { type: 'columns', attrs: { layout: text(attrs.layout, '1-1') } };
    case 'section':
      return { type: 'section', attrs: { tone: text(attrs.tone, 'grey') } };
    case 'excerpt':
      return { type: 'excerpt', attrs: { name: text(attrs.name, '') } };
    case 'properties':
      return { type: 'pageProperties', attrs: {} };
    case 'chart':
      return {
        type: 'chart',
        attrs: { type: text(attrs.type, 'bar'), title: text(attrs.title, '') },
      };
    default:
      return { type: 'column', attrs: {} };
  }
}

/** `:::expand Title`, `:::columns{layout=1-2}` and other containers … `:::` around Markdown. */
function expandRule(state: StateBlock, startLine: number, endLine: number, silent: boolean) {
  const lineText = (line: number) =>
    state.src.slice(
      (state.bMarks[line] as number) + (state.tShift[line] as number),
      state.eMarks[line],
    );
  const match = EXPAND.exec(lineText(startLine).trimEnd());
  if (!match) return false;
  if (silent) return true;
  let next = startLine + 1;
  let depth = 1;
  for (; next < endLine; next++) {
    const text = lineText(next).trim();
    if (ANY_CONTAINER.test(text)) depth++;
    else if (text === ':::' && --depth === 0) break;
  }
  const lineMax = state.lineMax;
  state.lineMax = next;
  const container = containerOf(match[1] as string, match[2], match[3]);
  const open = state.push(`${container.type}_open`, 'div', 1);
  open.meta = container.attrs;
  open.map = [startLine, next];
  state.md.block.tokenize(state, startLine + 1, next);
  state.push(`${container.type}_close`, 'div', -1);
  state.lineMax = lineMax;
  state.line = Math.min(next + 1, endLine);
  return true;
}

const LEAF = new RegExp(
  `^::(toc|children|issues|report|${LEAF_MACRO_NAMES.map((name) => LEAF_MACROS[name].directive).join('|')})(?:\\{(.*)\\})?[ \\t]*$`,
);
const LEAF_BY_DIRECTIVE = new Map(
  LEAF_MACRO_NAMES.map((name) => [LEAF_MACROS[name].directive as string, name]),
);

/** Attributes of a leaf macro, typed by their defaults. */
function leafAttrs(name: LeafMacroName, attrs: Record<string, string | true>) {
  return Object.fromEntries(
    Object.entries(LEAF_MACROS[name].attrs).map(([key, fallback]) => {
      const value = attrs[key];
      if (typeof fallback === 'number') return [key, intAttr(value, fallback)];
      if (typeof fallback === 'boolean') return [key, value === true || value === 'true'];
      return [key, typeof value === 'string' ? value : fallback];
    }),
  );
}

/** `::toc`, `::children` and `::issues{query="…"}` on a line of their own. */
function leafDirectiveRule(
  state: StateBlock,
  startLine: number,
  _endLine: number,
  silent: boolean,
): boolean {
  const start = (state.bMarks[startLine] as number) + (state.tShift[startLine] as number);
  const match = LEAF.exec(state.src.slice(start, state.eMarks[startLine]));
  if (!match) return false;
  if (silent) return true;
  const attrs = parseDirectiveAttrs(match[2] ?? '');
  const token = state.push('macro_leaf', '', 0);
  token.map = [startLine, startLine + 1];
  token.type = `macro_${match[1]}`;
  const leafName = LEAF_BY_DIRECTIVE.get(match[1] as string);
  token.meta = leafName
    ? { type: leafName, attrs: leafAttrs(leafName, attrs) }
    : match[1] === 'toc'
      ? { type: 'tableOfContents', attrs: { maxLevel: intAttr(attrs.maxLevel, 3) } }
      : match[1] === 'children'
        ? { type: 'childPages', attrs: { depth: intAttr(attrs.depth, 1) } }
        : match[1] === 'report'
          ? {
              type: 'report',
              attrs: {
                kind: typeof attrs.kind === 'string' ? attrs.kind : 'cfd',
                query: typeof attrs.query === 'string' ? attrs.query : '',
                field: typeof attrs.field === 'string' ? attrs.field : '',
                days: intAttr(attrs.days, 30),
                boardId: typeof attrs.board === 'string' ? attrs.board : '',
              },
            }
          : {
              type: 'issueList',
              attrs: {
                query: typeof attrs.query === 'string' ? attrs.query : '',
                display: attrs.display === 'count' ? 'count' : 'table',
                limit: intAttr(attrs.limit, 20),
              },
            };
  state.line = startLine + 1;
  return true;
}

const STATUS = /^:status\[((?:[^\]\\\n]|\\.)*)\](?:\{([^}\n]*)\})?/;
const ISSUE = /^:issue\[([A-Z][A-Z0-9]{1,9}-[1-9][0-9]*)\]/;

/** `:status[Done]{color=green}` and `:issue[WEB-1]` in running text. */
function inlineMacroRule(state: StateInline, silent: boolean): boolean {
  if (state.src.charCodeAt(state.pos) !== 0x3a /* : */) return false;
  const before = state.pos > 0 ? state.src[state.pos - 1] : '';
  if (before && /[\p{L}\p{N}_]/u.test(before)) return false;
  const rest = state.src.slice(state.pos);
  const status = STATUS.exec(rest);
  const issue = status ? null : ISSUE.exec(rest);
  const match = status ?? issue;
  if (!match) return false;
  if (!silent) {
    const token = state.push(status ? 'macro_status' : 'macro_issue', '', 0);
    token.meta = status
      ? {
          type: 'status',
          attrs: {
            text: (status[1] as string).replace(/\\(.)/g, '$1'),
            color: parseDirectiveAttrs(status[2] ?? '').color ?? 'grey',
          },
        }
      : { type: 'issue', attrs: { key: issue?.[1] } };
  }
  state.pos += match[0].length;
  return true;
}

/** `ts title="Datei" lineNumbers collapsed` after a fence. */
function fenceAttrs(info: string) {
  const first = info.trim().split(/\s+/)[0] ?? '';
  const hasLanguage = first !== '' && !first.includes('=');
  const attrs = parseDirectiveAttrs(hasLanguage ? info.trim().slice(first.length) : info);
  return {
    language: hasLanguage ? first : null,
    title: typeof attrs.title === 'string' ? attrs.title : null,
    lineNumbers: attrs.lineNumbers === true,
    collapsed: attrs.collapsed === true,
  };
}

// Raw HTML stays text; images only as attachments of their own line (E-61).
const markdownIt = new MarkdownIt('default', { html: false, linkify: false }).disable(['image']);
markdownIt.inline.ruler.before('link', 'mention', mentionRule);
markdownIt.block.ruler.before('paragraph', 'attachment_image', attachmentImageRule);
markdownIt.core.ruler.after('block', 'block_shapes', blockShapes);
markdownIt.core.ruler.after('block_shapes', 'alert_panels', alertPanels);
markdownIt.block.ruler.before('fence', 'expand', expandRule, {
  alt: ['paragraph', 'reference', 'blockquote', 'list'],
});
markdownIt.block.ruler.before('paragraph', 'macro_leaf', leafDirectiveRule);
markdownIt.inline.ruler.before('link', 'macro_inline', inlineMacroRule);

const parser = new MarkdownParser(richTextSchema, markdownIt, {
  blockquote: { block: 'blockquote' },
  paragraph: { block: 'paragraph' },
  list_item: { block: 'listItem' },
  bullet_list: { block: 'bulletList' },
  ordered_list: {
    block: 'orderedList',
    getAttrs: (token) => ({ start: Number(token.attrGet('start') ?? 1) }),
  },
  heading: { block: 'heading', getAttrs: (token) => ({ level: Number(token.tag.slice(1)) }) },
  code_block: { block: 'codeBlock', noCloseToken: true },
  fence: { block: 'codeBlock', getAttrs: (token) => fenceAttrs(token.info), noCloseToken: true },
  panel: { block: 'panel', getAttrs: (token) => token.meta },
  expand: { block: 'expand', getAttrs: (token) => token.meta },
  columns: { block: 'columns', getAttrs: (token) => token.meta },
  column: { block: 'column' },
  section: { block: 'section', getAttrs: (token) => token.meta },
  excerpt: { block: 'excerpt', getAttrs: (token) => token.meta },
  pageProperties: { block: 'pageProperties' },
  chart: { block: 'chart', getAttrs: (token) => token.meta },
  ...Object.fromEntries(
    LEAF_MACRO_NAMES.map((name) => [
      `macro_${LEAF_MACROS[name].directive}`,
      {
        node: name,
        getAttrs: (token: { meta: { attrs: unknown } }) => token.meta.attrs,
        noCloseToken: true,
      },
    ]),
  ),
  hr: { node: 'horizontalRule' },
  hardbreak: { node: 'hardBreak' },
  em: { mark: 'italic' },
  strong: { mark: 'bold' },
  s: { mark: 'strike' },
  link: {
    mark: 'link',
    getAttrs: (token) => ({ href: token.attrGet('href'), title: token.attrGet('title') || null }),
  },
  code_inline: { mark: 'code', noCloseToken: true },
  mention: {
    node: 'mention',
    getAttrs: (token) => ({ id: token.meta.id, label: token.meta.label }),
    noCloseToken: true,
  },
  attachment_image: { node: 'image', getAttrs: (token) => token.meta, noCloseToken: true },
  macro_toc: { node: 'tableOfContents', getAttrs: (token) => token.meta.attrs, noCloseToken: true },
  macro_children: { node: 'childPages', getAttrs: (token) => token.meta.attrs, noCloseToken: true },
  macro_issues: { node: 'issueList', getAttrs: (token) => token.meta.attrs, noCloseToken: true },
  macro_report: { node: 'report', getAttrs: (token) => token.meta.attrs, noCloseToken: true },
  macro_status: { node: 'status', getAttrs: (token) => token.meta.attrs, noCloseToken: true },
  macro_issue: { node: 'issue', getAttrs: (token) => token.meta.attrs, noCloseToken: true },
  task_list: { block: 'taskList' },
  task_item: { block: 'taskItem', getAttrs: (token) => ({ checked: token.meta.checked }) },
  table: { block: 'table' },
  thead: { ignore: true },
  tbody: { ignore: true },
  tr: { block: 'tableRow' },
  th: { block: 'tableHeader' },
  td: { block: 'tableCell' },
});

/** Markdown (CommonMark plus strikethrough and mentions) as a stored document. */
export function markdownToDoc(markdown: string): RichTextDoc {
  return parser.parse(markdown).toJSON() as RichTextDoc;
}

// ---------------------------------------------------------------- document → Markdown

/** A rule of prosemirror-markdown's default serializer, renamed to TipTap's node names below. */
function standard<T>(rules: Record<string, T>, name: string): T {
  const rule = rules[name];
  if (!rule) throw new Error(`prosemirror-markdown has no rule "${name}"`);
  return rule;
}
const node = (name: string) => standard(defaultMarkdownSerializer.nodes, name);
const mark = (name: string) => standard(defaultMarkdownSerializer.marks, name);

const serializer = new MarkdownSerializer(
  {
    paragraph: node('paragraph'),
    blockquote: node('blockquote'),
    heading: node('heading'),
    horizontalRule: node('horizontal_rule'),
    listItem: node('list_item'),
    hardBreak: node('hard_break'),
    text: node('text'),
    bulletList: (state, node) => state.renderList(node, '  ', () => '- '),
    orderedList: (state, node) => {
      const start = (node.attrs.start as number | null) ?? 1;
      const width = String(start + node.childCount - 1).length;
      state.renderList(node, state.repeat(' ', width + 2), (index) => {
        const number = String(start + index);
        return `${state.repeat(' ', width - number.length)}${number}. `;
      });
    },
    codeBlock: (state: MarkdownSerializerState, block: PMNode) => {
      // A fence longer than any backtick run inside keeps the code intact.
      const runs = block.textContent.match(/`{3,}/g) ?? [];
      const fence = runs.length > 0 ? `${runs.sort().at(-1)}\`` : '```';
      const info = [
        (block.attrs.language as string | null) ?? '',
        block.attrs.title ? `title=${quoteAttr(String(block.attrs.title))}` : '',
        block.attrs.lineNumbers ? 'lineNumbers' : '',
        block.attrs.collapsed ? 'collapsed' : '',
      ]
        .filter(Boolean)
        .join(' ');
      state.write(`${fence}${info}\n`);
      state.text(block.textContent, false);
      state.ensureNewLine();
      state.write(fence);
      state.closeBlock(block);
    },
    mention: (state, mention) => {
      const label = String(mention.attrs.label ?? '').replace(/[\\\]]/g, (char) => `\\${char}`);
      state.write(`@[${label}](user:${mention.attrs.id})`);
    },
    image: (state, image) => {
      const alt = String(image.attrs.alt ?? '').replace(/[\\\]\n]/g, escapeChar);
      const caption = String(image.attrs.caption ?? '').replace(/[\\"\n]/g, escapeChar);
      state.write(
        `![${alt}](attachment:${image.attrs.attachmentId}${caption ? ` "${caption}"` : ''})`,
      );
      state.closeBlock(image);
    },
    taskList: (state, node) => state.renderList(node, '  ', () => '- '),
    panel: (state, node) => {
      state.wrapBlock('> ', null, node, () => {
        state.write(`[!${ALERT_OF[node.attrs.kind as string] ?? 'NOTE'}]`);
        state.ensureNewLine();
        state.renderContent(node);
      });
    },
    ...Object.fromEntries(
      (
        [
          [
            'columns',
            (node: { attrs: Record<string, unknown> }) => `{layout=${node.attrs.layout}}`,
          ],
          ['column', () => ''],
          ['section', (node: { attrs: Record<string, unknown> }) => `{tone=${node.attrs.tone}}`],
          [
            'excerpt',
            (node: { attrs: Record<string, unknown> }) =>
              node.attrs.name ? `{name=${quoteAttr(String(node.attrs.name))}}` : '',
          ],
          ['pageProperties', () => ''],
          [
            'chart',
            (node: { attrs: Record<string, unknown> }) =>
              `{type=${node.attrs.type}${node.attrs.title ? ` title=${quoteAttr(String(node.attrs.title))}` : ''}}`,
          ],
        ] as const
      ).map(([name, attrs]) => [
        name,
        (state: MarkdownSerializerState, node: PMNode) => {
          state.write(`:::${CONTAINER_MACROS[name]}${attrs(node)}`);
          state.ensureNewLine();
          state.renderContent(node);
          state.write(':::');
          state.closeBlock(node);
        },
      ]),
    ),
    ...Object.fromEntries(
      LEAF_MACRO_NAMES.map((name) => [
        name,
        (state: MarkdownSerializerState, node: PMNode) => {
          const parts = Object.entries(LEAF_MACROS[name].attrs).flatMap(([key, fallback]) => {
            const value = node.attrs[key];
            if (value === fallback || value === undefined) return [];
            if (typeof value === 'boolean') return value ? [key] : [];
            return [`${key}=${typeof value === 'number' ? value : quoteAttr(String(value))}`];
          });
          state.write(
            `::${LEAF_MACROS[name].directive}${parts.length > 0 ? `{${parts.join(' ')}}` : ''}`,
          );
          state.closeBlock(node);
        },
      ]),
    ),
    expand: (state, node) => {
      state.write(`:::expand ${String(node.attrs.title ?? '').replace(/\s+/g, ' ')}`.trimEnd());
      state.ensureNewLine();
      state.renderContent(node);
      state.write(':::');
      state.closeBlock(node);
    },
    tableOfContents: (state, node) => {
      const level = node.attrs.maxLevel as number;
      state.write(level === 3 ? '::toc' : `::toc{maxLevel=${level}}`);
      state.closeBlock(node);
    },
    childPages: (state, node) => {
      const depth = node.attrs.depth as number;
      state.write(depth === 1 ? '::children' : `::children{depth=${depth}}`);
      state.closeBlock(node);
    },
    issueList: (state, node) => {
      const attrs = [`query=${quoteAttr(String(node.attrs.query ?? ''))}`];
      if (node.attrs.display === 'count') attrs.push('display=count');
      if (node.attrs.limit !== 20) attrs.push(`limit=${node.attrs.limit}`);
      state.write(`::issues{${attrs.join(' ')}}`);
      state.closeBlock(node);
    },
    report: (state, node) => {
      const attrs = [`kind=${node.attrs.kind}`];
      if (node.attrs.query) attrs.push(`query=${quoteAttr(String(node.attrs.query))}`);
      if (node.attrs.field) attrs.push(`field=${node.attrs.field}`);
      if (node.attrs.days !== 30) attrs.push(`days=${node.attrs.days}`);
      if (node.attrs.boardId) attrs.push(`board=${node.attrs.boardId}`);
      state.write(`::report{${attrs.join(' ')}}`);
      state.closeBlock(node);
    },
    status: (state, node) => {
      const text = String(node.attrs.text ?? '').replace(/[\\\]]/g, (char) => `\\${char}`);
      state.write(`:status[${text}]{color=${node.attrs.color}}`);
    },
    issue: (state, node) => {
      if (node.attrs.key) state.write(`:issue[${node.attrs.key}]`);
    },
    taskItem: (state, node) => {
      state.write(node.attrs.checked ? '[x] ' : '[ ] ');
      state.renderContent(node);
    },
    table: (state, table) => {
      // GFM tables hold one line of inline text per cell; the first row is the header.
      const rows: string[][] = [];
      table.forEach((row) => {
        const cells: string[] = [];
        row.forEach((cell) => {
          cells.push(cellMarkdown(cell));
        });
        rows.push(cells);
      });
      const width = Math.max(1, ...rows.map((row) => row.length));
      const line = (cells: string[]) =>
        `| ${Array.from({ length: width }, (_, index) => cells[index] ?? '').join(' | ')} |`;
      rows.forEach((cells, index) => {
        state.write(line(cells));
        state.ensureNewLine();
        if (index === 0) {
          state.write(`|${' --- |'.repeat(width)}`);
          state.ensureNewLine();
        }
      });
      state.closeBlock(table);
    },
    tableRow: () => {},
    tableHeader: () => {},
    tableCell: () => {},
  },
  {
    italic: mark('em'),
    bold: mark('strong'),
    code: mark('code'),
    link: mark('link'),
    strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
    // Markdown has no underline; the text stays, the underline is lost.
    underline: { open: '', close: '' },
  },
);

function escapeChar(char: string): string {
  return char === '\n' ? ' ' : `\\${char}`;
}

/** The inline Markdown of a table cell; paragraphs are joined, pipes escaped. */
function cellMarkdown(cell: PMNode): string {
  return serializer
    .serialize(cell, { tightLists: true })
    .replace(/\n+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

/** A stored document as Markdown; null and empty documents give an empty string. */
export function docToMarkdown(doc: unknown): string {
  if (!doc) return '';
  return serializer.serialize(richTextSchema.nodeFromJSON(doc), { tightLists: true });
}

// ---------------------------------------------------------------- mentions

interface JsonNode {
  type?: string;
  text?: string;
  marks?: unknown[];
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
}

/** A mention to keep (with these attributes) or to turn into plain `@label` text (null). */
export type MentionDecision = { id: string; label: string } | null;

/**
 * Checks every mention of a document, e.g. against the people who may see a project (E-51).
 * Rejected mentions become text; neighbouring text with the same marks is merged again.
 */
export async function reviewMentions(
  doc: RichTextDoc,
  decide: (mention: { id: string | null; label: string }) => Promise<MentionDecision>,
): Promise<RichTextDoc> {
  const visit = async (node: JsonNode): Promise<JsonNode> => {
    if (!node.content) return node;
    const children: JsonNode[] = [];
    for (const child of node.content) {
      let next = await visit(child);
      if (child.type === 'mention') {
        const label = String(child.attrs?.label ?? '');
        const decision = await decide({ id: (child.attrs?.id as string | null) ?? null, label });
        next = decision
          ? { ...child, attrs: { ...child.attrs, ...decision } }
          : { type: 'text', text: `@${label}` };
      }
      const last = children.at(-1);
      if (
        last?.type === 'text' &&
        next.type === 'text' &&
        JSON.stringify(last.marks ?? []) === JSON.stringify(next.marks ?? [])
      ) {
        children[children.length - 1] = { ...last, text: `${last.text}${next.text}` };
      } else {
        children.push(next);
      }
    }
    return { ...node, content: children };
  };
  return (await visit(doc as JsonNode)) as RichTextDoc;
}
