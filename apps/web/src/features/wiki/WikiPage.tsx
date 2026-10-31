import {
  CaretRight,
  ChatCircle,
  ClockCounterClockwise,
  DotsThree,
  Lock,
  PencilSimple,
} from '@phosphor-icons/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { Page, PageTreeEntry, RichText, TextAnchor } from '@tasklore/shared';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { useRecordView } from '../../lib/personal';
import { useRealtimeRooms } from '../../lib/realtime';
import { pageCommentsQuery, pageQuery, pageTreeQuery } from '../../lib/wiki';
import { Button, buttonClass } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { TopBar } from '../../ui/TopBar';
import { FavouriteButton } from '../personal/FavouriteButton';
import { PageComments } from './comments';
import { PageExportMenu } from './ExportMenu';
import { CommentedText, InlineThreads } from './InlineComments';
import { PageAttachments } from './PageAttachments';
import { PageLabelList, WatchMenu } from './PageMeta';
import { PageOutline, readingMinutes } from './PageOutline';
import { PageRestrictionsDialog } from './PageRestrictions';
import { PageStatusBar } from './PageStatus';
import { CreatePageDialog } from './SpaceLayout';

export function Breadcrumbs({ page, current }: { page: Page; current?: ReactNode }) {
  const { t } = useTranslation();
  const crumbs = [
    <Link key="space" to="/spaces/$key" params={{ key: page.space.key }}>
      {page.space.name}
    </Link>,
    ...page.ancestors.map((ancestor) => (
      <Link
        key={ancestor.id}
        to="/spaces/$key/pages/$id"
        params={{ key: page.space.key, id: ancestor.id }}
      >
        {ancestor.title}
      </Link>
    )),
    ...(current ? [<span key="current">{current}</span>] : []),
  ];
  return (
    <nav aria-label={t('wiki.breadcrumbs')}>
      <ol className="m-0 flex list-none flex-wrap items-center gap-1 p-0 text-sm text-[var(--ink-muted)]">
        {crumbs.map((crumb, index) => (
          <li key={crumb.key} className="flex items-center gap-1">
            {index > 0 && <CaretRight size={10} aria-hidden />}
            {crumb}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The page and every page below it, which cannot become its new parent. */
function subtreeIds(entries: PageTreeEntry[], id: string): Set<string> {
  const ids = new Set([id]);
  for (const entry of entries) {
    if (entry.parentId && ids.has(entry.parentId)) ids.add(entry.id);
  }
  return ids;
}

function MoveDialog({
  page,
  open,
  onOpenChange,
}: {
  page: Page;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const tree = useQuery({ ...pageTreeQuery(page.space.key), enabled: open });
  const [parentId, setParentId] = useState(page.parentId ?? '');
  const entries = tree.data ?? [];
  const excluded = useMemo(() => subtreeIds(entries, page.id), [entries, page.id]);
  const depth = useMemo(() => {
    const result = new Map<string, number>();
    for (const entry of entries) {
      result.set(entry.id, entry.parentId ? (result.get(entry.parentId) ?? 0) + 1 : 0);
    }
    return result;
  }, [entries]);
  const move = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/pages/{id}/move', {
          params: { path: { id: page.id } },
          body: { parentId: parentId || null },
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['space', page.space.key] });
      await queryClient.invalidateQueries({ queryKey: ['page', page.id] });
      onOpenChange(false);
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('wiki.moveTitle', { title: page.title })}
    >
      <div className="flex flex-col gap-4">
        {move.error && <FormError message={move.error.message} />}
        <label className="flex flex-col gap-1">
          <span className="tl-label text-[var(--ink-muted)]">{t('wiki.newParent')}</span>
          <select
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
            className="h-[var(--control-md)] rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2"
          >
            <option value="">{t('wiki.topLevel')}</option>
            {entries
              .filter((entry) => !excluded.has(entry.id))
              .map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {`${'  '.repeat(depth.get(entry.id) ?? 0)}${entry.title}`}
                </option>
              ))}
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={move.isPending} onClick={() => move.mutate()}>
            {t('wiki.move')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function DeleteDialog({
  page,
  open,
  onOpenChange,
}: {
  page: Page;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () =>
      unwrap(client.DELETE('/api/v1/pages/{id}', { params: { path: { id: page.id } } })),
    onSuccess: async () => {
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ['space', page.space.key] });
      const parent = page.ancestors.at(-1);
      await navigate(
        parent
          ? { to: '/spaces/$key/pages/$id', params: { key: page.space.key, id: parent.id } }
          : { to: '/spaces/$key', params: { key: page.space.key } },
      );
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('wiki.deleteTitle', { title: page.title })}
    >
      <div className="flex flex-col gap-4">
        {remove.error && <FormError message={remove.error.message} />}
        <p className="m-0">{t('wiki.deleteHelp')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>
            {t('wiki.delete')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

const menuItem =
  'cursor-pointer rounded-[var(--radius-sm)] px-2 py-1.5 outline-none data-[highlighted]:bg-[var(--surface-2)]';

/** A wiki page as readers see it: the latest published version (E-59). */
export function WikiPage({ spaceKey, id }: { spaceKey: string; id: string }) {
  const { t } = useTranslation();
  const page = useQuery(pageQuery(id));
  const comments = useQuery(pageCommentsQuery(id));
  useRealtimeRooms([`page:${id}`]);
  useRecordView('page', page.data?.id);
  const [dialog, setDialog] = useState<'move' | 'delete' | 'child' | 'restrict' | null>(null);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [quote, setQuote] = useState<TextAnchor | null>(null);
  const article = useRef<HTMLElement>(null);
  const close = (open: boolean) => !open && setDialog(null);

  if (page.error) {
    return (
      <main className="px-6 py-6">
        <p className="m-0 text-[var(--danger)]">{page.error.message}</p>
      </main>
    );
  }
  if (!page.data) return null;
  const data = page.data;
  const list = comments.data ?? [];
  const withThreads = quote !== null || list.some((comment) => !comment.parentId && comment.anchor);

  const doc = data.content as RichText | null;
  const openComments = list.filter((comment) => !comment.deleted).length;

  return (
    <main className="flex flex-col">
      <TopBar
        crumbs={[
          <Link key="space" to="/spaces/$key" params={{ key: data.space.key }}>
            {data.space.name}
          </Link>,
          ...data.ancestors.map((ancestor) => (
            <Link
              key={ancestor.id}
              to="/spaces/$key/pages/$id"
              params={{ key: data.space.key, id: ancestor.id }}
            >
              {ancestor.title}
            </Link>
          )),
          data.title,
        ]}
        actions={
          <>
            {data.version > 0 && (
              <Link
                to="/spaces/$key/pages/$id/history"
                params={{ key: spaceKey, id: data.id }}
                className={buttonClass('ghost', 'sm')}
              >
                <ClockCounterClockwise size={16} aria-hidden />
                {t('wiki.versions')}
              </Link>
            )}
            {data.version > 0 && (
              <a href="#page-comments" className={buttonClass('ghost', 'sm')}>
                <ChatCircle size={16} aria-hidden />
                {t('wiki.comments.title', { count: openComments })}
              </a>
            )}
            {data.version > 0 && <PageExportMenu spaceKey={spaceKey} pageId={data.id} />}
            <WatchMenu page={data} />
            {data.canEdit && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  aria-label={t('wiki.pageActions')}
                  className="grid size-[var(--control-sm)] place-items-center rounded-[var(--radius-md)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                >
                  <DotsThree size={18} weight="bold" aria-hidden />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={4}
                    className="z-50 min-w-48 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-1 shadow-[var(--shadow-float)]"
                  >
                    <DropdownMenu.Item className={menuItem} onSelect={() => setDialog('child')}>
                      {t('wiki.createChildPage')}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className={menuItem} onSelect={() => setDialog('move')}>
                      {t('wiki.moveEllipsis')}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item className={menuItem} onSelect={() => setDialog('restrict')}>
                      {t('restrictions.menu')}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className={`${menuItem} text-[var(--danger)]`}
                      onSelect={() => setDialog('delete')}
                    >
                      {t('wiki.deleteEllipsis')}
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
            {data.canEdit && (
              <Link
                to="/spaces/$key/pages/$id/edit"
                params={{ key: spaceKey, id }}
                className={`${buttonClass('secondary', 'sm')} ml-1.5`}
              >
                <PencilSimple size={16} aria-hidden />
                {t('wiki.edit')}
              </Link>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-start gap-x-10 gap-y-6 px-12 py-9">
        <div className="flex min-w-0 max-w-[680px] flex-[999_1_480px] flex-col gap-4">
          <header className="flex flex-col gap-3">
            <span className="text-[12.5px] text-[var(--ink-muted)]">
              {data.version === 0
                ? t('wiki.neverPublished')
                : t('wiki.updatedBy', {
                    number: data.version,
                    name: data.publishedBy?.displayName ?? t('wiki.unknownAuthor'),
                    date: formatDateTime(data.publishedAt ?? data.createdAt),
                  })}
              {doc && ` · ${t('wiki.readingTime', { count: readingMinutes(doc) })}`}
            </span>
            <h1 className="m-0 flex items-center gap-2 font-[family-name:var(--font-prose)] text-[40px] leading-[1.12] font-medium tracking-[-0.015em]">
              {data.title}
              {(data.restrictions.view ||
                data.restrictions.edit ||
                data.restrictions.inherited) && (
                <span title={t('restrictions.badge')} className="text-[var(--ink-muted)]">
                  <Lock size={22} aria-label={t('restrictions.badge')} />
                </span>
              )}
              <FavouriteButton
                kind="page"
                refId={data.id}
                active={data.favourite}
                name={data.title}
              />
            </h1>
            <PageLabelList page={data} />
            <PageStatusBar page={data} />
          </header>
          {doc ? (
            <article ref={article}>
              <CommentedText
                doc={doc}
                spaceKey={spaceKey}
                pageId={data.id}
                comments={list}
                active={activeThread}
                canComment={data.canComment}
                onOpen={setActiveThread}
                onQuote={(anchor) => {
                  setQuote(anchor);
                  setActiveThread(null);
                }}
              />
            </article>
          ) : (
            <p className="m-0 max-w-xl text-[var(--ink-muted)]">{t('wiki.draftHelp')}</p>
          )}
        </div>
        {doc && (
          <aside
            className={`sticky top-6 flex min-w-0 flex-col gap-6 ${withThreads ? 'flex-[1_1_280px] xl:max-w-[340px]' : 'flex-[1_1_200px] xl:max-w-[220px]'}`}
          >
            <PageOutline doc={doc} article={article} />
            {withThreads && (
              <InlineThreads
                pageId={data.id}
                spaceKey={spaceKey}
                comments={list}
                canComment={data.canComment}
                active={activeThread}
                onActivate={setActiveThread}
                draft={quote}
                onDraftDone={(created) => {
                  setQuote(null);
                  if (created) setActiveThread(created);
                }}
              />
            )}
          </aside>
        )}
      </div>
      <div className="flex max-w-[728px] flex-col gap-6 px-12 pb-12">
        <PageAttachments pageId={data.id} canEdit={data.canEdit} />
        {data.version > 0 && (
          <PageComments
            pageId={data.id}
            spaceKey={spaceKey}
            comments={list}
            canComment={data.canComment}
          />
        )}
      </div>
      <MoveDialog
        key={`${data.id}:${data.parentId}`}
        page={data}
        open={dialog === 'move'}
        onOpenChange={close}
      />
      <DeleteDialog page={data} open={dialog === 'delete'} onOpenChange={close} />
      <PageRestrictionsDialog
        pageId={data.id}
        spaceKey={spaceKey}
        open={dialog === 'restrict'}
        onOpenChange={close}
      />
      <CreatePageDialog
        spaceKey={spaceKey}
        parentId={data.id}
        open={dialog === 'child'}
        onOpenChange={close}
      />
    </main>
  );
}
