import { getSchema } from '@tiptap/core';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import Mention from '@tiptap/extension-mention';
import { TableKit } from '@tiptap/extension-table';
import type { Node as PMNode } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import { AttachmentImage, IMAGE_ALIGNMENTS } from './image.js';

export {
  AttachmentImage,
  attachmentUrl,
  IMAGE_ALIGNMENTS,
  type ImageAlignment,
} from './image.js';

/**
 * Tables, task lists and images (E-61). The web app adds them with the same settings; only
 * behaviour such as resizing columns differs, which does not change the schema.
 */
export function blockExtensions({ resizableTables = false } = {}) {
  return [
    TableKit.configure({ table: { resizable: resizableTables } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    AttachmentImage,
  ];
}

/**
 * The extensions that define Tasklore's rich text, the same in the browser editor and in the
 * converters (E-51). The web app adds only behaviour (placeholder, suggestions) on top.
 */
export const richTextExtensions = [StarterKit, Mention, ...blockExtensions()];

/** The ProseMirror schema of stored rich text, built without a DOM. */
export const richTextSchema = getSchema(richTextExtensions);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Attribute values the schema itself does not restrict. */
function validAttrs(node: PMNode): boolean {
  if (node.type.name === 'image') {
    const { attachmentId, alt, width, align, caption } = node.attrs;
    return (
      typeof attachmentId === 'string' &&
      UUID.test(attachmentId) &&
      (alt === null || (typeof alt === 'string' && alt.length <= 500)) &&
      (width === null || (Number.isInteger(width) && width >= 10 && width <= 100)) &&
      (IMAGE_ALIGNMENTS as readonly unknown[]).includes(align) &&
      typeof caption === 'string' &&
      caption.length <= 500
    );
  }
  if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
    const { colspan, rowspan, colwidth } = node.attrs;
    const span = (value: unknown) => Number.isInteger(value) && (value as number) >= 1;
    return (
      span(colspan) &&
      span(rowspan) &&
      (colwidth === null ||
        (Array.isArray(colwidth) &&
          colwidth.every((width) => Number.isInteger(width) && width > 0 && width <= 5000)))
    );
  }
  if (node.type.name === 'taskItem') return typeof node.attrs.checked === 'boolean';
  return true;
}

/**
 * Whether a JSON document fits the schema: known nodes and marks, valid nesting and attributes.
 * Used before storing documents that come from a client (E-59).
 */
export function isValidDoc(doc: unknown): boolean {
  try {
    const node = richTextSchema.nodeFromJSON(doc);
    node.check();
    if (node.type.name !== 'doc') return false;
    let valid = true;
    node.descendants((child) => {
      if (valid && !validAttrs(child)) valid = false;
      return valid;
    });
    return valid;
  } catch {
    return false;
  }
}

/** The attachment ids of all images in a document, e.g. to check that they belong to a page. */
export function imageAttachmentIds(doc: unknown): string[] {
  const ids = new Set<string>();
  const visit = (node: { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }) => {
    if (node.type === 'image' && typeof node.attrs?.attachmentId === 'string') {
      ids.add(node.attrs.attachmentId);
    }
    for (const child of node.content ?? []) visit(child as typeof node);
  };
  if (doc && typeof doc === 'object') visit(doc as never);
  return [...ids];
}
