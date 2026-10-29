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

// Raw HTML stays text; images only as attachments of their own line (E-61).
const markdownIt = new MarkdownIt('default', { html: false, linkify: false }).disable(['image']);
markdownIt.inline.ruler.before('link', 'mention', mentionRule);
markdownIt.block.ruler.before('paragraph', 'attachment_image', attachmentImageRule);
markdownIt.core.ruler.after('block', 'block_shapes', blockShapes);

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
  fence: {
    block: 'codeBlock',
    getAttrs: (token) => ({ language: token.info.trim().split(/\s+/)[0] || null }),
    noCloseToken: true,
  },
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
      state.write(`${fence}${(block.attrs.language as string | null) ?? ''}\n`);
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
