/**
 * Replacing one section of a document (E-74): the blocks after a heading up to the next
 * heading of the same or a higher level. Agents edit pages this way, so text elsewhere,
 * possibly changed by people at the same time, stays untouched.
 */

interface Block {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: Block[];
  text?: string;
}

interface Doc {
  type: 'doc';
  content?: Block[];
}

function textOf(node: Block): string {
  return node.text ?? (node.content ?? []).map(textOf).join('');
}

const level = (block: Block) => Number(block.attrs?.level ?? 1);

/** The headings of a document, as an agent would name them. */
export function headingsOf(doc: Doc): string[] {
  return (doc.content ?? [])
    .filter((block) => block.type === 'heading')
    .map((block) => textOf(block).trim());
}

export type SectionResult = { doc: Doc } | { error: 'not-found' | 'ambiguous'; headings: string[] };

/**
 * `doc` with the section under the heading `heading` (exact text, ignoring surrounding
 * whitespace) replaced by the blocks of `replacement`. With `newHeading`, the heading text
 * changes too; otherwise the heading stays as it is.
 */
export function replaceSection(
  doc: Doc,
  heading: string,
  replacement: Doc,
  newHeading?: string,
): SectionResult {
  const blocks = doc.content ?? [];
  const wanted = heading.trim();
  const matches = blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block.type === 'heading' && textOf(block).trim() === wanted);
  if (matches.length !== 1) {
    return { error: matches.length === 0 ? 'not-found' : 'ambiguous', headings: headingsOf(doc) };
  }
  const [{ block, index }] = matches as [{ block: Block; index: number }];
  let end = index + 1;
  while (end < blocks.length) {
    const next = blocks[end] as Block;
    if (next.type === 'heading' && level(next) <= level(block)) break;
    end += 1;
  }
  const headingBlock: Block =
    newHeading === undefined ? block : { ...block, content: [{ type: 'text', text: newHeading }] };
  return {
    doc: {
      ...doc,
      content: [
        ...blocks.slice(0, index),
        headingBlock,
        ...(replacement.content ?? []),
        ...blocks.slice(end),
      ],
    },
  };
}
