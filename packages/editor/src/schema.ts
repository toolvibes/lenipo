import { getSchema } from '@tiptap/core';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import Mention from '@tiptap/extension-mention';
import { TableKit } from '@tiptap/extension-table';
import type { Node as PMNode } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import { AttachmentImage, IMAGE_ALIGNMENTS } from './image.js';
import { CHART_TYPES, COLUMN_LAYOUTS, SECTION_TONES, validLeafAttrs } from './layout-macros.js';
import {
  type ChildPagesOptions,
  ISSUE_LIST_DISPLAYS,
  type MacroViews,
  macroExtensions,
  PANEL_KINDS,
  REPORT_MACRO_KINDS,
  STATUS_COLORS,
} from './macros.js';

export {
  AttachmentImage,
  attachmentUrl,
  IMAGE_ALIGNMENTS,
  type ImageAlignment,
} from './image.js';
export * from './macros.js';

/**
 * Tables, task lists and images (E-61). The web app adds them with the same settings; only
 * behaviour such as resizing columns differs, which does not change the schema.
 */
export function blockExtensions({
  resizableTables = false,
  views = {},
  children = {},
}: {
  resizableTables?: boolean;
  /** Browser views of the macros (E-66). */
  views?: MacroViews;
  children?: Partial<ChildPagesOptions>;
} = {}) {
  return [
    TableKit.configure({ table: { resizable: resizableTables } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    AttachmentImage,
    ...macroExtensions(views, children),
  ];
}

/** StarterKit without the parts the shared schema replaces (the code block, E-66). */
export const starterKitOptions = { codeBlock: false } as const;

/**
 * The extensions that define Lenipo's rich text, the same in the browser editor and in the
 * converters (E-51). The web app adds only behaviour (placeholder, suggestions) on top.
 */
export const richTextExtensions = [
  StarterKit.configure(starterKitOptions),
  Mention,
  ...blockExtensions(),
];

/** The ProseMirror schema of stored rich text, built without a DOM. */
export const richTextSchema = getSchema(richTextExtensions);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISSUE_KEY = /^[A-Z][A-Z0-9]{1,9}-[1-9][0-9]*$/;

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
  const text = (value: unknown, max: number) => typeof value === 'string' && value.length <= max;
  const level = (value: unknown, max: number) =>
    Number.isInteger(value) && (value as number) >= 1 && (value as number) <= max;
  switch (node.type.name) {
    case 'codeBlock':
      return (
        (node.attrs.language === null || text(node.attrs.language, 40)) &&
        (node.attrs.title === null || text(node.attrs.title, 200)) &&
        typeof node.attrs.lineNumbers === 'boolean' &&
        typeof node.attrs.collapsed === 'boolean'
      );
    case 'panel':
      return (PANEL_KINDS as readonly unknown[]).includes(node.attrs.kind);
    case 'expand':
      return text(node.attrs.title, 200);
    case 'status':
      return (
        text(node.attrs.text, 40) &&
        (STATUS_COLORS as readonly unknown[]).includes(node.attrs.color)
      );
    case 'issue':
      // Empty while an editor is still choosing the issue.
      return node.attrs.key === '' || (text(node.attrs.key, 30) && ISSUE_KEY.test(node.attrs.key));
    case 'issueList':
      return (
        text(node.attrs.query, 2000) &&
        (ISSUE_LIST_DISPLAYS as readonly unknown[]).includes(node.attrs.display) &&
        level(node.attrs.limit, 100)
      );
    case 'report':
      return (
        (REPORT_MACRO_KINDS as readonly unknown[]).includes(node.attrs.kind) &&
        text(node.attrs.query, 2000) &&
        text(node.attrs.field, 40) &&
        Number.isInteger(node.attrs.days) &&
        node.attrs.days >= 7 &&
        node.attrs.days <= 365 &&
        text(node.attrs.boardId, 40)
      );
    case 'columns':
      return (COLUMN_LAYOUTS as readonly unknown[]).includes(node.attrs.layout);
    case 'section':
      return (SECTION_TONES as readonly unknown[]).includes(node.attrs.tone);
    case 'excerpt':
      return text(node.attrs.name, 100);
    case 'placeholder':
      return text(node.attrs.text, 500);
    case 'chart':
      return (
        (CHART_TYPES as readonly unknown[]).includes(node.attrs.type) && text(node.attrs.title, 200)
      );
    case 'tableOfContents':
      return level(node.attrs.maxLevel, 6);
    case 'childPages':
      return level(node.attrs.depth, 5);
    default:
      return validLeafAttrs(node.type.name, node.attrs);
  }
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
