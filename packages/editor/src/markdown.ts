import type { Node as PMNode } from '@tiptap/pm/model';
import MarkdownIt from 'markdown-it';
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

// Raw HTML stays text; images and tables are not part of the document model.
const markdownIt = new MarkdownIt('default', { html: false, linkify: false }).disable([
  'image',
  'table',
]);
markdownIt.inline.ruler.before('link', 'mention', mentionRule);

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
