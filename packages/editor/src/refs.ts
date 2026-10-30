/**
 * Issue keys in documents (W-INT-01, -03, E-73): "WEB-12" in text, outside code, and `issue`
 * macros. The server indexes them for "Wiki-Seiten"; the browser turns them into live links.
 */

/** A fresh matcher each time: global regular expressions keep state. */
export function issueKeyPattern(): RegExp {
  return /(?<![\p{L}\p{N}-])[A-Z][A-Z0-9]{1,9}-[1-9][0-9]*(?![\p{L}\p{N}])/gu;
}

/** Issue keys in a piece of text with their offsets. */
export function issueKeysIn(text: string): Array<{ key: string; index: number }> {
  return [...text.matchAll(issueKeyPattern())].map((match) => ({
    key: match[0],
    index: match.index ?? 0,
  }));
}

export type IssueRefKind = 'mention' | 'macro';

interface JsonNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type?: string }>;
  content?: unknown[];
}

/** Every issue a document refers to, once; an `issue` macro wins over a plain mention. */
export function issueRefs(doc: unknown): Array<{ key: string; kind: IssueRefKind }> {
  const refs = new Map<string, IssueRefKind>();
  const visit = (node: JsonNode, inCode: boolean) => {
    if (node.type === 'issue' && typeof node.attrs?.key === 'string' && node.attrs.key) {
      refs.set(node.attrs.key, 'macro');
    }
    const code = inCode || node.type === 'codeBlock';
    if (
      typeof node.text === 'string' &&
      !code &&
      !node.marks?.some((mark) => mark.type === 'code')
    ) {
      for (const { key } of issueKeysIn(node.text)) {
        if (!refs.has(key)) refs.set(key, 'mention');
      }
    }
    for (const child of node.content ?? []) {
      if (child && typeof child === 'object') visit(child as JsonNode, code);
    }
  };
  if (doc && typeof doc === 'object') visit(doc as JsonNode, false);
  return [...refs].map(([key, kind]) => ({ key, kind }));
}
