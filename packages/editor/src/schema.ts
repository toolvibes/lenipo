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
