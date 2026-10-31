import { mergeAttributes, Node, type NodeViewRenderer } from '@tiptap/core';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { type LayoutViews, layoutExtensions } from './layout-macros.js';

/** The macros of the wiki (W-MAC-01 to -07, E-66): typed nodes of the shared schema. */

export const PANEL_KINDS = ['info', 'note', 'warning', 'success'] as const;
export type PanelKind = (typeof PANEL_KINDS)[number];

export const STATUS_COLORS = ['grey', 'blue', 'green', 'yellow', 'red', 'purple'] as const;
export type StatusColor = (typeof STATUS_COLORS)[number];

export const ISSUE_LIST_DISPLAYS = ['table', 'count'] as const;

/** Browser-only views of the macros; the schema stays the same without them. */
export type MacroViews = Partial<
  Record<
    | 'codeBlock'
    | 'expand'
    | 'status'
    | 'issue'
    | 'issueList'
    | 'report'
    | 'tableOfContents'
    | 'childPages',
    NodeViewRenderer
  >
> &
  LayoutViews;

/** Where child pages are listed from; set by the web app on wiki pages. */
export interface ChildPagesOptions {
  spaceKey: string | null;
  pageId: string | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    macros: {
      setPanel: (kind: PanelKind) => ReturnType;
      insertMacro: (type: string, attrs?: Record<string, unknown>) => ReturnType;
    };
  }
}

const lowlight = createLowlight(common);

/** Code block (W-MAC-03) with title, line numbers and folding; highlighted where shown. */
export const CodeBlock = CodeBlockLowlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      title: { default: null },
      lineNumbers: { default: false },
      collapsed: { default: false },
    };
  },
}).configure({ lowlight, defaultLanguage: null });

/** Info, note, warning or success box around any blocks (W-MAC-02). */
export const Panel = Node.create({
  name: 'panel',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { kind: { default: 'info' } };
  },
  parseHTML() {
    return [
      { tag: 'aside[data-panel]', getAttrs: (el) => ({ kind: el.getAttribute('data-panel') }) },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'aside',
      mergeAttributes(HTMLAttributes, { class: 'tl-panel', 'data-panel': node.attrs.kind }),
      0,
    ];
  },
  addCommands() {
    return {
      setPanel:
        (kind) =>
        ({ commands }) =>
          commands.wrapIn(this.name, { kind }),
      insertMacro:
        (type, attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({ type, attrs }),
    };
  },
});

/** A titled section that readers open on demand (W-MAC-04). */
export const Expand = Node.create({
  name: 'expand',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { title: { default: '' } };
  },
  parseHTML() {
    return [
      {
        tag: 'details[data-expand]',
        contentElement: 'div',
        getAttrs: (el) => ({ title: el.querySelector('summary')?.textContent ?? '' }),
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'details',
      mergeAttributes(HTMLAttributes, { class: 'tl-expand', 'data-expand': '' }),
      ['summary', {}, node.attrs.title || '…'],
      ['div', { class: 'tl-expand-body' }, 0],
    ];
  },
});

/** A coloured label in running text (W-MAC-05). */
export const Status = Node.create({
  name: 'status',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { text: { default: '' }, color: { default: 'grey' } };
  },
  parseHTML() {
    return [
      {
        tag: 'span[data-status]',
        getAttrs: (el) => ({ text: el.textContent ?? '', color: el.getAttribute('data-status') }),
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'tl-status', 'data-status': node.attrs.color }),
      node.attrs.text,
    ];
  },
});

/** A single issue with its live status (W-MAC-06); the key is the only stored value. */
export const IssueMacro = Node.create({
  name: 'issue',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() {
    return { key: { default: '' } };
  },
  parseHTML() {
    return [
      { tag: 'span[data-issue]', getAttrs: (el) => ({ key: el.getAttribute('data-issue') }) },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'tl-issue-macro', 'data-issue': node.attrs.key }),
      node.attrs.key,
    ];
  },
});

/** A TQL query shown as a table or a count, run as the reader (W-MAC-06). */
export const IssueList = Node.create({
  name: 'issueList',
  group: 'block',
  atom: true,
  addAttributes() {
    return { query: { default: '' }, display: { default: 'table' }, limit: { default: 20 } };
  },
  parseHTML() {
    return [{ tag: 'div[data-issue-list]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'tl-issue-list',
        'data-issue-list': node.attrs.query,
      }),
      node.attrs.query,
    ];
  },
});

/** Report kinds the report macro shows (TL-21, E-102); the web app knows their settings. */
export const REPORT_MACRO_KINDS = [
  'cfd',
  'burnup',
  'control-chart',
  'scope-progress',
  'created-vs-resolved',
  'average-age',
  'field-series',
  'pie',
  'time-tracking',
  'burndown',
  'velocity',
  'sprint-report',
] as const;

/** A report of the reports page, run as the reader (T-RPT-10). */
export const ReportMacro = Node.create({
  name: 'report',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      kind: { default: 'cfd' },
      query: { default: '' },
      field: { default: '' },
      days: { default: 30 },
      boardId: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-report]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'tl-report', 'data-report': node.attrs.kind }),
      node.attrs.query,
    ];
  },
});

/** The headings of the page as links (W-MAC-01). */
export const TableOfContents = Node.create({
  name: 'tableOfContents',
  group: 'block',
  atom: true,
  addAttributes() {
    return { maxLevel: { default: 3 } };
  },
  parseHTML() {
    return [{ tag: 'nav[data-toc]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['nav', mergeAttributes(HTMLAttributes, { class: 'tl-toc', 'data-toc': '' })];
  },
});

/** The pages below this one (W-MAC-07). */
export const ChildPages = Node.create<ChildPagesOptions>({
  name: 'childPages',
  group: 'block',
  atom: true,
  addOptions() {
    return { spaceKey: null, pageId: null };
  },
  addAttributes() {
    return { depth: { default: 1 } };
  },
  parseHTML() {
    return [{ tag: 'nav[data-children]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['nav', mergeAttributes(HTMLAttributes, { class: 'tl-children', 'data-children': '' })];
  },
});

/** The macro nodes, with browser views where the web app provides them. */
export function macroExtensions(views: MacroViews = {}, children: Partial<ChildPagesOptions> = {}) {
  const withView = <T extends { extend: (config: object) => T }>(
    node: T,
    view: NodeViewRenderer | undefined,
  ): T => (view ? node.extend({ addNodeView: () => view }) : node);
  return [
    withView(CodeBlock, views.codeBlock),
    Panel,
    withView(Expand, views.expand),
    withView(Status, views.status),
    withView(IssueMacro, views.issue),
    withView(IssueList, views.issueList),
    withView(ReportMacro, views.report),
    withView(TableOfContents, views.tableOfContents),
    withView(ChildPages, views.childPages).configure(children),
    ...layoutExtensions(views),
  ];
}
