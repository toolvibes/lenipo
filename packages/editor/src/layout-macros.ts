import { mergeAttributes, Node, type NodeViewRenderer } from '@tiptap/core';

/**
 * More wiki macros (TL-26, E-107): layout containers that hold blocks, and leaf macros that a
 * browser view renders live with the reader's permissions. Stored are only references.
 */

export const COLUMN_LAYOUTS = ['1-1', '1-1-1', '1-2', '2-1'] as const;
export const SECTION_TONES = ['grey', 'blue', 'green', 'yellow'] as const;
export const CHART_TYPES = ['bar', 'line', 'pie'] as const;

type AttrValue = string | number | boolean;

/** Leaf macros: node name → Markdown directive and attributes with their defaults. */
export const LEAF_MACROS = {
  includePage: { directive: 'include', attrs: { page: '' } },
  excerptInclude: { directive: 'excerpt-include', attrs: { page: '', name: '' } },
  propertiesReport: { directive: 'properties-report', attrs: { label: '', space: '' } },
  contentByLabel: { directive: 'labelled', attrs: { labels: '', space: '', limit: 10 } },
  recentlyUpdated: { directive: 'recent', attrs: { space: '', limit: 10 } },
  taskReport: { directive: 'tasks', attrs: { space: '', assignee: 'all' } },
  attachmentList: { directive: 'attachments', attrs: { images: false } },
  documentPreview: { directive: 'preview', attrs: { attachment: '' } },
  embed: { directive: 'embed', attrs: { url: '', height: 400 } },
  liveSearch: { directive: 'search', attrs: { space: '' } },
  /** A macro module of an installed app, by app and module key (TL-50, E-140). */
  appMacro: { directive: 'app', attrs: { app: '', module: '', config: '', height: 300 } },
} as const satisfies Record<string, { directive: string; attrs: Record<string, AttrValue> }>;
export type LeafMacroName = keyof typeof LEAF_MACROS;
export const LEAF_MACRO_NAMES = Object.keys(LEAF_MACROS) as LeafMacroName[];

/** Containers: node name → Markdown directive (`:::name{…}` … `:::`). */
export const CONTAINER_MACROS = {
  columns: 'columns',
  column: 'column',
  section: 'section',
  excerpt: 'excerpt',
  pageProperties: 'properties',
  chart: 'chart',
} as const;

export type LayoutViews = Partial<Record<LeafMacroName | 'chart', NodeViewRenderer>>;

function leaf(name: LeafMacroName, view?: NodeViewRenderer) {
  const definition = LEAF_MACROS[name];
  return Node.create({
    name,
    group: 'block',
    atom: true,
    addAttributes() {
      return Object.fromEntries(
        Object.entries(definition.attrs).map(([key, value]) => [key, { default: value }]),
      );
    },
    parseHTML() {
      return [{ tag: `div[data-macro="${definition.directive}"]` }];
    },
    renderHTML({ HTMLAttributes }) {
      return [
        'div',
        mergeAttributes(HTMLAttributes, { class: 'tl-macro', 'data-macro': definition.directive }),
      ];
    },
    ...(view ? { addNodeView: () => view } : {}),
  });
}

/**
 * Instruction text of a template (W-TPL-02, TL-27): shown greyed, replaced when one types over
 * it, and dropped from the page when it is published.
 */
export const Placeholder = Node.create({
  name: 'placeholder',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { text: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'span[data-placeholder]', getAttrs: (el) => ({ text: el.textContent ?? '' }) }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'tl-placeholder', 'data-placeholder': '' }),
      node.attrs.text,
    ];
  },
});

/** Removes placeholders from a document, e.g. before publishing. */
export function withoutPlaceholders<T>(doc: T): T {
  const strip = (node: unknown): unknown => {
    if (!node || typeof node !== 'object') return node;
    const value = node as { content?: unknown[] };
    if (!Array.isArray(value.content)) return node;
    return {
      ...value,
      content: value.content
        .filter((child) => (child as { type?: string })?.type !== 'placeholder')
        .map(strip),
    };
  };
  return strip(doc) as T;
}

/** Two or three columns side by side; widths by layout. */
export const Columns = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column{2,3}',
  defining: true,
  addAttributes() {
    return { layout: { default: '1-1' } };
  },
  parseHTML() {
    return [
      { tag: 'div[data-columns]', getAttrs: (el) => ({ layout: el.getAttribute('data-columns') }) },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'tl-columns', 'data-columns': node.attrs.layout }),
      0,
    ];
  },
});

export const Column = Node.create({
  name: 'column',
  content: 'block+',
  defining: true,
  isolating: true,
  parseHTML() {
    return [{ tag: 'div[data-column]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'tl-column', 'data-column': '' }), 0];
  },
});

/** A section with a background colour (W-MAC-18). */
export const Section = Node.create({
  name: 'section',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { tone: { default: 'grey' } };
  },
  parseHTML() {
    return [
      { tag: 'section[data-tone]', getAttrs: (el) => ({ tone: el.getAttribute('data-tone') }) },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'section',
      mergeAttributes(HTMLAttributes, { class: 'tl-section', 'data-tone': node.attrs.tone }),
      0,
    ];
  },
});

/** Text other pages can include (W-MAC-08); a page may have several, by name. */
export const Excerpt = Node.create({
  name: 'excerpt',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { name: { default: '' } };
  },
  parseHTML() {
    return [
      { tag: 'div[data-excerpt]', getAttrs: (el) => ({ name: el.getAttribute('data-excerpt') }) },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'tl-excerpt', 'data-excerpt': node.attrs.name }),
      0,
    ];
  },
});

/** Structured metadata as a two-column table; reports gather it across pages (W-MAC-09). */
export const PageProperties = Node.create({
  name: 'pageProperties',
  group: 'block',
  content: 'block+',
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-properties]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'tl-properties', 'data-properties': '' }),
      0,
    ];
  },
});

/** A chart drawn from the table inside it (W-MAC-12). */
export const ChartMacro = Node.create({
  name: 'chart',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { type: { default: 'bar' }, title: { default: '' } };
  },
  parseHTML() {
    return [
      { tag: 'figure[data-chart]', getAttrs: (el) => ({ type: el.getAttribute('data-chart') }) },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'figure',
      mergeAttributes(HTMLAttributes, { class: 'tl-chart', 'data-chart': node.attrs.type }),
      0,
    ];
  },
});

export function layoutExtensions(views: LayoutViews = {}) {
  return [
    Placeholder,
    Columns,
    Column,
    Section,
    Excerpt,
    PageProperties,
    views.chart
      ? ChartMacro.extend({ addNodeView: () => views.chart as NodeViewRenderer })
      : ChartMacro,
    ...LEAF_MACRO_NAMES.map((name) => leaf(name, views[name])),
  ];
}

/** Whether a leaf macro's stored attributes are of the expected kinds and sizes. */
export function validLeafAttrs(name: string, attrs: Record<string, unknown>): boolean {
  const definition = LEAF_MACROS[name as LeafMacroName];
  if (!definition) return true;
  return Object.entries(definition.attrs).every(([key, fallback]) => {
    const value = attrs[key];
    if (typeof fallback === 'number') {
      return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 2000;
    }
    if (typeof fallback === 'boolean') return typeof value === 'boolean';
    return typeof value === 'string' && value.length <= 2000;
  });
}
