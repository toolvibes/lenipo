import type { Node as PMNode } from '@tiptap/pm/model';
import { type BlockType, docBlocks } from './diff.js';

/**
 * Where an inline comment sits (W-EDT-11, E-63): the quoted text, a little context around it
 * and the number of its block in {@link docBlocks} order. Comments never change the document.
 */
export interface TextAnchor {
  exact: string;
  prefix: string;
  suffix: string;
  block: number;
}

/** Blocks whose text maps one to one onto the document, so a quote can point into them. */
const ANCHORABLE = new Set<BlockType>(['heading', 'paragraph', 'quote', 'listItem', 'taskItem']);

/** Context kept on each side of the quote. */
export const ANCHOR_CONTEXT = 32;

export interface LocatedAnchor {
  block: number;
  start: number;
  end: number;
}

const sharedSuffix = (a: string, b: string) => {
  let length = 0;
  while (
    length < a.length &&
    length < b.length &&
    a[a.length - 1 - length] === b[b.length - 1 - length]
  )
    length++;
  return length;
};
const sharedPrefix = (a: string, b: string) => {
  let length = 0;
  while (length < a.length && length < b.length && a[length] === b[length]) length++;
  return length;
};

/**
 * Finds the quote in a document: every occurrence in a text block counts, the one whose
 * surrounding text and block number fit best wins. Null when the text is gone ("detached").
 */
export function locateAnchor(doc: unknown, anchor: TextAnchor): LocatedAnchor | null {
  if (!anchor.exact) return null;
  let best: (LocatedAnchor & { score: number }) | null = null;
  docBlocks(doc).forEach((block, index) => {
    if (!ANCHORABLE.has(block.type)) return;
    let start = block.text.indexOf(anchor.exact);
    while (start !== -1) {
      const score =
        sharedSuffix(block.text.slice(0, start), anchor.prefix) +
        sharedPrefix(block.text.slice(start + anchor.exact.length), anchor.suffix) -
        Math.abs(index - anchor.block) / 1000;
      if (!best || score > best.score) {
        best = { block: index, start, end: start + anchor.exact.length, score };
      }
      start = block.text.indexOf(anchor.exact, start + 1);
    }
  });
  if (!best) return null;
  const { block, start, end } = best;
  return { block, start, end };
}

/** The anchor for the same text in another version, or null when it is gone. */
export function reanchor(doc: unknown, anchor: TextAnchor): TextAnchor | null {
  const found = locateAnchor(doc, anchor);
  if (!found) return null;
  const text = docBlocks(doc)[found.block]?.text ?? '';
  return {
    exact: anchor.exact,
    prefix: text.slice(Math.max(0, found.start - ANCHOR_CONTEXT), found.start),
    suffix: text.slice(found.end, found.end + ANCHOR_CONTEXT),
    block: found.block,
  };
}

// ---------------------------------------------------------------- ProseMirror positions

/** The text of an inline leaf as {@link docBlocks} counts it. */
function leafText(node: PMNode): string {
  if (node.type.name === 'mention') return `@${String(node.attrs.label ?? '')}`;
  if (node.type.name === 'hardBreak') return ' ';
  return '';
}

/**
 * The text blocks of a ProseMirror document in {@link docBlocks} order: for each block the
 * position where its text starts and its node, or null for blocks without anchorable text.
 */
export function textBlockTargets(doc: PMNode): Array<{ pos: number; node: PMNode } | null> {
  const targets: Array<{ pos: number; node: PMNode } | null> = [];
  const visit = (node: PMNode, pos: number) => {
    switch (node.type.name) {
      case 'heading':
      case 'paragraph':
        targets.push({ pos: pos + 1, node });
        return;
      case 'codeBlock':
      case 'horizontalRule':
      case 'image':
      case 'tableRow':
        targets.push(null);
        return;
      case 'listItem':
      case 'taskItem': {
        node.forEach((child, offset, index) => {
          if (index === 0)
            targets.push(child.isTextblock ? { pos: pos + 2 + offset, node: child } : null);
          else visit(child, pos + 1 + offset);
        });
        return;
      }
      default:
        node.forEach((child, offset) => {
          visit(child, pos + 1 + offset);
        });
    }
  };
  doc.forEach((child, offset) => {
    visit(child, offset);
  });
  return targets;
}

/** Document position of a character offset in a text block's text. */
function positionAt(target: { pos: number; node: PMNode }, offset: number): number {
  let counted = 0;
  let pos = target.pos;
  let result = target.pos + target.node.content.size;
  let done = false;
  target.node.forEach((child) => {
    if (done) return;
    const length = child.isText ? (child.text ?? '').length : leafText(child).length;
    if (offset <= counted + length) {
      result = child.isText
        ? pos + (offset - counted)
        : offset === counted
          ? pos
          : pos + child.nodeSize;
      done = true;
      return;
    }
    counted += length;
    pos += child.nodeSize;
  });
  return result;
}

/** The document range of a quote, for highlighting it. */
export function anchorRange(doc: PMNode, anchor: TextAnchor): { from: number; to: number } | null {
  const found = locateAnchor(doc.toJSON(), anchor);
  if (!found) return null;
  const target = textBlockTargets(doc)[found.block];
  if (!target) return null;
  return { from: positionAt(target, found.start), to: positionAt(target, found.end) };
}

/** The anchor for a selection inside one text block, or null for anything else. */
export function anchorFromSelection(doc: PMNode, from: number, to: number): TextAnchor | null {
  if (to <= from) return null;
  const targets = textBlockTargets(doc);
  const block = targets.findIndex(
    (target) => target && from >= target.pos && to <= target.pos + target.node.content.size,
  );
  const target = targets[block];
  if (!target) return null;
  const text = target.node.textBetween(0, target.node.content.size, undefined, leafText);
  const startOffset = target.node.textBetween(0, from - target.pos, undefined, leafText).length;
  const endOffset = target.node.textBetween(0, to - target.pos, undefined, leafText).length;
  const exact = text.slice(startOffset, endOffset);
  if (!exact.trim()) return null;
  return {
    exact,
    prefix: text.slice(Math.max(0, startOffset - ANCHOR_CONTEXT), startOffset),
    suffix: text.slice(endOffset, endOffset + ANCHOR_CONTEXT),
    block,
  };
}
