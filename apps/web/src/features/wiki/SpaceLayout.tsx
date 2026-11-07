import {
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  CaretDown,
  CaretRight,
  Eye,
  FolderSimple,
  GearSix,
  Kanban,
  Newspaper,
  Plus,
  Tag,
  Trash,
} from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, Outlet, useNavigate, useParams } from '@tanstack/react-router';
import type { MovePageRequest, PageTemplateSummary, PageTreeEntry } from '@toolvibes/shared';
import { type FormEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, client, unwrap } from '../../lib/api';
import { boardsQuery } from '../../lib/boards';
import { useRecordView } from '../../lib/personal';
import { useRealtimeRooms } from '../../lib/realtime';
import { useCurrentProject } from '../../lib/shortcuts';
import {
  nest,
  pageTreeQuery,
  spaceQuery,
  spaceTemplatesQuery,
  type TreeNode,
} from '../../lib/wiki';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';
import { FavouriteButton } from '../personal/FavouriteButton';
import { SpaceExportMenu } from './ExportMenu';
import { fillTitle, TemplateGallery } from './templates';

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
  const [titleTouched, setTitleTouched] = useState(false);
  const [template, setTemplate] = useState<PageTemplateSummary | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const templates = useQuery({ ...spaceTemplatesQuery(spaceKey), enabled: open });
  const create = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/spaces/{key}/pages', {
          params: { path: { key: spaceKey } },
          body: {
            title: title.trim(),
            parentId,
            template: template?.ref,
            ...(template && template.inputs.length > 0 ? { variables: inputs } : {}),
          },
        }),
      ),
    onSuccess: async (page) => {
      await queryClient.invalidateQueries({ queryKey: ['space', spaceKey] });
      onOpenChange(false);
      setTitle('');
      setTitleTouched(false);
      setTemplate(null);
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
      width={640}
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        {create.error && (
          <FormError
            message={create.error instanceof ApiError ? create.error.message : String(create.error)}
          />
        )}
        {templates.data && (
          <TemplateGallery
            templates={templates.data}
            value={template?.ref ?? ''}
            onChange={(next) => {
              setTemplate(next);
              setInputs({});
              // The template's title suggestion, unless a title was typed already.
              if (!titleTouched) setTitle(next ? fillTitle(next.title) : '');
            }}
          />
        )}
        {template?.inputs.map((name) => (
          <TextField
            key={name}
            label={name}
            value={inputs[name] ?? ''}
            onChange={(event) => {
              const next = { ...inputs, [name]: event.target.value };
              setInputs(next);
              if (!titleTouched) setTitle(fillTitle(template.title, next));
            }}
          />
        ))}
        <TextField
          label={t('wiki.pageTitle')}
          value={title}
          maxLength={255}
          autoFocus
          onChange={(event) => {
            setTitleTouched(true);
            setTitle(event.target.value);
          }}
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

type DropPosition = 'before' | 'after' | 'into';

interface DropTarget {
  id: string;
  position: DropPosition;
}

function TreeItem({
  node,
  spaceKey,
  currentId,
  expanded,
  toggle,
  canEdit,
  onCreateChild,
  drop,
  dragging,
}: {
  node: TreeNode;
  spaceKey: string;
  currentId: string | undefined;
  expanded: Set<string>;
  toggle: (id: string) => void;
  canEdit: boolean;
  onCreateChild: (parentId: string) => void;
  drop: DropTarget | null;
  dragging: string | null;
}) {
  const { t } = useTranslation();
  const { page, children } = node;
  const open = expanded.has(page.id);
  const current = page.id === currentId;
  const draggable = useDraggable({ id: page.id, disabled: !canEdit });
  const droppable = useDroppable({ id: page.id, disabled: !canEdit });
  const position = drop?.id === page.id ? drop.position : null;
  return (
    <li>
      <div
        ref={(element) => {
          draggable.setNodeRef(element);
          droppable.setNodeRef(element);
        }}
        // Pointer only: keyboard users move pages with the "Move" dialog.
        {...draggable.listeners}
        className={`group relative flex min-h-8 items-center gap-0.5 rounded-[var(--radius-sm)] pr-1 ${current ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--surface-2)]'} ${position === 'into' ? 'outline-2 outline-[var(--accent)]' : ''} ${dragging === page.id ? 'opacity-40' : ''}`}
      >
        {position === 'before' && (
          <span className="pointer-events-none absolute -top-px right-0 left-6 h-0.5 bg-[var(--accent)]" />
        )}
        {position === 'after' && (
          <span className="pointer-events-none absolute right-0 -bottom-px left-6 h-0.5 bg-[var(--accent)]" />
        )}
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
          draggable={false}
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
              drop={drop}
              dragging={dragging}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Where a drop on a row lands: its upper quarter before it, the lower quarter after, else inside. */
function dropPosition(event: DragMoveEvent): DropPosition | null {
  const { over, activatorEvent, delta } = event;
  if (!over || !('clientY' in activatorEvent)) return null;
  const y = (activatorEvent as PointerEvent).clientY + delta.y - over.rect.top;
  const share = y / over.rect.height;
  return share < 0.25 ? 'before' : share > 0.75 ? 'after' : 'into';
}

/** Turns a drop into the move request: new parent and the sibling to land before. */
function moveRequest(
  entries: PageTreeEntry[],
  pageId: string,
  target: DropTarget,
): MovePageRequest | null {
  const over = entries.find((entry) => entry.id === target.id);
  if (!over) return null;
  if (target.position === 'into') return { parentId: over.id, beforeId: null };
  if (target.position === 'before') return { parentId: over.parentId, beforeId: over.id };
  const siblings = entries.filter(
    (entry) => entry.parentId === over.parentId && entry.id !== pageId,
  );
  const next = siblings[siblings.findIndex((entry) => entry.id === over.id) + 1];
  return { parentId: over.parentId, beforeId: next?.id ?? null };
}

/** The linked project's issues and boards, if the caller may see them (W-SPC-04, E-60). */
function ProjectLinks({ project }: { project: { key: string; name: string } }) {
  const { t } = useTranslation();
  const boards = useQuery(boardsQuery(project.key));
  const item =
    'flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 text-sm text-[var(--ink)] no-underline hover:bg-[var(--surface-2)]';
  return (
    <div className="flex flex-col gap-0.5">
      <span className="tl-label px-2 text-[var(--ink-muted)]">{t('wiki.project')}</span>
      <Link to="/projects/$key" params={{ key: project.key }} className={item}>
        <FolderSimple size={16} aria-hidden />
        <span className="min-w-0 flex-1 truncate">{project.name}</span>
        <span className="text-xs text-[var(--ink-muted)]">{t('wiki.projectIssues')}</span>
      </Link>
      {boards.data?.map((board) => (
        <Link key={board.id} to="/boards/$id" params={{ id: board.id }} className={item}>
          <Kanban size={16} aria-hidden />
          <span className="min-w-0 flex-1 truncate">{board.name}</span>
        </Link>
      ))}
    </div>
  );
}

/** A space: its page tree beside the page shown (W-SPC-05, W-PAG-01). */
export function SpaceLayout({ spaceKey }: { spaceKey: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const params = useParams({ strict: false }) as { id?: string };
  const space = useQuery(spaceQuery(spaceKey));
  const tree = useQuery(pageTreeQuery(spaceKey));
  useRealtimeRooms([`space:${spaceKey}`]);
  useRecordView('space', space.data?.key);
  useCurrentProject(space.data?.project?.key);
  const [toggled, setToggled] = useState<Map<string, boolean>>(new Map());
  const [creatingUnder, setCreatingUnder] = useState<string | null | undefined>(undefined);
  const [dragging, setDragging] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropTarget | null>(null);
  const canEdit = space.data?.permissions.includes('edit') ?? false;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const entries = tree.data ?? [];
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

  // The dragged page and everything below it cannot take it.
  const blocked = useMemo(() => {
    const result = new Set<string>();
    if (!dragging) return result;
    result.add(dragging);
    for (const entry of tree.data ?? []) {
      if (entry.parentId && result.has(entry.parentId)) result.add(entry.id);
    }
    return result;
  }, [dragging, tree.data]);

  const watchSpace = useMutation({
    mutationFn: (on: boolean) => {
      const options = { params: { path: { key: spaceKey } } };
      return unwrap(
        on
          ? client.PUT('/api/v1/spaces/{key}/watch', options)
          : client.DELETE('/api/v1/spaces/{key}/watch', options),
      );
    },
    onSuccess: async (next) => {
      queryClient.setQueryData(spaceQuery(spaceKey).queryKey, next);
      await queryClient.invalidateQueries({ queryKey: ['page'] });
    },
  });

  const move = useMutation({
    mutationFn: ({ id, body }: { id: string; body: MovePageRequest }) =>
      unwrap(client.POST('/api/v1/pages/{id}/move', { params: { path: { id } }, body })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['space', spaceKey, 'pages'] }),
  });

  function onDragMove(event: DragMoveEvent) {
    const position = dropPosition(event);
    const id = event.over ? String(event.over.id) : null;
    setDrop(id && position && !blocked.has(id) ? { id, position } : null);
  }

  function onDragEnd(event: DragEndEvent) {
    const id = String(event.active.id);
    const target = drop;
    setDragging(null);
    setDrop(null);
    if (!target) return;
    const body = moveRequest(entries, id, target);
    const page = entries.find((entry) => entry.id === id);
    if (!body || !page) return;
    const siblings = entries.filter((entry) => entry.parentId === page.parentId);
    const next = siblings[siblings.findIndex((entry) => entry.id === id) + 1];
    if (body.parentId === page.parentId && (body.beforeId ?? null) === (next?.id ?? null)) return;
    if (target.position === 'into') setToggled((current) => new Map(current).set(target.id, true));
    move.mutate({ id, body });
  }

  if (space.error) {
    return (
      <main className="px-6 py-6">
        <p className="m-0 text-[var(--danger)]">{space.error.message}</p>
      </main>
    );
  }

  const draggedTitle = entries.find((entry) => entry.id === dragging)?.title;
  return (
    <div className="flex min-h-full flex-wrap">
      <aside
        aria-label={t('wiki.pageTree')}
        className="flex w-full flex-col gap-3 border-b border-[var(--border)] bg-[var(--surface-0)] px-2 py-4 md:w-64 md:border-r md:border-b-0"
      >
        <div className="flex items-start gap-1">
          <Link
            to="/spaces/$key"
            params={{ key: spaceKey }}
            className="flex min-w-0 flex-1 flex-col px-2 text-[var(--ink)] no-underline"
          >
            <strong className="truncate">{space.data?.name ?? spaceKey}</strong>
            <span className="tl-key text-[var(--ink-muted)]">{spaceKey}</span>
          </Link>
          {space.data && (
            <>
              <button
                type="button"
                aria-pressed={space.data.watching}
                disabled={watchSpace.isPending}
                onClick={() => watchSpace.mutate(!space.data?.watching)}
                aria-label={space.data.watching ? t('wiki.watch.stopSpace') : t('wiki.watch.space')}
                title={space.data.watching ? t('wiki.watch.stopSpace') : t('wiki.watch.space')}
                className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-md)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] aria-pressed:text-[var(--accent)]"
              >
                <Eye size={18} weight={space.data.watching ? 'fill' : 'regular'} aria-hidden />
              </button>
              <FavouriteButton
                kind="space"
                refId={space.data.key}
                active={space.data.favourite}
                name={space.data.name}
              />
            </>
          )}
        </div>
        {space.data?.project && <ProjectLinks project={space.data.project} />}
        <div className="flex items-center justify-between px-2">
          <span className="tl-label text-[var(--ink-muted)]">{t('wiki.pages')}</span>
          {canEdit && (
            <button
              type="button"
              onClick={() => setCreatingUnder(null)}
              aria-label={t('wiki.createPage')}
              title={t('wiki.createPage')}
              className="grid size-6 place-items-center rounded-[var(--radius-sm)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
            >
              <Plus size={14} aria-hidden />
            </button>
          )}
        </div>
        {tree.data?.length === 0 && (
          <p className="m-0 px-2 text-sm text-[var(--ink-muted)]">{t('wiki.noPages')}</p>
        )}
        {move.error && (
          <p role="alert" className="m-0 px-2 text-sm text-[var(--danger)]">
            {t('wiki.moveFailed', { message: move.error.message })}
          </p>
        )}
        <DndContext
          sensors={sensors}
          onDragStart={(event: DragStartEvent) => {
            move.reset();
            setDragging(String(event.active.id));
          }}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setDragging(null);
            setDrop(null);
          }}
        >
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
                drop={drop}
                dragging={dragging}
              />
            ))}
          </ul>
          <DragOverlay dropAnimation={null}>
            {draggedTitle && (
              <div className="w-56 truncate rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 py-1 shadow-[var(--shadow-float)]">
                {draggedTitle}
              </div>
            )}
          </DragOverlay>
        </DndContext>
        <div className="mt-auto flex flex-col gap-0.5">
          <Link
            to="/spaces/$key/labels"
            params={{ key: spaceKey }}
            className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 text-sm text-[var(--ink-muted)] no-underline hover:text-[var(--ink)]"
          >
            <Tag size={14} aria-hidden />
            {t('wiki.labels.overview')}
          </Link>
          <Link
            to="/spaces/$key/blog"
            params={{ key: spaceKey }}
            className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 text-sm text-[var(--ink-muted)] no-underline hover:text-[var(--ink)]"
          >
            <Newspaper size={14} aria-hidden />
            {t('blog.title')}
          </Link>
          <SpaceExportMenu
            spaceKey={spaceKey}
            className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border-0 bg-transparent px-2 py-1 text-left text-sm text-[var(--ink-muted)] hover:text-[var(--ink)]"
          />
          {canEdit && (
            <Link
              to="/spaces/$key/trash"
              params={{ key: spaceKey }}
              className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 text-sm text-[var(--ink-muted)] no-underline hover:text-[var(--ink)]"
            >
              <Trash size={14} aria-hidden />
              {t('wiki.trash')}
            </Link>
          )}
          {space.data?.permissions.includes('administer') && (
            <Link
              to="/spaces/$key/settings"
              params={{ key: spaceKey }}
              className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 text-sm text-[var(--ink-muted)] no-underline hover:text-[var(--ink)]"
            >
              <GearSix size={14} aria-hidden />
              {t('wiki.settingsLink')}
            </Link>
          )}
        </div>
      </aside>
      {/* basis-full: below md the tree takes the whole row, so the page must wrap below it instead of shrinking to 0. */}
      <div className="min-w-0 flex-1 basis-full md:basis-0">
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
