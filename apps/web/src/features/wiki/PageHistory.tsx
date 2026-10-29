import { ArrowCounterClockwise, CheckSquare, Image, Square } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type {
  DiffBlock,
  DiffBlockContent as DiffContent,
  PageVersionSummary,
  RichText,
} from '@tasklore/shared';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { pageQuery, pageVersionsQuery } from '../../lib/wiki';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';
import { RichTextView } from '../tracking/RichTextEditor';

const tone = {
  same: '',
  added: 'bg-[var(--success-soft)] text-[var(--ink)]',
  removed: 'bg-[var(--danger-soft)] text-[var(--ink-muted)] line-through',
} as const;

/** One block of a version as plain structure: heading size, bullet, checkbox, cells, image. */
function BlockShape({ block, children }: { block: DiffContent; children: ReactNode }) {
  const indent = { paddingLeft: `${block.depth * 1.5}rem` };
  switch (block.type) {
    case 'heading':
      return (
        <div
          className={`font-semibold ${block.level === 1 ? 'text-2xl' : block.level === 2 ? 'text-xl' : 'text-lg'}`}
        >
          {children}
        </div>
      );
    case 'listItem':
      return (
        <div className="flex gap-2" style={indent}>
          <span aria-hidden>•</span>
          <span>{children}</span>
        </div>
      );
    case 'taskItem': {
      const Box = block.checked ? CheckSquare : Square;
      return (
        <div className="flex items-start gap-2" style={indent}>
          <Box size={18} className="mt-1 shrink-0" aria-label={block.checked ? '☑' : '☐'} />
          <span>{children}</span>
        </div>
      );
    }
    case 'quote':
      return <div className="border-l-2 border-[var(--border-strong)] pl-3">{children}</div>;
    case 'codeBlock':
      return (
        <pre className="m-0 overflow-x-auto rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2 font-[family-name:var(--font-mono)] text-sm whitespace-pre-wrap">
          {children}
        </pre>
      );
    case 'rule':
      return <hr className="border-[var(--border)]" />;
    case 'image':
      return (
        <div className="flex items-center gap-2 text-sm">
          <Image size={18} aria-hidden />
          {children}
        </div>
      );
    default:
      return <div>{children}</div>;
  }
}

/** Table rows show their cells side by side; other blocks their text. */
function BlockText({
  block,
  words,
}: {
  block: DiffContent;
  words?: Extract<DiffBlock, { op: 'changed' }>;
}) {
  const { t } = useTranslation();
  if (block.type === 'tableRow' && block.cells && !words) {
    return (
      <div
        className="grid gap-px rounded-[var(--radius-sm)] bg-[var(--border)] text-sm"
        style={{ gridTemplateColumns: `repeat(${block.cells.length}, minmax(0, 1fr))` }}
      >
        {block.cells.map((cell, index) => (
          <span
            // Cells have no identity of their own; their position is what they are.
            // biome-ignore lint/suspicious/noArrayIndexKey: position is the identity
            key={index}
            className={`bg-[var(--surface-1)] px-2 py-1 ${block.header ? 'font-semibold' : ''}`}
          >
            {cell}
          </span>
        ))}
      </div>
    );
  }
  if (words) {
    return (
      <>
        {words.words.map((word, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the sequence is fixed per diff
          <span key={index} className={`rounded-[2px] ${tone[word.op]}`}>
            {word.text}
          </span>
        ))}
      </>
    );
  }
  if (block.type === 'image') return <>{block.text || t('wiki.history.image')}</>;
  return <>{block.text || ' '}</>;
}

/** The comparison of two versions, block by block (W-PAG-05, E-62). */
function DiffView({ blocks }: { blocks: DiffBlock[] }) {
  const { t } = useTranslation();
  if (blocks.every((block) => block.op === 'same')) {
    return <p className="m-0 text-[var(--ink-muted)]">{t('wiki.history.noChanges')}</p>;
  }
  const marker = {
    same: 'border-transparent',
    added: 'border-[var(--success)]',
    removed: 'border-[var(--danger)]',
    changed: 'border-[var(--warning)]',
  } as const;
  return (
    <ol className="m-0 flex list-none flex-col gap-1.5 p-0 font-[family-name:var(--font-serif)] leading-7">
      {blocks.map((entry, index) => {
        const block = entry.op === 'changed' ? entry.after : entry.block;
        return (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: the sequence is fixed per diff
            key={index}
            className={`border-l-4 pl-3 ${marker[entry.op]} ${entry.op === 'same' ? 'opacity-60' : ''}`}
          >
            <span className="sr-only">{t(`wiki.history.op.${entry.op}`)}: </span>
            <div className={entry.op === 'changed' ? '' : `rounded-[2px] ${tone[entry.op]}`}>
              <BlockShape block={block}>
                <BlockText block={block} words={entry.op === 'changed' ? entry : undefined} />
              </BlockShape>
            </div>
            {entry.op === 'changed' &&
              entry.before.type === 'taskItem' &&
              entry.before.checked !== entry.after.checked && (
                <span className="text-xs text-[var(--ink-muted)]">
                  {entry.after.checked ? t('wiki.history.ticked') : t('wiki.history.unticked')}
                </span>
              )}
          </li>
        );
      })}
    </ol>
  );
}

function RestoreDialog({
  pageId,
  version,
  draftChanged,
  onOpenChange,
}: {
  pageId: string;
  version: PageVersionSummary | null;
  draftChanged: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [comment, setComment] = useState('');
  const restore = useMutation({
    mutationFn: (number: number) =>
      unwrap(
        client.POST('/api/v1/pages/{id}/versions/{number}/restore', {
          params: { path: { id: pageId, number: String(number) } },
          body: { comment: comment.trim() },
        }),
      ),
    onSuccess: async (page) => {
      await queryClient.invalidateQueries({ queryKey: ['page', pageId] });
      await queryClient.invalidateQueries({ queryKey: ['space', page.space.key, 'pages'] });
      onOpenChange(false);
      setComment('');
      await navigate({
        to: '/spaces/$key/pages/$id',
        params: { key: page.space.key, id: pageId },
      });
    },
  });
  return (
    <Dialog
      open={version !== null}
      onOpenChange={onOpenChange}
      title={t('wiki.history.restoreTitle', { number: version?.number ?? 0 })}
      description={t('wiki.history.restoreHelp')}
    >
      <div className="flex flex-col gap-4">
        {draftChanged && (
          <p
            role="alert"
            className="m-0 rounded-[var(--radius-md)] border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)]"
          >
            {t('wiki.history.draftWarning')}
          </p>
        )}
        {restore.error && <FormError message={restore.error.message} />}
        <TextField
          label={t('wiki.changeComment')}
          placeholder={t('wiki.changeCommentHint')}
          value={comment}
          maxLength={500}
          onChange={(event) => setComment(event.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!version || restore.isPending}
            onClick={() => version && restore.mutate(version.number)}
          >
            {t('wiki.history.restore')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * The published versions of a page (W-PAG-04): compare any two, look at one, restore one
 * (W-PAG-05, -06, E-62). Selection lives in the address, so a comparison can be shared.
 */
export function PageHistory({
  spaceKey,
  id,
  from,
  to,
  view,
}: {
  spaceKey: string;
  id: string;
  from?: number;
  to?: number;
  view?: number;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const page = useQuery(pageQuery(id));
  const versions = useQuery(pageVersionsQuery(id));
  const [restoring, setRestoring] = useState<PageVersionSummary | null>(null);
  const list = versions.data ?? [];
  const newest = list[0]?.number;
  // Without a choice: the newest version against the one before it.
  const right = to ?? newest;
  const left = from ?? (right !== undefined && right > 1 ? right - 1 : undefined);
  const comparing =
    view === undefined && left !== undefined && right !== undefined && left !== right;

  const diff = useQuery({
    queryKey: ['page', id, 'diff', left, right],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/pages/{id}/diff', {
          params: { path: { id }, query: { from: left ?? 1, to: right ?? 1 } },
        }),
      ),
    enabled: comparing,
  });
  const shown = useQuery({
    queryKey: ['page', id, 'versions', view],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/pages/{id}/versions/{number}', {
          params: { path: { id, number: String(view ?? 0) }, query: {} },
        }),
      ),
    enabled: view !== undefined,
  });

  const select = (search: { from?: number; to?: number; view?: number }) =>
    navigate({
      to: '/spaces/$key/pages/$id/history',
      params: { key: spaceKey, id },
      search,
      replace: true,
    });

  if (!page.data) return null;
  const canEdit = page.data.canEdit;
  const radio = 'size-4 accent-[var(--accent)]';

  return (
    <main className="flex flex-col gap-5 px-6 py-5">
      <header className="flex flex-col gap-1">
        <Link
          to="/spaces/$key/pages/$id"
          params={{ key: spaceKey, id }}
          className="text-xs text-[var(--ink-muted)] no-underline hover:underline"
        >
          ← {page.data.title}
        </Link>
        <h1 className="tl-heading-xl m-0">{t('wiki.history.title')}</h1>
      </header>

      {list.length === 0 && versions.data && (
        <p className="m-0 text-[var(--ink-muted)]">{t('wiki.history.none')}</p>
      )}
      {list.length > 0 && (
        <table className="w-full max-w-4xl border-collapse text-sm">
          <caption className="sr-only">{t('wiki.history.title')}</caption>
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--ink-muted)]">
              <th className="w-12 py-1 font-semibold">{t('wiki.history.from')}</th>
              <th className="w-12 py-1 font-semibold">{t('wiki.history.to')}</th>
              <th className="py-1 font-semibold">{t('wiki.history.version')}</th>
              <th className="py-1 font-semibold">{t('wiki.history.change')}</th>
              <th className="py-1">
                <span className="sr-only">{t('wiki.history.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((entry) => (
              <tr key={entry.number} className="border-b border-[var(--border)] align-top">
                <td className="py-2">
                  <input
                    type="radio"
                    name="from"
                    className={radio}
                    aria-label={t('wiki.history.compareFrom', { number: entry.number })}
                    checked={view === undefined && left === entry.number}
                    disabled={right !== undefined && entry.number >= right}
                    onChange={() => void select({ from: entry.number, to: right })}
                  />
                </td>
                <td className="py-2">
                  <input
                    type="radio"
                    name="to"
                    className={radio}
                    aria-label={t('wiki.history.compareTo', { number: entry.number })}
                    checked={view === undefined && right === entry.number}
                    disabled={left !== undefined && entry.number <= left}
                    onChange={() => void select({ from: left, to: entry.number })}
                  />
                </td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => void select({ view: entry.number })}
                    className={`font-semibold hover:underline ${view === entry.number ? 'text-[var(--ink)]' : 'text-[var(--accent)]'}`}
                  >
                    {t('wiki.versionNumber', { number: entry.number })}
                  </button>
                  {entry.number === page.data.version && (
                    <span className="ml-2 rounded-[var(--radius-sm)] bg-[var(--accent-soft)] px-1.5 text-xs font-semibold text-[var(--accent)]">
                      {t('wiki.current')}
                    </span>
                  )}
                  <div className="text-xs text-[var(--ink-muted)]">
                    {entry.author?.displayName ?? t('wiki.unknownAuthor')} ·{' '}
                    {formatDateTime(entry.createdAt)}
                  </div>
                </td>
                <td className="py-2">
                  {entry.restoredFrom !== null && (
                    <div className="text-xs font-semibold text-[var(--ink-muted)]">
                      {t('wiki.history.restoredFrom', { number: entry.restoredFrom })}
                    </div>
                  )}
                  {entry.comment || (entry.restoredFrom === null && '—')}
                </td>
                <td className="py-2 text-right">
                  {canEdit && entry.number !== page.data.version && (
                    <Button size="sm" variant="ghost" onClick={() => setRestoring(entry)}>
                      <ArrowCounterClockwise size={14} aria-hidden />
                      {t('wiki.history.restore')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {comparing && (
        <section aria-labelledby="diff-title" className="flex max-w-4xl flex-col gap-3">
          <h2 id="diff-title" className="tl-heading-md m-0">
            {t('wiki.history.comparing', { from: left, to: right })}
          </h2>
          <p className="m-0 flex flex-wrap gap-3 text-xs text-[var(--ink-muted)]">
            <span className={`rounded-[2px] px-1 ${tone.added}`}>{t('wiki.history.op.added')}</span>
            <span className={`rounded-[2px] px-1 ${tone.removed}`}>
              {t('wiki.history.op.removed')}
            </span>
          </p>
          {diff.error && <FormError message={diff.error.message} />}
          {diff.data && <DiffView blocks={diff.data.blocks} />}
        </section>
      )}

      {view !== undefined && shown.data && (
        <section aria-labelledby="version-title" className="flex max-w-4xl flex-col gap-3">
          <h2 id="version-title" className="tl-heading-md m-0">
            {t('wiki.versionBy', {
              number: shown.data.number,
              name: shown.data.author?.displayName ?? t('wiki.unknownAuthor'),
              date: formatDateTime(shown.data.createdAt),
            })}
          </h2>
          <article className="rounded-[var(--radius-md)] border border-[var(--border)] p-4">
            <h3 className="tl-heading-lg m-0 mb-3">{shown.data.title}</h3>
            <RichTextView doc={shown.data.content as RichText} variant="page" />
          </article>
        </section>
      )}

      <RestoreDialog
        pageId={id}
        version={restoring}
        draftChanged={page.data.draftChanged}
        onOpenChange={(open) => !open && setRestoring(null)}
      />
    </main>
  );
}
