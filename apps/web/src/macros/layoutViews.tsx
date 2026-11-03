import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { Editor } from '@tiptap/core';
import {
  NodeViewContent,
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react';
import type { LabelledPage, RichText } from '@toolvibes/shared';
import { createContext, type FormEvent, type ReactNode, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppFrame, appsQuery } from '../features/apps/AppFrame';
import { SeriesChart } from '../features/reports/analysis';
import { RichTextView } from '../features/tracking/RichTextEditor';
import { client, unwrap } from '../lib/api';
import { formatDate, formatRelative } from '../lib/format';
import { everythingQuery } from '../lib/search';
import { labelPagesQuery, pageAttachmentsQuery, pageQuery } from '../lib/wiki';
import { DiagramView } from './DiagramView';

/** Wiki macros of TL-26 (E-107): live with the reader's permissions, nothing copied. */

const field =
  'h-7 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-1.5 text-sm';

/** How deep includes nest; a page including itself stops at 3 (E-107). */
const IncludeDepth = createContext(0);

/** The page the editor shows, from the child-pages extension's options. */
function pageOf(editor: Editor): { spaceKey: string | null; pageId: string | null } {
  const extension = editor.extensionManager.extensions.find((entry) => entry.name === 'childPages');
  return (
    (extension?.options as { spaceKey: string | null; pageId: string | null }) ?? {
      spaceKey: null,
      pageId: null,
    }
  );
}

/** Settings for editors: text inputs for the given attributes, applied together. */
function Settings({
  node,
  updateAttributes,
  editor,
  fields,
}: Pick<NodeViewProps, 'node' | 'updateAttributes' | 'editor'> & {
  fields: { key: string; label: string; placeholder?: string; type?: 'number' }[];
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((entry) => [entry.key, String(node.attrs[entry.key] ?? '')])),
  );
  if (!editor.isEditable) return null;
  const apply = (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    updateAttributes(
      Object.fromEntries(
        fields.map((entry) => [
          entry.key,
          entry.type === 'number'
            ? Math.max(1, Number(draft[entry.key]) || 10)
            : (draft[entry.key] ?? '').trim(),
        ]),
      ),
    );
  };
  return (
    <form onSubmit={apply} className="tl-macro-settings">
      {fields.map((entry) => (
        <input
          key={entry.key}
          value={draft[entry.key] ?? ''}
          type={entry.type ?? 'text'}
          aria-label={entry.label}
          placeholder={entry.placeholder ?? entry.label}
          onChange={(event) => setDraft({ ...draft, [entry.key]: event.target.value })}
          className={`${field} min-w-0 flex-1`}
        />
      ))}
      <button type="submit" className={`${field} font-semibold`}>
        {t('macros.apply')}
      </button>
    </form>
  );
}

function Hint({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <p className={`tl-macro-hint ${error ? 'is-error' : ''}`}>{children}</p>;
}

function PageList({ pages }: { pages: LabelledPage[] }) {
  const { t } = useTranslation();
  if (pages.length === 0) return <Hint>{t('wikiMacros.noPages')}</Hint>;
  return (
    <ul className="tl-macro-list">
      {pages.map((page) => (
        <li key={page.id}>
          <Link to="/spaces/$key/pages/$id" params={{ key: page.space.key, id: page.id }}>
            {page.title}
          </Link>
          <span className="text-xs text-[var(--ink-muted)]">
            {' '}
            · {page.space.name}
            {page.publishedAt && ` · ${formatRelative(page.publishedAt)}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The published content of another page, or of one of its excerpts. */
function Included({ pageId, excerpt }: { pageId: string; excerpt?: string }) {
  const { t } = useTranslation();
  const depth = useContext(IncludeDepth);
  const page = useQuery({ ...pageQuery(pageId), enabled: !!pageId && depth < 3, retry: false });
  if (!pageId) return <Hint>{t('wikiMacros.choosePage')}</Hint>;
  if (depth >= 3) return <Hint>{t('wikiMacros.tooDeep')}</Hint>;
  if (page.isError) return <Hint error>{t('wikiMacros.unavailable')}</Hint>;
  if (!page.data) return <Hint>…</Hint>;
  const content = page.data.content;
  if (!content || typeof content !== 'object') return <Hint>{t('wikiMacros.empty')}</Hint>;
  let doc = content as RichText;
  if (excerpt !== undefined) {
    type Json = { type?: string; attrs?: Record<string, unknown>; content?: Json[] };
    let found: Json | undefined;
    const walk = (node: Json) => {
      if (found) return;
      if (node.type === 'excerpt' && (!excerpt || node.attrs?.name === excerpt)) found = node;
      else for (const child of node.content ?? []) walk(child);
    };
    walk(doc as Json);
    if (!found) return <Hint>{t('wikiMacros.noExcerpt')}</Hint>;
    doc = { type: 'doc', content: found.content ?? [] };
  }
  return (
    <IncludeDepth.Provider value={depth + 1}>
      <div className="tl-include">
        <RichTextView
          doc={doc}
          page={{ spaceKey: page.data.space.key, pageId: page.data.id }}
          liveKeys
        />
        <Link
          to="/spaces/$key/pages/$id"
          params={{ key: page.data.space.key, id: page.data.id }}
          className="text-xs"
        >
          {t('wikiMacros.from', { title: page.data.title })}
        </Link>
      </div>
    </IncludeDepth.Provider>
  );
}

/** Finding a page by title for include macros; stores its id. */
function PagePicker({ onPick }: { onPick: (id: string) => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const found = useQuery(everythingQuery(q, 'page'));
  return (
    <div className="tl-macro-settings flex-col items-stretch">
      <input
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder={t('wikiMacros.searchPage')}
        aria-label={t('wikiMacros.searchPage')}
        className={field}
      />
      {q.trim() && (
        <ul className="m-0 flex list-none flex-col p-0">
          {(found.data?.pages ?? []).slice(0, 8).map((page) => (
            <li key={page.id}>
              <button
                type="button"
                className="text-left text-sm hover:underline"
                onClick={() => onPick(page.id)}
              >
                {page.title} <span className="text-[var(--ink-muted)]">· {page.space.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IncludeView({ node, updateAttributes, editor }: NodeViewProps) {
  const excerpt = node.type.name === 'excerptInclude';
  const page = String(node.attrs.page ?? '');
  const { t } = useTranslation();
  return (
    <NodeViewWrapper className="tl-macro" contentEditable={false}>
      {editor.isEditable && (
        <>
          <PagePicker onPick={(id) => updateAttributes({ page: id })} />
          {excerpt && (
            <Settings
              node={node}
              updateAttributes={updateAttributes}
              editor={editor}
              fields={[{ key: 'name', label: t('wikiMacros.excerptName') }]}
            />
          )}
        </>
      )}
      <Included pageId={page} excerpt={excerpt ? String(node.attrs.name ?? '') : undefined} />
    </NodeViewWrapper>
  );
}

function PropertiesReportView({ node, updateAttributes, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const label = String(node.attrs.label ?? '');
  const space = String(node.attrs.space ?? '');
  const report = useQuery({
    queryKey: ['wiki-macro', 'properties', label, space],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/wiki/page-properties', {
          params: { query: { label, ...(space ? { space } : {}) } },
        }),
      ),
    enabled: !!label,
    retry: false,
  });
  return (
    <NodeViewWrapper className="tl-macro" contentEditable={false}>
      <Settings
        node={node}
        updateAttributes={updateAttributes}
        editor={editor}
        fields={[
          { key: 'label', label: t('wikiMacros.label') },
          { key: 'space', label: t('wikiMacros.space'), placeholder: t('wikiMacros.allSpaces') },
        ]}
      />
      {!label ? (
        <Hint>{t('wikiMacros.chooseLabel')}</Hint>
      ) : report.isError ? (
        <Hint error>{report.error.message}</Hint>
      ) : !report.data ? (
        <Hint>…</Hint>
      ) : report.data.rows.length === 0 ? (
        <Hint>{t('wikiMacros.noPages')}</Hint>
      ) : (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>{t('wikiMacros.page')}</th>
                {report.data.keys.map((key) => (
                  <th key={key}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.data.rows.map((row) => (
                <tr key={row.page.id}>
                  <td>
                    <Link
                      to="/spaces/$key/pages/$id"
                      params={{ key: row.page.spaceKey, id: row.page.id }}
                    >
                      {row.page.title}
                    </Link>
                  </td>
                  {report.data.keys.map((key) => (
                    <td key={key}>{row.values[key] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </NodeViewWrapper>
  );
}

function ContentByLabelView({ node, updateAttributes, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const labels = String(node.attrs.labels ?? '')
    .split(/[\s,]+/)
    .filter(Boolean);
  const space = String(node.attrs.space ?? '') || undefined;
  const first = labels[0] ?? '';
  const result = useQuery({ ...labelPagesQuery(first, space), enabled: !!first });
  const limit = Number(node.attrs.limit) || 10;
  // Pages need every given label.
  const pages = (result.data ?? [])
    .filter((page) => labels.every((label) => page.labels.includes(label.toLowerCase())))
    .slice(0, limit);
  return (
    <NodeViewWrapper className="tl-macro" contentEditable={false}>
      <Settings
        node={node}
        updateAttributes={updateAttributes}
        editor={editor}
        fields={[
          { key: 'labels', label: t('wikiMacros.labels') },
          { key: 'space', label: t('wikiMacros.space'), placeholder: t('wikiMacros.allSpaces') },
          { key: 'limit', label: t('wikiMacros.limit'), type: 'number' },
        ]}
      />
      {!first ? (
        <Hint>{t('wikiMacros.chooseLabel')}</Hint>
      ) : result.data ? (
        <PageList pages={pages} />
      ) : (
        <Hint>…</Hint>
      )}
    </NodeViewWrapper>
  );
}

function RecentlyUpdatedView({ node, updateAttributes, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const space = String(node.attrs.space ?? '');
  const limit = Number(node.attrs.limit) || 10;
  const result = useQuery({
    queryKey: ['wiki-macro', 'recent', space, limit],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/wiki/recent-pages', {
          params: { query: { limit, ...(space ? { space } : {}) } },
        }),
      ),
    retry: false,
  });
  return (
    <NodeViewWrapper className="tl-macro" contentEditable={false}>
      <Settings
        node={node}
        updateAttributes={updateAttributes}
        editor={editor}
        fields={[
          { key: 'space', label: t('wikiMacros.space'), placeholder: t('wikiMacros.allSpaces') },
          { key: 'limit', label: t('wikiMacros.limit'), type: 'number' },
        ]}
      />
      {result.isError ? (
        <Hint error>{result.error.message}</Hint>
      ) : result.data ? (
        <PageList pages={result.data} />
      ) : (
        <Hint>…</Hint>
      )}
    </NodeViewWrapper>
  );
}

function TaskReportView({ node, updateAttributes, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const space = String(node.attrs.space ?? '');
  const assignee = node.attrs.assignee === 'me' ? 'me' : 'all';
  const tasks = useQuery({
    queryKey: ['wiki-macro', 'tasks', space, assignee],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/wiki/tasks', {
          params: { query: { assignee, limit: 50, ...(space ? { space } : {}) } },
        }),
      ),
    retry: false,
  });
  return (
    <NodeViewWrapper className="tl-macro" contentEditable={false}>
      {editor.isEditable && (
        <div className="tl-macro-settings">
          <Settings
            node={node}
            updateAttributes={updateAttributes}
            editor={editor}
            fields={[
              {
                key: 'space',
                label: t('wikiMacros.space'),
                placeholder: t('wikiMacros.allSpaces'),
              },
            ]}
          />
          <select
            value={assignee}
            aria-label={t('wikiMacros.assignee')}
            onChange={(event) => updateAttributes({ assignee: event.target.value })}
            className={field}
          >
            <option value="all">{t('wikiMacros.allTasks')}</option>
            <option value="me">{t('wikiMacros.myTasks')}</option>
          </select>
        </div>
      )}
      {tasks.isError ? (
        <Hint error>{tasks.error.message}</Hint>
      ) : !tasks.data ? (
        <Hint>…</Hint>
      ) : tasks.data.length === 0 ? (
        <Hint>{t('wikiMacros.noTasks')}</Hint>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t('wikiMacros.task')}</th>
              <th>{t('wikiMacros.assignee')}</th>
              <th>{t('wikiMacros.due')}</th>
              <th>{t('wikiMacros.page')}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.data.map((task) => (
              <tr key={`${task.page.id}:${task.text}`}>
                <td>{task.text}</td>
                <td>{task.assignees.map((user) => user.displayName).join(', ') || '–'}</td>
                <td>{task.due ? formatDate(task.due) : '–'}</td>
                <td>
                  <Link
                    to="/spaces/$key/pages/$id"
                    params={{ key: task.page.spaceKey, id: task.page.id }}
                  >
                    {task.page.title}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </NodeViewWrapper>
  );
}

function AttachmentListView({ node, updateAttributes, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const { pageId } = pageOf(editor);
  const images = node.attrs.images === true;
  const list = useQuery({ ...pageAttachmentsQuery(pageId ?? ''), enabled: !!pageId });
  const shown = (list.data ?? []).filter((attachment) => !images || attachment.image);
  return (
    <NodeViewWrapper className="tl-macro" contentEditable={false}>
      {editor.isEditable && (
        <label className="tl-macro-settings">
          <input
            type="checkbox"
            checked={images}
            onChange={(event) => updateAttributes({ images: event.target.checked })}
          />
          {t('wikiMacros.gallery')}
        </label>
      )}
      {!pageId ? (
        <Hint>{t('wikiMacros.onPagesOnly')}</Hint>
      ) : shown.length === 0 ? (
        <Hint>{t('wikiMacros.noAttachments')}</Hint>
      ) : images ? (
        <div className="tl-gallery">
          {shown.map((attachment) => (
            <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer">
              <img
                src={attachment.url}
                alt={attachment.fileName}
                loading="lazy"
                className="h-[120px] w-full rounded-[var(--radius-md)] object-cover"
              />
            </a>
          ))}
        </div>
      ) : (
        <ul className="tl-macro-list">
          {shown.map((attachment) => (
            <li key={attachment.id}>
              <a href={`${attachment.url}?download=1`}>{attachment.fileName}</a>
              <span className="text-xs text-[var(--ink-muted)]">
                {' '}
                · {Math.max(1, Math.round(attachment.size / 1024))} KB ·{' '}
                {formatRelative(attachment.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </NodeViewWrapper>
  );
}

function DocumentPreviewView({ node, updateAttributes, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const { pageId } = pageOf(editor);
  const list = useQuery({ ...pageAttachmentsQuery(pageId ?? ''), enabled: !!pageId });
  const id = String(node.attrs.attachment ?? '');
  const attachment = (list.data ?? []).find((entry) => entry.id === id);
  return (
    <NodeViewWrapper className="tl-macro" contentEditable={false}>
      {editor.isEditable && (
        <div className="tl-macro-settings">
          <select
            value={id}
            aria-label={t('wikiMacros.attachment')}
            onChange={(event) => updateAttributes({ attachment: event.target.value })}
            className={field}
          >
            <option value="">{t('wikiMacros.chooseAttachment')}</option>
            {(list.data ?? []).map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.fileName}
              </option>
            ))}
          </select>
        </div>
      )}
      {!attachment ? (
        <Hint>{t('wikiMacros.chooseAttachment')}</Hint>
      ) : attachment.image ? (
        <img
          src={attachment.url}
          alt={attachment.fileName}
          className="max-h-[480px] rounded-[var(--radius-md)]"
        />
      ) : (
        <a href={`${attachment.url}?download=1`} className="tl-file-card">
          <strong>{attachment.fileName}</strong>
          <span>
            {attachment.contentType} · {Math.max(1, Math.round(attachment.size / 1024))} KB
          </span>
        </a>
      )}
    </NodeViewWrapper>
  );
}

/** Embeddable form of known video links; other allowed pages as they are. */
function embedSource(url: URL): string {
  if (url.hostname.endsWith('youtube.com') && url.searchParams.get('v')) {
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(url.searchParams.get('v') ?? '')}`;
  }
  if (url.hostname === 'vimeo.com') return `https://player.vimeo.com/video${url.pathname}`;
  return url.toString();
}

function EmbedView({ node, updateAttributes, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const hosts = useQuery({
    queryKey: ['wiki', 'embed-hosts'],
    queryFn: () => unwrap(client.GET('/api/v1/wiki/embed-hosts')),
    staleTime: 300_000,
  });
  const raw = String(node.attrs.url ?? '');
  let url: URL | null = null;
  try {
    url = raw ? new URL(raw) : null;
  } catch {
    url = null;
  }
  const allowed =
    url?.protocol === 'https:' &&
    (hosts.data?.hosts ?? []).some(
      (host) =>
        url?.hostname === host ||
        url?.hostname.endsWith(`.${host}`) ||
        (host.startsWith('www.') && url?.hostname === host.slice(4)),
    );
  const height = Math.min(1200, Math.max(120, Number(node.attrs.height) || 400));
  return (
    <NodeViewWrapper className="tl-macro" contentEditable={false}>
      <Settings
        node={node}
        updateAttributes={updateAttributes}
        editor={editor}
        fields={[
          { key: 'url', label: t('wikiMacros.url'), placeholder: 'https://' },
          { key: 'height', label: t('wikiMacros.height'), type: 'number' },
        ]}
      />
      {!url ? (
        <Hint>{t('wikiMacros.chooseUrl')}</Hint>
      ) : allowed ? (
        <iframe
          src={embedSource(url)}
          title={url.hostname}
          height={height}
          className="w-full rounded-[var(--radius-md)] border-0"
          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <Hint>
          <a href={url.toString()} target="_blank" rel="noreferrer">
            {url.toString()}
          </a>{' '}
          · {t('wikiMacros.notAllowed')}
        </Hint>
      )}
    </NodeViewWrapper>
  );
}

/** A macro of an installed app (TL-50, E-140): chosen while editing, shown in its iframe. */
function AppMacroView({ node, updateAttributes, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const apps = useQuery(appsQuery).data;
  const choices = (apps ?? []).flatMap((app) =>
    app.modules.macros.map((module) => ({ app, module })),
  );
  const chosen = choices.find(
    (choice) => choice.app.key === node.attrs.app && choice.module.key === node.attrs.module,
  );
  return (
    <NodeViewWrapper className="tl-macro" contentEditable={false}>
      {editor.isEditable && (
        <div className="tl-macro-settings">
          <select
            aria-label={t('apps.macroModule')}
            value={chosen ? `${chosen.app.key}:${chosen.module.key}` : ''}
            onChange={(event) => {
              const [app = '', module = ''] = event.target.value.split(':');
              updateAttributes({ app, module });
            }}
            className={`${field} min-w-0 flex-1`}
          >
            <option value="">{t('apps.chooseMacro')}</option>
            {choices.map(({ app, module }) => (
              <option key={`${app.key}:${module.key}`} value={`${app.key}:${module.key}`}>
                {app.name}: {module.title}
              </option>
            ))}
          </select>
        </div>
      )}
      <Settings
        node={node}
        updateAttributes={updateAttributes}
        editor={editor}
        fields={[
          { key: 'config', label: t('apps.macroConfig') },
          { key: 'height', label: t('wikiMacros.height'), type: 'number' },
        ]}
      />
      {chosen ? (
        <AppFrame
          app={chosen.app}
          module={chosen.module}
          height={Math.min(1200, Math.max(60, Number(node.attrs.height) || 300))}
          place={{
            kind: 'macro',
            pageId: pageOf(editor).pageId ?? undefined,
            config: String(node.attrs.config ?? ''),
          }}
        />
      ) : (
        apps && <Hint>{node.attrs.app ? t('apps.unavailable') : t('apps.chooseMacro')}</Hint>
      )}
    </NodeViewWrapper>
  );
}

function LiveSearchView({ node, updateAttributes, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const space = String(node.attrs.space ?? '');
  const [q, setQ] = useState('');
  const found = useQuery(everythingQuery(q, 'page'));
  const pages = (found.data?.pages ?? []).filter((page) => !space || page.space.key === space);
  return (
    <NodeViewWrapper className="tl-macro" contentEditable={false}>
      <Settings
        node={node}
        updateAttributes={updateAttributes}
        editor={editor}
        fields={[
          { key: 'space', label: t('wikiMacros.space'), placeholder: t('wikiMacros.allSpaces') },
        ]}
      />
      <input
        type="search"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder={space ? t('wikiMacros.searchIn', { space }) : t('wikiMacros.searchAll')}
        aria-label={t('wikiMacros.searchAll')}
        className={`${field} w-full`}
      />
      {q.trim() && (
        <ul className="tl-macro-list">
          {pages.slice(0, 10).map((page) => (
            <li key={page.id}>
              <Link to="/spaces/$key/pages/$id" params={{ key: page.space.key, id: page.id }}>
                {page.title}
              </Link>
              <span className="text-xs text-[var(--ink-muted)]"> · {page.space.name}</span>
            </li>
          ))}
          {found.data && pages.length === 0 && (
            <li className="text-[var(--ink-muted)]">{t('wikiMacros.noPages')}</li>
          )}
        </ul>
      )}
    </NodeViewWrapper>
  );
}

type Json = { type?: string; text?: string; content?: Json[] };
const textOf = (node: Json): string =>
  node.text ?? (node.content ?? []).map(textOf).join(' ').trim();

/** Shares of the first data column; eight colours at most, the rest as "other" (E-101). */
function Donut({
  slices,
  ariaLabel,
}: {
  slices: { label: string; value: number }[];
  ariaLabel: string;
}) {
  const { t } = useTranslation();
  const shown = slices.length > 8 ? slices.slice(0, 7) : slices;
  const rest = slices.slice(shown.length).reduce((sum, slice) => sum + slice.value, 0);
  const all = [...shown, ...(rest > 0 ? [{ label: t('dashboards.other'), value: rest }] : [])];
  const sum = all.reduce((total, slice) => total + Math.max(0, slice.value), 0) || 1;
  let angle = -Math.PI / 2;
  const point = (r: number, a: number) => `${80 + r * Math.cos(a)} ${80 + r * Math.sin(a)}`;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 160 160" className="size-36" role="img" aria-label={ariaLabel}>
        {all.map((slice, index) => {
          const sweep = (Math.max(0, slice.value) / sum) * Math.PI * 2;
          const start = angle;
          angle += sweep;
          const large = sweep > Math.PI ? 1 : 0;
          const color = index === 7 ? 'var(--border-strong)' : `var(--series-${index + 1})`;
          return (
            <path
              key={slice.label}
              d={
                sweep >= Math.PI * 2 - 0.0001
                  ? `M ${point(60, 0)} A 60 60 0 1 1 ${point(60, Math.PI)} A 60 60 0 1 1 ${point(60, 0)} M ${point(36, 0)} A 36 36 0 1 0 ${point(36, Math.PI)} A 36 36 0 1 0 ${point(36, 0)} Z`
                  : `M ${point(60, start)} A 60 60 0 ${large} 1 ${point(60, angle)} L ${point(36, angle)} A 36 36 0 ${large} 0 ${point(36, start)} Z`
              }
              fill={color}
              fillRule="evenodd"
              stroke="var(--surface-1)"
              strokeWidth="2"
            >
              <title>{`${slice.label}: ${slice.value}`}</title>
            </path>
          );
        })}
      </svg>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
        {all.map((slice, index) => (
          <li key={slice.label} className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-[2px]"
              style={{
                background: index === 7 ? 'var(--border-strong)' : `var(--series-${index + 1})`,
              }}
              aria-hidden
            />
            {slice.label}
            <span className="font-[family-name:var(--font-mono)] text-[var(--ink-muted)]">
              {slice.value} · {Math.round((Math.max(0, slice.value) / sum) * 100)} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A chart from the table inside it: first column labels, other columns series (W-MAC-12). */
function ChartView({ node, updateAttributes, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const type = String(node.attrs.type ?? 'bar');
  let table: Json | undefined;
  node.descendants((child) => {
    if (!table && child.type.name === 'table') table = child.toJSON() as Json;
    return !table;
  });
  const rows = (table?.content ?? []).map((row) => (row.content ?? []).map(textOf));
  const [head, ...body] = rows;
  const labels = body.map((row) => row[0] ?? '');
  const series = (head ?? []).slice(1).map((name, index) => ({
    label: name || `${index + 1}`,
    values: body.map((row) => Number((row[index + 1] ?? '').replace(',', '.')) || 0),
  }));
  return (
    <NodeViewWrapper className="tl-macro tl-chart-macro">
      {editor.isEditable && (
        <div className="tl-macro-settings" contentEditable={false}>
          <select
            value={type}
            aria-label={t('wikiMacros.chartType')}
            onChange={(event) => updateAttributes({ type: event.target.value })}
            className={field}
          >
            <option value="bar">{t('wikiMacros.charts.bar')}</option>
            <option value="line">{t('wikiMacros.charts.line')}</option>
            <option value="pie">{t('wikiMacros.charts.pie')}</option>
          </select>
        </div>
      )}
      <div contentEditable={false}>
        {series.length === 0 || labels.length === 0 ? (
          <Hint>{t('wikiMacros.chartHint')}</Hint>
        ) : type === 'pie' ? (
          <Donut
            slices={labels.map((label, index) => ({
              label,
              value: series[0]?.values[index] ?? 0,
            }))}
            ariaLabel={t('wikiMacros.chartLabel', { count: labels.length })}
          />
        ) : (
          <SeriesChart
            mode={type === 'line' ? 'lines' : 'bars'}
            labels={labels}
            series={series}
            ariaLabel={t('wikiMacros.chartLabel', { count: labels.length })}
          />
        )}
      </div>
      <NodeViewContent className="tl-chart-data" />
    </NodeViewWrapper>
  );
}

export const layoutViews = {
  includePage: ReactNodeViewRenderer(IncludeView),
  excerptInclude: ReactNodeViewRenderer(IncludeView),
  propertiesReport: ReactNodeViewRenderer(PropertiesReportView),
  contentByLabel: ReactNodeViewRenderer(ContentByLabelView),
  recentlyUpdated: ReactNodeViewRenderer(RecentlyUpdatedView),
  taskReport: ReactNodeViewRenderer(TaskReportView),
  attachmentList: ReactNodeViewRenderer(AttachmentListView),
  documentPreview: ReactNodeViewRenderer(DocumentPreviewView),
  embed: ReactNodeViewRenderer(EmbedView),
  liveSearch: ReactNodeViewRenderer(LiveSearchView),
  appMacro: ReactNodeViewRenderer(AppMacroView),
  diagram: ReactNodeViewRenderer(DiagramView),
  chart: ReactNodeViewRenderer(ChartView),
};

let mermaidCounter = 0;

/** A Mermaid diagram from a code block (W-MAC-17); loaded only where one is shown. */
export function MermaidDiagram({ code }: { code: string }) {
  const { t } = useTranslation();
  const diagram = useQuery({
    queryKey: ['mermaid', code],
    queryFn: async () => {
      const { default: mermaid } = await import('mermaid');
      const dark =
        document.documentElement.dataset.theme === 'dark' ||
        (document.documentElement.dataset.theme !== 'light' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);
      // Strict: no scripts or HTML labels from the diagram text.
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: dark ? 'dark' : 'default',
      });
      mermaidCounter += 1;
      return (await mermaid.render(`tl-mermaid-${mermaidCounter}`, code)).svg;
    },
    enabled: code.trim() !== '',
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  if (diagram.isError)
    return <Hint error>{t('wikiMacros.mermaidError', { message: diagram.error.message })}</Hint>;
  if (!diagram.data) return null;
  return (
    <div
      className="tl-mermaid"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid renders in strict mode and sanitises its SVG
      dangerouslySetInnerHTML={{ __html: diagram.data }}
    />
  );
}
