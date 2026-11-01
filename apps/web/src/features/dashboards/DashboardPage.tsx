import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  DotsSixVertical,
  PencilSimple,
  Trash,
} from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { Dashboard, DashboardLayout, Gadget, Me } from '@toolvibes/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { dashboardQuery, dashboardsQuery } from '../../lib/dashboards';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { TopBar } from '../../ui/TopBar';
import { FavouriteButton } from '../personal/FavouriteButton';
import { HomePage } from '../shell/HomePage';
import { DashboardDialog } from './DashboardDialog';
import { GadgetDialog } from './GadgetDialog';
import { GadgetBody, Muted } from './gadgets';

const GRID: Record<DashboardLayout, string> = {
  one: 'grid-cols-1',
  two: 'grid-cols-1 lg:grid-cols-2',
  'wide-left': 'grid-cols-1 lg:grid-cols-[2fr_1fr]',
  three: 'grid-cols-1 lg:grid-cols-3',
};

type Place = { column: number; index: number };

function locate(columns: Gadget[][], id: string): Place | null {
  for (const [column, gadgets] of columns.entries()) {
    const index = gadgets.findIndex((gadget) => gadget.id === id);
    if (index >= 0) return { column, index };
  }
  return null;
}

/** The columns with one gadget moved to another place. */
function moved(columns: Gadget[][], id: string, to: Place): Gadget[][] {
  const from = locate(columns, id);
  if (!from) return columns;
  const next = columns.map((gadgets) => [...gadgets]);
  const [gadget] = next[from.column]?.splice(from.index, 1) ?? [];
  if (!gadget) return columns;
  const target = next[to.column] ?? [];
  target.splice(Math.max(0, Math.min(to.index, target.length)), 0, gadget);
  return next;
}

function GadgetCard({
  gadget,
  place,
  columns,
  editing,
  onMove,
  onEdit,
  onRemove,
  onDragStart,
  onDrop,
}: {
  gadget: Gadget;
  place: Place;
  columns: Gadget[][];
  editing: boolean;
  onMove: (to: Place) => void;
  onEdit: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const { t } = useTranslation();
  const title = gadget.title || t(`dashboards.types.${gadget.config.type}`);
  const iconButton =
    'grid size-7 place-items-center rounded-[var(--radius-sm)] text-[var(--ink-muted)] hover:bg-[var(--selected)] hover:text-[var(--ink)] disabled:opacity-30';
  const last = (columns[place.column]?.length ?? 1) - 1;
  return (
    <section
      aria-label={title}
      draggable={editing}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragOver={(event) => editing && event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDrop();
      }}
      className={`flex min-w-0 flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-5 py-4 ${
        editing ? 'border-dashed' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        {editing && (
          <DotsSixVertical
            size={16}
            className="shrink-0 cursor-grab text-[var(--ink-muted)]"
            aria-hidden
          />
        )}
        <h2 className="m-0 min-w-0 flex-1 truncate text-[15px] font-semibold">{title}</h2>
        {editing && (
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              className={iconButton}
              aria-label={t('dashboards.moveUp', { title })}
              disabled={place.index === 0}
              onClick={() => onMove({ column: place.column, index: place.index - 1 })}
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              className={iconButton}
              aria-label={t('dashboards.moveDown', { title })}
              disabled={place.index === last}
              onClick={() => onMove({ column: place.column, index: place.index + 1 })}
            >
              <ArrowDown size={14} />
            </button>
            {columns.length > 1 && (
              <>
                <button
                  type="button"
                  className={iconButton}
                  aria-label={t('dashboards.moveLeft', { title })}
                  disabled={place.column === 0}
                  onClick={() => onMove({ column: place.column - 1, index: place.index })}
                >
                  <ArrowLeft size={14} />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  aria-label={t('dashboards.moveRight', { title })}
                  disabled={place.column === columns.length - 1}
                  onClick={() => onMove({ column: place.column + 1, index: place.index })}
                >
                  <ArrowRight size={14} />
                </button>
              </>
            )}
            <button
              type="button"
              className={iconButton}
              aria-label={t('dashboards.editGadgetNamed', { title })}
              onClick={onEdit}
            >
              <PencilSimple size={14} />
            </button>
            <button
              type="button"
              className={iconButton}
              aria-label={t('dashboards.removeGadget', { title })}
              onClick={onRemove}
            >
              <Trash size={14} />
            </button>
          </div>
        )}
      </div>
      <GadgetBody config={gadget.config} />
    </section>
  );
}

/** The gadgets of a dashboard in their columns; the owner arranges them in edit mode. */
export function DashboardView({
  dashboard,
  embedded = false,
}: {
  dashboard: Dashboard;
  embedded?: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState<{ gadget?: Gadget } | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const key = ['dashboard', dashboard.id];
  const arrange = useMutation({
    mutationFn: (columns: Gadget[][]) =>
      unwrap(
        client.PUT('/api/v1/dashboards/{id}/arrangement', {
          params: { path: { id: dashboard.id } },
          body: { columns: columns.map((gadgets) => gadgets.map((gadget) => gadget.id)) },
        }),
      ),
    onMutate: (columns) => queryClient.setQueryData<Dashboard>(key, { ...dashboard, columns }),
    onSuccess: (saved) => queryClient.setQueryData(key, saved),
    onError: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const remove = useMutation({
    mutationFn: (gadgetId: string) =>
      unwrap(
        client.DELETE('/api/v1/dashboards/{id}/gadgets/{gadgetId}', {
          params: { path: { id: dashboard.id, gadgetId } },
        }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const move = (id: string, to: Place) => arrange.mutate(moved(dashboard.columns, id, to));
  const empty = dashboard.columns.every((gadgets) => gadgets.length === 0);
  return (
    <div className="flex flex-col gap-4">
      {dashboard.editable && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={editing ? 'primary' : 'secondary'} onClick={() => setEditing(!editing)}>
            {editing ? t('dashboards.done') : t('dashboards.arrange')}
          </Button>
          <Button onClick={() => setDialog({})}>{t('dashboards.addGadget')}</Button>
          {embedded && (
            <Link
              to="/dashboards/$id"
              params={{ id: dashboard.id }}
              className="text-[13px] font-medium text-[var(--accent)] no-underline hover:underline"
            >
              {t('dashboards.open')}
            </Link>
          )}
        </div>
      )}
      {(arrange.error ?? remove.error) && (
        <FormError message={(arrange.error ?? remove.error)?.message ?? ''} />
      )}
      {empty ? (
        <Muted>{dashboard.editable ? t('dashboards.emptyEditable') : t('dashboards.empty')}</Muted>
      ) : (
        <div className={`grid items-start gap-4 ${GRID[dashboard.layout]}`}>
          {dashboard.columns.map((gadgets, column) => (
            // biome-ignore lint/a11y/noStaticElementInteractions: a pointer drop zone; the arrow buttons move gadgets by keyboard
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional
              key={column}
              className={`flex min-w-0 flex-col gap-4 ${editing ? 'min-h-24 rounded-lg outline-1 outline-[var(--border)] outline-dashed' : ''}`}
              onDragOver={(event) => editing && event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (dragged) move(dragged, { column, index: gadgets.length });
                setDragged(null);
              }}
            >
              {gadgets.map((gadget, index) => (
                <GadgetCard
                  key={gadget.id}
                  gadget={gadget}
                  place={{ column, index }}
                  columns={dashboard.columns}
                  editing={editing}
                  onMove={(to) => move(gadget.id, to)}
                  onEdit={() => setDialog({ gadget })}
                  onRemove={() => {
                    if (window.confirm(t('dashboards.removeConfirm'))) remove.mutate(gadget.id);
                  }}
                  onDragStart={() => setDragged(gadget.id)}
                  onDrop={() => {
                    if (dragged && dragged !== gadget.id) move(dragged, { column, index });
                    setDragged(null);
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      )}
      <GadgetDialog
        dashboard={dashboard}
        editing={dialog?.gadget}
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
      />
    </div>
  );
}

export function DashboardPage({ id, me }: { id: string; me: Me }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dashboard = useQuery(dashboardQuery(id));
  const [settings, setSettings] = useState(false);
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dashboard', id] }),
      queryClient.invalidateQueries({ queryKey: ['dashboards'] }),
    ]);
  const home = useMutation({
    mutationFn: (on: boolean) =>
      unwrap(
        on
          ? client.PUT('/api/v1/dashboards/{id}/home', { params: { path: { id } } })
          : client.DELETE('/api/v1/dashboards/{id}/home', { params: { path: { id } } }),
      ),
    onSuccess: refresh,
  });
  const copy = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/dashboards/{id}/copy', {
          params: { path: { id } },
          body: { name: t('dashboards.copyName', { name: dashboard.data?.name ?? '' }) },
        }),
      ),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      await navigate({ to: '/dashboards/$id', params: { id: created.id } });
    },
  });
  const remove = useMutation({
    mutationFn: () =>
      unwrap(client.DELETE('/api/v1/dashboards/{id}', { params: { path: { id } } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      await queryClient.invalidateQueries({ queryKey: ['favourites'] });
      await navigate({ to: '/dashboards' });
    },
  });
  if (dashboard.error) {
    return (
      <>
        <TopBar crumbs={[t('dashboards.title')]} />
        <main className="px-10 py-6">
          <FormError message={dashboard.error.message} />
        </main>
      </>
    );
  }
  const data = dashboard.data;
  if (!data) return null;
  return (
    <>
      <TopBar
        crumbs={[
          <Link key="list" to="/dashboards" className="text-inherit no-underline hover:underline">
            {t('dashboards.title')}
          </Link>,
          data.name,
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <FavouriteButton
              kind="dashboard"
              refId={data.id}
              active={data.favourite}
              name={data.name}
            />
            <Button size="sm" disabled={home.isPending} onClick={() => home.mutate(!data.home)}>
              {data.home ? t('dashboards.unsetHome') : t('dashboards.setHome')}
            </Button>
            <Button size="sm" disabled={copy.isPending} onClick={() => copy.mutate()}>
              {t('dashboards.copy')}
            </Button>
            {data.editable && (
              <>
                <Button size="sm" onClick={() => setSettings(true)}>
                  {t('dashboards.settings')}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(t('dashboards.deleteConfirm', { name: data.name })))
                      remove.mutate();
                  }}
                >
                  {t('dashboards.delete')}
                </Button>
              </>
            )}
          </div>
        }
      />
      <main className="flex flex-col gap-4 px-6 py-6 lg:px-10">
        <header className="flex flex-col gap-1">
          <h1 className="m-0 text-[26px] leading-tight font-semibold tracking-[-0.015em]">
            {data.name}
          </h1>
          <p className="m-0 text-[13px] text-[var(--ink-muted)]">
            {data.description ||
              (data.owner.id === me.id
                ? t('dashboards.yours')
                : t('dashboards.by', { name: data.owner.displayName }))}
          </p>
        </header>
        {(home.error ?? copy.error ?? remove.error) && (
          <FormError message={(home.error ?? copy.error ?? remove.error)?.message ?? ''} />
        )}
        <DashboardView dashboard={data} />
      </main>
      <DashboardDialog
        open={settings}
        onOpenChange={setSettings}
        editing={data}
        canShare={me.globalPermissions.includes('share-filters')}
      />
    </>
  );
}

/** The usual home, or the dashboard the person chose as start page (TL-20). */
export function StartPage({ me }: { me: Me }) {
  const home = useQuery(dashboardsQuery('home'));
  const id = home.data?.[0]?.id;
  if (home.isPending) return null;
  if (!id) return <HomePage me={me} />;
  return <DashboardPage id={id} me={me} />;
}
