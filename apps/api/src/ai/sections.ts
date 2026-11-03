import { plainText } from '../tracking/rich-text.js';

/** A part of a page between two headings, as one embedding (TL-108). */
export interface Section {
  heading: string;
  text: string;
}

/** Longest text of one section before it is cut at paragraph boundaries. */
const SECTION_LIMIT = 1_500;
/** Sections of one page at most; the rest of a very long page is not embedded. */
const MAX_SECTIONS = 40;

interface DocNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
}

/** Paragraph by paragraph, cut so no piece is much longer than the limit. */
function pieces(text: string): string[] {
  if (text.length <= SECTION_LIMIT) return [text];
  const result: string[] = [];
  let current = '';
  for (const paragraph of text.split('\n')) {
    if (current && current.length + paragraph.length > SECTION_LIMIT) {
      result.push(current.trim());
      current = '';
    }
    // One paragraph alone may still be too long.
    for (let start = 0; start < paragraph.length; start += SECTION_LIMIT) {
      const part = paragraph.slice(start, start + SECTION_LIMIT);
      if (current && current.length + part.length > SECTION_LIMIT) {
        result.push(current.trim());
        current = '';
      }
      current += `${part}\n`;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

/**
 * A page's text split at its headings: one embedding per section finds the part that answers
 * a question, where one embedding for a long page matched everything a little.
 */
export function sectionsOf(doc: unknown): Section[] {
  const nodes = ((doc as DocNode | null)?.content ?? []) as DocNode[];
  const sections: Section[] = [];
  let heading = '';
  let text: string[] = [];
  const close = () => {
    const joined = text.join('\n').trim();
    if (joined || heading) {
      for (const piece of pieces(joined || heading)) sections.push({ heading, text: piece });
    }
    text = [];
  };
  for (const node of nodes) {
    if (node.type === 'heading' && Number(node.attrs?.level ?? 1) <= 3) {
      close();
      heading = plainText({ type: 'doc', content: [node] }).trim();
    } else {
      const part = plainText({ type: 'doc', content: [node] }).trim();
      if (part) text.push(part);
    }
  }
  close();
  return sections.slice(0, MAX_SECTIONS);
}
