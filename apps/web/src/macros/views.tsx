import { CaretDown, CaretRight, FileText, ListNumbers, TreeStructure } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { STATUS_COLORS } from '@tasklore/editor/schema';
import type { Editor } from '@tiptap/core';
import {
  NodeViewContent,
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IssueTypeIcon, StatusLozenge } from '../features/tracking/icons';
import { client, unwrap } from '../lib/api';
import { issueQuery } from '../lib/tracking';
import { nest, pageTreeQuery, type TreeNode } from '../lib/wiki';

/** Macros render live with the reader's permissions (E-66); stored are only references. */

const field =
  'h-7 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-1.5 text-sm';

// ---------------------------------------------------------------- issue

function IssueView({ node, updateAttributes, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const key = String(node.attrs.key ?? '');
  const [draft, setDraft] = useState('');
  const issue = useQuery({ ...issueQuery(key), enabled: key !== '', retry: false });
  if (!key) {
    if (!editor.isEditable) return <NodeViewWrapper as="span" />;
    return (
      <NodeViewWrapper as="span" className="tl-issue-macro is-empty">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value.toUpperCase())}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (/^[A-Z][A-Z0-9]{1,9}-[1-9][0-9]*$/.test(draft)) updateAttributes({ key: draft });
            }
          }}
          placeholder={t('macros.issueKey')}
          aria-label={t('macros.issueKey')}
          className={`${field} w-24 font-[family-name:var(--font-mono)]`}
        />
      </NodeViewWrapper>
    );
  }
  if (issue.isError) {
    // Readers who may not see the issue learn nothing about it, not even the key.
    return (
      <NodeViewWrapper as="span" className="tl-issue-macro is-missing">
        {t('macros.issueUnavailable')}
      </NodeViewWrapper>
    );
  }
  return (
    <NodeViewWrapper as="span" className="tl-issue-macro">
      {issue.data ? (
        <Link to="/issues/$key" params={{ key }} className="tl-issue-macro-link">
          <IssueTypeIcon type={issue.data.issueType} size={14} />
          <span className="tl-key">{key}</span>
          <span className="tl-issue-macro-summary">{issue.data.summary}</span>
          <StatusLozenge status={issue.data.status} />
        </Link>
      ) : (
        <span className="tl-key">…</span>
      )}
    </NodeViewWrapper>
  );
}

// ---------------------------------------------------------------- issue list

function IssueListView({ node, updateAttributes, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const { query, display, limit } = node.attrs as { query: string; display: string; limit: number };
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [query]);
  const result = useQuery({
    queryKey: ['search', 'macro', query, limit],
    queryFn: () => unwrap(client.POST('/api/v1/search', { body: { query, limit, offset: 0 } })),
    enabled: query.trim() !== '',
    retry: false,
  });
  function apply(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    updateAttributes({ query: draft.trim() });
  }
  return (
    <NodeViewWrapper className="tl-macro tl-issue-list" contentEditable={false}>
      {editor.isEditable && (
        <form onSubmit={apply} className="tl-macro-settings">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('macros.queryPlaceholder')}
            aria-label={t('macros.query')}
            className={`${field} min-w-0 flex-1 font-[family-name:var(--font-mono)]`}
          />
          <select
            value={display}
            aria-label={t('macros.display')}
            onChange={(event) => updateAttributes({ display: event.target.value })}
            className={field}
          >
            <option value="table">{t('macros.displayTable')}</option>
            <option value="count">{t('macros.displayCount')}</option>
          </select>
          <select
            value={limit}
            aria-label={t('macros.limit')}
            onChange={(event) => updateAttributes({ limit: Number(event.target.value) })}
            className={field}
          >
            {[5, 10, 20, 50, 100].map((value) => (
              <option key={value} value={value}>
                {t('macros.limitValue', { count: value })}
              </option>
            ))}
          </select>
          <button type="submit" className={`${field} font-semibold`}>
            {t('macros.apply')}
          </button>
        </form>
      )}
      {!query.trim() ? (
        <p className="tl-macro-hint">{t('macros.queryEmpty')}</p>
      ) : result.isError ? (
        <p className="tl-macro-hint is-error">{result.error.message}</p>
      ) : !result.data ? (
        <p className="tl-macro-hint">…</p>
      ) : display === 'count' ? (
        <Link to="/issues" search={{ q: query }} className="tl-issue-count">
          <strong>{result.data.total}</strong> {t('macros.issues', { count: result.data.total })}
        </Link>
      ) : result.data.issues.length === 0 ? (
        <p className="tl-macro-hint">{t('macros.noIssues')}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t('macros.columns.key')}</th>
              <th>{t('macros.columns.summary')}</th>
              <th>{t('macros.columns.status')}</th>
              <th>{t('macros.columns.assignee')}</th>
            </tr>
          </thead>
          <tbody>
            {result.data.issues.map((issue) => (
              <tr key={issue.id}>
                <td>
                  <Link to="/issues/$key" params={{ key: issue.key }} className="tl-key">
                    {issue.key}
                  </Link>
                </td>
                <td>{issue.summary}</td>
                <td>
                  <StatusLozenge status={issue.status} />
                </td>
                <td>{issue.assignee?.displayName ?? '—'}</td>
              </tr>
            ))}
          </tbody>
          {result.data.total > result.data.issues.length && (
            <tfoot>
              <tr>
                <td colSpan={4}>
                  <Link to="/issues" search={{ q: query }}>
                    {t('macros.showAll', { count: result.data.total })}
                  </Link>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </NodeViewWrapper>
  );
}

// ---------------------------------------------------------------- table of contents

interface Heading {
  level: number;
  text: string;
  pos: number;
}

function headingsOf(editor: Editor, maxLevel: number): Heading[] {
  const list: Heading[] = [];
  editor.state.doc.descendants((child, pos) => {
    if (child.type.name === 'heading' && (child.attrs.level as number) <= maxLevel) {
      list.push({ level: child.attrs.level as number, text: child.textContent, pos });
    }
    // Headings inside boxes and expands count; inside tables they do not.
    return child.type.name !== 'table';
  });
  return list;
}

function TocView({ node, updateAttributes, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const maxLevel = node.attrs.maxLevel as number;
  const [headings, setHeadings] = useState(() => headingsOf(editor, maxLevel));
  useEffect(() => {
    const update = () => setHeadings(headingsOf(editor, maxLevel));
    update();
    editor.on('update', update);
    return () => {
      editor.off('update', update);
    };
  }, [editor, maxLevel]);
  const top = Math.min(...headings.map((heading) => heading.level));
  return (
    <NodeViewWrapper as="nav" className="tl-macro tl-toc" contentEditable={false}>
      <div className="tl-macro-title">
        <ListNumbers size={14} aria-hidden />
        {t('macros.toc')}
        {editor.isEditable && (
          <select
            value={maxLevel}
            aria-label={t('macros.tocLevels')}
            onChange={(event) => updateAttributes({ maxLevel: Number(event.target.value) })}
            className={`${field} ml-auto`}
          >
            {[1, 2, 3, 4].map((value) => (
              <option key={value} value={value}>
                {t('macros.tocLevel', { level: value })}
              </option>
            ))}
          </select>
        )}
      </div>
      {headings.length === 0 ? (
        <p className="tl-macro-hint">{t('macros.tocEmpty')}</p>
      ) : (
        <ol>
          {headings.map((heading) => (
            <li key={heading.pos} style={{ paddingLeft: `${(heading.level - top) * 1.25}rem` }}>
              <button
                type="button"
                onClick={() =>
                  (editor.view.nodeDOM(heading.pos) as HTMLElement | null)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  })
                }
              >
                {heading.text || '—'}
              </button>
            </li>
          ))}
        </ol>
      )}
    </NodeViewWrapper>
  );
}

// ---------------------------------------------------------------- child pages

function ChildList({
  nodes,
  spaceKey,
  depth,
}: {
  nodes: TreeNode[];
  spaceKey: string;
  depth: number;
}) {
  return (
    <ul>
      {nodes.map((child) => (
        <li key={child.page.id}>
          <Link to="/spaces/$key/pages/$id" params={{ key: spaceKey, id: child.page.id }}>
            <FileText size={14} aria-hidden />
            {child.page.title}
          </Link>
          {depth > 1 && child.children.length > 0 && (
            <ChildList nodes={child.children} spaceKey={spaceKey} depth={depth - 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

function ChildPagesView({ node, updateAttributes, editor, extension }: NodeViewProps) {
  const { t } = useTranslation();
  const { spaceKey, pageId } = extension.options as {
    spaceKey: string | null;
    pageId: string | null;
  };
  const depth = node.attrs.depth as number;
  const tree = useQuery({ ...pageTreeQuery(spaceKey ?? ''), enabled: spaceKey !== null });
  const children = useMemo(() => {
    const find = (nodes: TreeNode[]): TreeNode | undefined => {
      for (const entry of nodes) {
        if (entry.page.id === pageId) return entry;
        const inner = find(entry.children);
        if (inner) return inner;
      }
      return undefined;
    };
    return find(nest(tree.data ?? []))?.children ?? [];
  }, [tree.data, pageId]);
  return (
    <NodeViewWrapper as="nav" className="tl-macro tl-children" contentEditable={false}>
      <div className="tl-macro-title">
        <TreeStructure size={14} aria-hidden />
        {t('macros.children')}
        {editor.isEditable && (
          <select
            value={depth}
            aria-label={t('macros.childrenDepth')}
            onChange={(event) => updateAttributes({ depth: Number(event.target.value) })}
            className={`${field} ml-auto`}
          >
            {[1, 2, 3].map((value) => (
              <option key={value} value={value}>
                {t('macros.childrenLevel', { count: value })}
              </option>
            ))}
          </select>
        )}
      </div>
      {!spaceKey ? (
        <p className="tl-macro-hint">{t('macros.childrenOnlyWiki')}</p>
      ) : children.length === 0 ? (
        <p className="tl-macro-hint">{t('macros.childrenEmpty')}</p>
      ) : (
        <ChildList nodes={children} spaceKey={spaceKey} depth={depth} />
      )}
    </NodeViewWrapper>
  );
}

// ---------------------------------------------------------------- status

function StatusView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const { t } = useTranslation();
  const { text, color } = node.attrs as { text: string; color: string };
  return (
    <NodeViewWrapper as="span" className="tl-status-wrap">
      <span className="tl-status" data-status={color}>
        {text || t('macros.statusPlaceholder')}
      </span>
      {editor.isEditable && selected && (
        <span className="tl-status-editor" contentEditable={false}>
          <input
            value={text}
            maxLength={40}
            onChange={(event) => updateAttributes({ text: event.target.value })}
            aria-label={t('macros.statusText')}
            className={field}
          />
          {STATUS_COLORS.map((value) => (
            <button
              key={value}
              type="button"
              aria-label={t(`macros.colors.${value}`)}
              title={t(`macros.colors.${value}`)}
              aria-pressed={value === color}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => updateAttributes({ color: value })}
              className="tl-status-swatch"
              data-status={value}
            />
          ))}
        </span>
      )}
    </NodeViewWrapper>
  );
}

// ---------------------------------------------------------------- expand

function ExpandView({ node, updateAttributes, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const title = String(node.attrs.title ?? '');
  if (editor.isEditable) {
    return (
      <NodeViewWrapper className="tl-expand is-editing">
        <div className="tl-expand-head" contentEditable={false}>
          <CaretDown size={14} aria-hidden />
          <input
            value={title}
            maxLength={200}
            placeholder={t('macros.expandTitle')}
            aria-label={t('macros.expandTitle')}
            onChange={(event) => updateAttributes({ title: event.target.value })}
            className="tl-expand-title-input"
          />
        </div>
        <NodeViewContent className="tl-expand-body" />
      </NodeViewWrapper>
    );
  }
  return (
    <NodeViewWrapper className="tl-expand">
      <button
        type="button"
        className="tl-expand-head"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        contentEditable={false}
      >
        {open ? <CaretDown size={14} aria-hidden /> : <CaretRight size={14} aria-hidden />}
        {title || t('macros.expandDefault')}
      </button>
      <NodeViewContent className="tl-expand-body" hidden={!open} />
    </NodeViewWrapper>
  );
}

// ---------------------------------------------------------------- code block

const LANGUAGES = [
  'plaintext',
  'bash',
  'css',
  'go',
  'java',
  'javascript',
  'json',
  'kotlin',
  'markdown',
  'php',
  'python',
  'ruby',
  'rust',
  'sql',
  'typescript',
  'xml',
  'yaml',
];

function CodeBlockView({ node, updateAttributes, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const { language, title, lineNumbers, collapsed } = node.attrs as {
    language: string | null;
    title: string | null;
    lineNumbers: boolean;
    collapsed: boolean;
  };
  const [open, setOpen] = useState(!collapsed);
  const lines = Math.max(1, node.textContent.split('\n').length);
  const editable = editor.isEditable;
  const shown = editable || open;
  return (
    <NodeViewWrapper className="tl-code" data-line-numbers={lineNumbers || undefined}>
      {(editable || title || collapsed) && (
        <div className="tl-code-head" contentEditable={false}>
          {editable ? (
            <>
              <input
                value={title ?? ''}
                maxLength={200}
                placeholder={t('macros.codeTitle')}
                aria-label={t('macros.codeTitle')}
                onChange={(event) => updateAttributes({ title: event.target.value || null })}
                className="tl-code-title-input"
              />
              <select
                value={language ?? 'plaintext'}
                aria-label={t('macros.codeLanguage')}
                onChange={(event) =>
                  updateAttributes({
                    language: event.target.value === 'plaintext' ? null : event.target.value,
                  })
                }
                className={field}
              >
                {[...new Set([...LANGUAGES, language ?? 'plaintext'])].map((value) => (
                  <option key={value} value={value}>
                    {value === 'plaintext' ? t('macros.plainText') : value}
                  </option>
                ))}
              </select>
              <label className="tl-code-option">
                <input
                  type="checkbox"
                  checked={lineNumbers}
                  onChange={(event) => updateAttributes({ lineNumbers: event.target.checked })}
                />
                {t('macros.lineNumbers')}
              </label>
              <label className="tl-code-option">
                <input
                  type="checkbox"
                  checked={collapsed}
                  onChange={(event) => updateAttributes({ collapsed: event.target.checked })}
                />
                {t('macros.collapsed')}
              </label>
            </>
          ) : (
            <>
              <span className="tl-code-title">{title}</span>
              {collapsed && (
                <button type="button" onClick={() => setOpen((value) => !value)}>
                  {open ? t('macros.collapse') : t('macros.expandLines', { count: lines })}
                </button>
              )}
            </>
          )}
        </div>
      )}
      <pre hidden={!shown}>
        {lineNumbers && (
          <span className="tl-code-gutter" aria-hidden contentEditable={false}>
            {Array.from({ length: lines }, (_, index) => index + 1).join('\n')}
          </span>
        )}
        <NodeViewContent<'code'> as="code" className={language ? `language-${language}` : ''} />
      </pre>
    </NodeViewWrapper>
  );
}

/** The browser views of all macros, for editors and readers alike. */
export const macroViews = {
  issue: ReactNodeViewRenderer(IssueView, { as: 'span' }),
  issueList: ReactNodeViewRenderer(IssueListView),
  tableOfContents: ReactNodeViewRenderer(TocView),
  childPages: ReactNodeViewRenderer(ChildPagesView),
  status: ReactNodeViewRenderer(StatusView, { as: 'span' }),
  expand: ReactNodeViewRenderer(ExpandView),
  codeBlock: ReactNodeViewRenderer(CodeBlockView),
};
