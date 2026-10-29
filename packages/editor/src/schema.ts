import { getSchema } from '@tiptap/core';
import Mention from '@tiptap/extension-mention';
import StarterKit from '@tiptap/starter-kit';

/**
 * The extensions that define Tasklore's rich text, the same in the browser editor and in the
 * converters (E-51). The web app adds only behaviour (placeholder, suggestions) on top.
 */
export const richTextExtensions = [StarterKit, Mention];

/** The ProseMirror schema of stored rich text, built without a DOM. */
export const richTextSchema = getSchema(richTextExtensions);

/**
 * Whether a JSON document fits the schema: known nodes and marks, valid nesting and attributes.
 * Used before storing documents that come from a client (E-59).
 */
export function isValidDoc(doc: unknown): boolean {
  try {
    const node = richTextSchema.nodeFromJSON(doc);
    node.check();
    return node.type.name === 'doc';
  } catch {
    return false;
  }
}
