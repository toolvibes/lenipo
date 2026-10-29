import { CaretDown, CaretRight, Plus, Trash } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, Outlet, useNavigate, useParams } from '@tanstack/react-router';
import { type FormEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, client, unwrap } from '../../lib/api';
import { useRealtimeRooms } from '../../lib/realtime';
import { nest, pageTreeQuery, spaceQuery, type TreeNode } from '../../lib/wiki';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';

/** Asks for a title, creates the page as a draft and opens it for editing (W-PAG-02, -03). */
export function CreatePageDialog({
  spaceKey,
  parentId,
  open,
  onOpenChange,
}: {
  spaceKey: string;
  parentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const create = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/spaces/{key}/pages', {
          params: { path: { key: spaceKey } },
          body: { title: title.trim(), parentId },
        }),
      ),
    onSuccess: async (page) => {
      await queryClient.invalidateQueries({ queryKey: ['space', spaceKey] });
      onOpenChange(false);
      setTitle('');
      await navigate({
        to: '/spaces/$key/pages/$id/edit',
        params: { key: spaceKey, id: page.id },
      });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (title.trim()) create.mutate();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={parentId ? t('wiki.createChildPage') : t('wiki.createPage')}
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        {create.error && (
          <FormError
            message={create.error instanceof ApiError ? create.error.message : String(create.error)}
          />
        )}
        <TextField
          label={t('wiki.pageTitle')}
          value={title}
          maxLength={255}
          autoFocus
          onChange={(event) => setTitle(event.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={!title.trim() || create.isPending}>
            {t('wiki.createPage')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function TreeItem({
  node,
  spaceKey,
  currentId,
  expanded,
  toggle,
  canEdit,
  onCreateChild,
}: {
  node: TreeNode;
  spaceKey: string;
  currentId: string | undefined;
  expanded: Set<string>;
  toggle: (id: string) => void;
  canEdit: boolean;
  onCreateChild: (parentId: string) => void;
}) {
  const { t } = useTranslation();
  const { page, children } = node;
  const open = expanded.has(page.id);
  const current = page.id === currentId;
  return (
    <li>
      <div
        className={`group flex min-h-8 items-center gap-0.5 rounded-[var(--radius-sm)] pr-1 ${current ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--surface-1)]'}`}
      >
        {children.length > 0 ? (
          <button
            type="button"
            onClick={() => toggle(page.id)}
            aria-expanded={open}
            aria-label={
              open
                ? t('wiki.collapse', { title: page.title })
                : t('wiki.expand', { title: page.title })
            }
            className="grid size-6 shrink-0 place-items-center rounded-[var(--radius-sm)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            {open ? <CaretDown size={12} aria-hidden /> : <CaretRight size={12} aria-hidden />}
          </button>
        ) : (
          <span className="size-6 shrink-0" />
        )}
        <Link
          to="/spaces/$key/pages/$id"
          params={{ key: spaceKey, id: page.id }}
          aria-current={current ? 'page' : undefined}
          className={`min-w-0 flex-1 truncate py-1 no-underline ${current ? 'font-semibold text-[var(--accent)]' : 'text-[var(--ink)]'} ${page.published ? '' : 'italic'}`}
        >
          {page.title}
          {!page.published && (
            <span className="ml-1.5 text-xs not-italic text-[var(--ink-muted)]">
              {t('wiki.draft')}
            </span>
          )}
        </Link>
        {canEdit && (
          <button
            type="button"
            onClick={() => onCreateChild(page.id)}
            aria-label={t('wiki.createChildPageOf', { title: page.title })}
            className="grid size-6 shrink-0 place-items-center rounded-[var(--radius-sm)] text-[var(--ink-muted)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-[var(--ink)]"
          >
            <Plus size={12} aria-hidden />
          </button>
        )}
      </div>
      {open && children.length > 0 && (
        <ul className="m-0 list-none pl-3">
          {children.map((child) => (
            <TreeItem
              key={child.page.id}
              node={child}
              spaceKey={spaceKey}
              currentId={currentId}
              expanded={expanded}
              toggle={toggle}
              canEdit={canEdit}
              onCreateChild={onCreateChild}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** A space: its page tree beside the page shown (W-SPC-05, W-PAG-01). */
export function SpaceLayout({ spaceKey }: { spaceKey: string }) {
  const { t } = useTranslation();
  const params = useParams({ strict: false }) as { id?: string };
  const space = useQuery(spaceQuery(spaceKey));
  const tree = useQuery(pageTreeQuery(spaceKey));
  useRealtimeRooms([`space:${spaceKey}`]);
  const [toggled, setToggled] = useState<Map<string, boolean>>(new Map());
  const [creatingUnder, setCreatingUnder] = useState<string | null | undefined>(undefined);
  const canEdit = space.data?.permissions.includes('edit') ?? false;

  const roots = useMemo(() => nest(tree.data ?? []), [tree.data]);
  // Ancestors of the current page are open unless closed by hand; everything else is closed.
  const expanded = useMemo(() => {
    const parents = new Map((tree.data ?? []).map((entry) => [entry.id, entry.parentId]));
    const open = new Set<string>();
    let cursor = params.id ? parents.get(params.id) : undefined;
    while (cursor) {
      open.add(cursor);
      cursor = parents.get(cursor);
    }
    for (const [id, value] of toggled) {
      if (value) open.add(id);
      else open.delete(id);
    }
    return open;
  }, [tree.data, params.id, toggled]);
  const toggle = (id: string) =>
    setToggled((current) => new Map(current).set(id, !expanded.has(id)));

  if (space.error) {
    return (
      <main className="px-6 py-6">
        <p className="m-0 text-[var(--danger)]">{space.error.message}</p>
      </main>
    );
  }

  return (
    <div className="flex min-h-full flex-wrap">
      <aside
        aria-label={t('wiki.pageTree')}
        className="flex w-full flex-col gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-2 py-4 md:w-64 md:border-r md:border-b-0"
      >
        <Link
          to="/spaces/$key"
          params={{ key: spaceKey }}
          className="flex flex-col px-2 text-[var(--ink)] no-underline"
        >
          <strong className="truncate">{space.data?.name ?? spaceKey}</strong>
          <span className="tl-key text-[var(--ink-muted)]">{spaceKey}</span>
        </Link>
        <div className="flex items-center justify-between px-2">
          <span className="tl-label uppercase text-[var(--ink-muted)]">{t('wiki.pages')}</span>
          {canEdit && (
            <button
              type="button"
              onClick={() => setCreatingUnder(null)}
              aria-label={t('wiki.createPage')}
              title={t('wiki.createPage')}
              className="grid size-6 place-items-center rounded-[var(--radius-sm)] text-[var(--ink-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--ink)]"
            >
              <Plus size={14} aria-hidden />
            </button>
          )}
        </div>
        {tree.data?.length === 0 && (
          <p className="m-0 px-2 text-sm text-[var(--ink-muted)]">{t('wiki.noPages')}</p>
        )}
        <ul aria-label={t('wiki.pages')} className="m-0 list-none p-0">
          {roots.map((node) => (
            <TreeItem
              key={node.page.id}
              node={node}
              spaceKey={spaceKey}
              currentId={params.id}
              expanded={expanded}
              toggle={toggle}
              canEdit={canEdit}
              onCreateChild={setCreatingUnder}
            />
          ))}
        </ul>
        {canEdit && (
          <Link
            to="/spaces/$key/trash"
            params={{ key: spaceKey }}
            className="mt-auto flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 text-sm text-[var(--ink-muted)] no-underline hover:text-[var(--ink)]"
          >
            <Trash size={14} aria-hidden />
            {t('wiki.trash')}
          </Link>
        )}
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
      <CreatePageDialog
        spaceKey={spaceKey}
        parentId={creatingUnder ?? null}
        open={creatingUnder !== undefined}
        onOpenChange={(open) => !open && setCreatingUnder(undefined)}
      />
    </div>
  );
}

/** Opening a space shows its home page, or invites to write the first one. */
export function SpaceHome({ spaceKey }: { spaceKey: string }) {
  const { t } = useTranslation();
  const space = useQuery(spaceQuery(spaceKey));
  const [creating, setCreating] = useState(false);
  if (!space.data) return null;
  if (space.data.homePageId) {
    return (
      <Navigate
        to="/spaces/$key/pages/$id"
        params={{ key: spaceKey, id: space.data.homePageId }}
        replace
      />
    );
  }
  const canEdit = space.data.permissions.includes('edit');
  return (
    <main className="flex flex-col gap-3 px-6 py-6">
      <h1 className="tl-heading-xl">{space.data.name}</h1>
      {space.data.description && (
        <p className="m-0 max-w-xl text-[var(--ink-muted)]">{space.data.description}</p>
      )}
      <p className="m-0 max-w-xl">{canEdit ? t('wiki.emptySpaceEditor') : t('wiki.emptySpace')}</p>
      {canEdit && (
        <div>
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden />
            {t('wiki.createPage')}
          </Button>
        </div>
      )}
      <CreatePageDialog
        spaceKey={spaceKey}
        parentId={null}
        open={creating}
        onOpenChange={setCreating}
      />
    </main>
  );
}
