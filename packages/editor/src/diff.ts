/**
 * Comparison of two stored documents (W-PAG-05, E-62): the documents become a list of blocks
 * (headings, paragraphs, list and task items, table rows, images, …), the blocks are aligned,
 * and blocks that changed only partly get a word-level diff.
 */

export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'listItem'
  | 'taskItem'
  | 'quote'
  | 'codeBlock'
  | 'tableRow'
  | 'image'
  | 'rule';

export interface DiffBlockContent {
  type: BlockType;
  /** Plain text; for table rows the cells joined, for images caption and alternative text. */
  text: string;
  /** Nesting depth of list items. */
  depth: number;
  level?: number;
  checked?: boolean;
  cells?: string[];
  header?: boolean;
  attachmentId?: string;
}

export interface WordChange {
  op: 'same' | 'added' | 'removed';
  text: string;
}

export type DiffBlock =
  | { op: 'same' | 'added' | 'removed'; block: DiffBlockContent }
  | { op: 'changed'; before: DiffBlockContent; after: DiffBlockContent; words: WordChange[] };

interface JsonNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
}

function textOf(node: JsonNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'mention') return `@${String(node.attrs?.label ?? '')}`;
  if (node.type === 'hardBreak') return ' ';
  const parts = (node.content ?? []).map(textOf);
  return node.type === 'paragraph' || node.type === 'heading'
    ? parts.join('')
    : parts.join(' ').replace(/\s+/g, ' ');
}

/** The document as a flat list of comparable blocks, in reading order. */
export function docBlocks(doc: unknown): DiffBlockContent[] {
  const blocks: DiffBlockContent[] = [];
  const visit = (node: JsonNode, depth: number, quote: boolean) => {
    switch (node.type) {
      case 'heading':
        blocks.push({
          type: 'heading',
          text: textOf(node),
          depth,
          level: Number(node.attrs?.level ?? 1),
        });
        return;
      case 'paragraph':
        blocks.push({ type: quote ? 'quote' : 'paragraph', text: textOf(node), depth });
        return;
      case 'codeBlock':
        blocks.push({ type: 'codeBlock', text: textOf(node), depth });
        return;
      case 'horizontalRule':
        blocks.push({ type: 'rule', text: '', depth });
        return;
      case 'image': {
        const caption = String(node.attrs?.caption ?? '');
        const alt = String(node.attrs?.alt ?? '');
        blocks.push({
          type: 'image',
          text: [caption, alt].filter(Boolean).join(' · '),
          depth,
          attachmentId: String(node.attrs?.attachmentId ?? ''),
        });
        return;
      }
      case 'tableRow': {
        const cells = (node.content ?? []).map(textOf);
        blocks.push({
          type: 'tableRow',
          text: cells.join(' | '),
          depth,
          cells,
          header: (node.content ?? []).every((cell) => cell.type === 'tableHeader'),
        });
        return;
      }
      case 'listItem':
      case 'taskItem': {
        // The item's own text, then its nested lists one level deeper.
        const [first, ...rest] = node.content ?? [];
        blocks.push({
          type: node.type,
          text: first ? textOf(first) : '',
          depth,
          ...(node.type === 'taskItem' ? { checked: node.attrs?.checked === true } : {}),
        });
        for (const child of rest) visit(child, depth + 1, quote);
        return;
      }
      case 'blockquote':
        for (const child of node.content ?? []) visit(child, depth, true);
        return;
      default:
        for (const child of node.content ?? []) visit(child, depth, quote);
    }
  };
  if (doc && typeof doc === 'object') visit(doc as JsonNode, 0, false);
  return blocks;
}

const keyOf = (block: DiffBlockContent) =>
  `${block.type}|${block.depth}|${block.level ?? ''}|${block.checked ?? ''}|${block.attachmentId ?? ''}|${block.text}`;

/** Longest common subsequence alignment of two sequences by key. */
function align<T>(a: T[], b: T[], key: (item: T) => string): Array<[T | null, T | null]> {
  const n = a.length;
  const m = b.length;
  const keysA = a.map(key);
  const keysB = b.map(key);
  const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    const row = table[i] as Uint32Array;
    const next = table[i + 1] as Uint32Array;
    for (let j = m - 1; j >= 0; j--) {
      row[j] =
        keysA[i] === keysB[j]
          ? (next[j + 1] as number) + 1
          : Math.max(next[j] as number, row[j + 1] as number);
    }
  }
  const pairs: Array<[T | null, T | null]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (keysA[i] === keysB[j]) {
      pairs.push([a[i] as T, b[j] as T]);
      i++;
      j++;
    } else if (
      ((table[i + 1] as Uint32Array)[j] as number) >= ((table[i] as Uint32Array)[j + 1] as number)
    ) {
      pairs.push([a[i] as T, null]);
      i++;
    } else {
      pairs.push([null, b[j] as T]);
      j++;
    }
  }
  for (; i < n; i++) pairs.push([a[i] as T, null]);
  for (; j < m; j++) pairs.push([null, b[j] as T]);
  return pairs;
}

/** Word-level changes between two texts; whitespace stays attached to the words. */
export function diffWords(before: string, after: string): WordChange[] {
  const tokens = (text: string) => text.match(/\S+\s*|\s+/g) ?? [];
  const changes: WordChange[] = [];
  for (const [left, right] of align(tokens(before), tokens(after), (token) => token.trim())) {
    const op = left !== null && right !== null ? 'same' : left !== null ? 'removed' : 'added';
    const text = (right ?? left) as string;
    const last = changes.at(-1);
    if (last?.op === op) last.text += text;
    else changes.push({ op, text });
  }
  return changes;
}

function similarity(before: string, after: string): number {
  const words = diffWords(before, after);
  const same = words
    .filter((word) => word.op === 'same')
    .reduce((sum, w) => sum + w.text.length, 0);
  return (2 * same) / Math.max(1, before.length + after.length);
}

/**
 * The blocks of `after` compared with `before`. A removed and an added block of the same kind
 * next to each other count as one changed block when at least a third of their text agrees.
 */
export function diffDocs(before: unknown, after: unknown): DiffBlock[] {
  const pairs = align(docBlocks(before), docBlocks(after), keyOf);
  const result: DiffBlock[] = [];
  let index = 0;
  while (index < pairs.length) {
    const [left, right] = pairs[index] as [DiffBlockContent | null, DiffBlockContent | null];
    if (left && right) {
      result.push({ op: 'same', block: right });
      index++;
      continue;
    }
    // A run of removals and additions between two unchanged blocks.
    const removed: DiffBlockContent[] = [];
    const added: DiffBlockContent[] = [];
    while (index < pairs.length) {
      const [l, r] = pairs[index] as [DiffBlockContent | null, DiffBlockContent | null];
      if (l && r) break;
      if (l) removed.push(l);
      if (r) added.push(r);
      index++;
    }
    while (removed.length > 0 || added.length > 0) {
      const old = removed[0];
      const next = added[0];
      if (old && next && old.type === next.type && similarity(old.text, next.text) >= 1 / 3) {
        result.push({
          op: 'changed',
          before: old,
          after: next,
          words: diffWords(old.text, next.text),
        });
        removed.shift();
        added.shift();
      } else if (old && (!next || removed.length >= added.length)) {
        result.push({ op: 'removed', block: old });
        removed.shift();
      } else if (next) {
        result.push({ op: 'added', block: next });
        added.shift();
      }
    }
  }
  return result;
}
