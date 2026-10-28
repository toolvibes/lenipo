const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'listItem',
  'taskItem',
  'tableRow',
]);

interface Node {
  type?: unknown;
  text?: unknown;
  content?: unknown;
}

/** Plain text of a ProseMirror document, one line per block, for search and previews. */
export function plainText(doc: unknown, limit = 100_000): string {
  const lines: string[] = [];
  let current = '';
  const walk = (node: Node) => {
    if (typeof node.text === 'string') current += node.text;
    if (node.type === 'hardBreak') current += '\n';
    if (Array.isArray(node.content)) for (const child of node.content) walk((child ?? {}) as Node);
    if (typeof node.type === 'string' && BLOCK_TYPES.has(node.type)) {
      if (current.trim()) lines.push(current.trim());
      current = '';
    }
  };
  if (doc && typeof doc === 'object') walk(doc as Node);
  if (current.trim()) lines.push(current.trim());
  return lines.join('\n').slice(0, limit);
}

/** A document with one paragraph per line; used by the API for simple text input and tests. */
export function docFromText(text: string) {
  return {
    type: 'doc' as const,
    content: text
      .split('\n')
      .map((line) =>
        line
          ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
          : { type: 'paragraph' },
      ),
  };
}
