import { ArrowDown, ArrowUp, Plus, Trash, X } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { Board, EstimationField, SwimlaneMode } from '@tasklore/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { trackingMetaQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';
import { StatusLozenge, useMetaName } from '../tracking/icons';

interface ColumnDraft {
  id?: string;
  key: string;
  name: string;
  statusIds: string[];
  wipMin: string;
  wipMax: string;
}

interface FilterDraft {
  id?: string;
  key: string;
  name: string;
  query: string;
}

const control =
  'h-[var(--control-sm)] rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2';
const iconButton =
  'grid size-7 shrink-0 place-items-center rounded-[var(--radius-md)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] disabled:opacity-40';

let draftCounter = 0;
const nextKey = () => {
  draftCounter += 1;
  return `draft-${draftCounter}`;
};

/** Scope, swimlanes, columns with statuses and WIP limits, quick filters (T-BRD-03 to -07). */
export function BoardSettingsDialog({
  board,
  open,
  onOpenChange,
}: {
  board: Board;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const metaName = useMetaName();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const statuses = useQuery(trackingMetaQuery).data?.statuses ?? [];
  const [name, setName] = useState(board.name);
  const [query, setQuery] = useState(board.query);
  const [swimlanes, setSwimlanes] = useState<SwimlaneMode>(board.swimlanes);
  const [hideDone, setHideDone] = useState('');
  const [estimation, setEstimation] = useState<EstimationField>(board.estimation);
  const [parallel, setParallel] = useState(board.parallelSprints);
  const [columns, setColumns] = useState<ColumnDraft[]>([]);
  const [filters, setFilters] = useState<FilterDraft[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(board.name);
    setQuery(board.query);
    setSwimlanes(board.swimlanes);
    setHideDone(board.hideDoneAfterDays?.toString() ?? '');
    setEstimation(board.estimation);
    setParallel(board.parallelSprints);
    setColumns(
      board.columns.map((column) => ({
        id: column.id,
        key: column.id,
        name: column.name,
        statusIds: column.statusIds,
        wipMin: column.wipMin?.toString() ?? '',
        wipMax: column.wipMax?.toString() ?? '',
      })),
    );
    setFilters(board.quickFilters.map((filter) => ({ ...filter, key: filter.id })));
    setConfirmDelete(false);
  }, [open, board]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['board', board.id] });
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        client.PATCH('/api/v1/boards/{id}', {
          params: { path: { id: board.id } },
          body: {
            name,
            query,
            swimlanes,
            ...(board.type === 'kanban'
              ? { hideDoneAfterDays: hideDone.trim() ? Number(hideDone) : null }
              : { estimation, parallelSprints: parallel }),
            columns: columns.map((column) => ({
              ...(column.id ? { id: column.id } : {}),
              name: column.name,
              statusIds: column.statusIds,
              wipMin: column.wipMin.trim() ? Number(column.wipMin) : null,
              wipMax: column.wipMax.trim() ? Number(column.wipMax) : null,
            })),
            quickFilters: filters.map((filter) => ({
              ...(filter.id ? { id: filter.id } : {}),
              name: filter.name,
              query: filter.query,
            })),
          },
        }),
      ),
    onSuccess: async () => {
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ['boards'] });
      onOpenChange(false);
    },
  });
  const remove = useMutation({
    mutationFn: () =>
      unwrap(client.DELETE('/api/v1/boards/{id}', { params: { path: { id: board.id } } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['boards'] });
      onOpenChange(false);
      await navigate({ to: '/boards' });
    },
  });

  const update = (key: string, change: Partial<ColumnDraft>) =>
    setColumns(columns.map((column) => (column.key === key ? { ...column, ...change } : column)));
  const shift = (index: number, by: number) => {
    const next = [...columns];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(index + by, 0, moved);
    setColumns(next);
  };
  const mapped = new Set(columns.flatMap((column) => column.statusIds));
  const unmapped = statuses.filter((status) => !mapped.has(status.id));
  const statusById = new Map(statuses.map((status) => [status.id, status]));

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('boards.settings')} width={760}>
      <form className="flex flex-col gap-5" onSubmit={submit}>
        {save.error && <FormError message={save.error.message} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label={t('boards.name')}
            value={name}
            required
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
          />
          <label className="flex flex-col gap-1.5">
            <span className="tl-label text-[var(--ink-muted)]">{t('boards.swimlanes')}</span>
            <select
              value={swimlanes}
              onChange={(event) => setSwimlanes(event.target.value as SwimlaneMode)}
              className={`${control} h-[var(--control-md)]`}
            >
              <option value="none">{t('boards.lanes.none')}</option>
              <option value="assignee">{t('boards.lanes.assignee')}</option>
              <option value="epic">{t('boards.lanes.epic')}</option>
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="tl-label text-[var(--ink-muted)]">{t('boards.query')}</span>
          <textarea
            value={query}
            rows={2}
            onChange={(event) => setQuery(event.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 py-1.5 font-[family-name:var(--font-mono)] text-sm"
          />
          <span className="text-xs text-[var(--ink-muted)]">{t('boards.queryHelp')}</span>
        </label>
        {board.type === 'scrum' && (
          <label className="flex flex-col gap-1.5">
            <span className="tl-label text-[var(--ink-muted)]">{t('sprints.estimation')}</span>
            <select
              value={estimation}
              onChange={(event) => setEstimation(event.target.value as EstimationField)}
              className={`${control} h-[var(--control-md)]`}
            >
              <option value="storyPoints">{t('sprints.estimations.storyPoints')}</option>
              <option value="originalEstimate">{t('sprints.estimations.originalEstimate')}</option>
              <option value="issueCount">{t('sprints.estimations.issueCount')}</option>
            </select>
          </label>
        )}
        {board.type === 'scrum' && (
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={parallel}
              onChange={(event) => setParallel(event.target.checked)}
              className="mt-1"
            />
            <span className="flex flex-col">
              {t('sprints.parallel')}
              <span className="text-xs text-[var(--ink-muted)]">{t('sprints.parallelHelp')}</span>
            </span>
          </label>
        )}
        {board.type === 'kanban' && (
          <TextField
            label={t('boards.hideDone')}
            type="number"
            min={1}
            max={365}
            value={hideDone}
            help={t('boards.hideDoneHelp')}
            onChange={(event) => setHideDone(event.target.value)}
          />
        )}

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="tl-label mb-2 text-[var(--ink-muted)]">{t('boards.columns')}</legend>
          {columns.map((column, index) => (
            <div
              key={column.key}
              className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] p-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <input
                  aria-label={t('boards.columnName')}
                  value={column.name}
                  maxLength={40}
                  required
                  onChange={(event) => update(column.key, { name: event.target.value })}
                  className={`${control} min-w-40 flex-1`}
                />
                <label className="flex items-center gap-1 text-xs text-[var(--ink-muted)]">
                  {t('boards.wipMin')}
                  <input
                    type="number"
                    min={0}
                    value={column.wipMin}
                    onChange={(event) => update(column.key, { wipMin: event.target.value })}
                    className={`${control} w-16`}
                  />
                </label>
                <label className="flex items-center gap-1 text-xs text-[var(--ink-muted)]">
                  {t('boards.wipMax')}
                  <input
                    type="number"
                    min={0}
                    value={column.wipMax}
                    onChange={(event) => update(column.key, { wipMax: event.target.value })}
                    className={`${control} w-16`}
                  />
                </label>
                <button
                  type="button"
                  className={iconButton}
                  disabled={index === 0}
                  aria-label={t('boards.columnUp', { name: column.name })}
                  onClick={() => shift(index, -1)}
                >
                  <ArrowUp size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  disabled={index === columns.length - 1}
                  aria-label={t('boards.columnDown', { name: column.name })}
                  onClick={() => shift(index, 1)}
                >
                  <ArrowDown size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  disabled={columns.length === 1}
                  aria-label={t('boards.removeColumn', { name: column.name })}
                  onClick={() => setColumns(columns.filter((entry) => entry.key !== column.key))}
                >
                  <Trash size={14} aria-hidden />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {column.statusIds.map((statusId) => {
                  const status = statusById.get(statusId);
                  return (
                    <span key={statusId} className="flex items-center gap-0.5">
                      {status && <StatusLozenge status={status} />}
                      <button
                        type="button"
                        className={iconButton}
                        aria-label={t('boards.removeStatus', {
                          status: status ? metaName('status', status) : statusId,
                          column: column.name,
                        })}
                        onClick={() =>
                          update(column.key, {
                            statusIds: column.statusIds.filter((entry) => entry !== statusId),
                          })
                        }
                      >
                        <X size={12} aria-hidden />
                      </button>
                    </span>
                  );
                })}
                {unmapped.length > 0 && (
                  <select
                    aria-label={t('boards.addStatus', { column: column.name })}
                    value=""
                    onChange={(event) =>
                      event.target.value &&
                      update(column.key, { statusIds: [...column.statusIds, event.target.value] })
                    }
                    className={`${control} text-xs`}
                  >
                    <option value="">{t('boards.addStatusOption')}</option>
                    {unmapped.map((status) => (
                      <option key={status.id} value={status.id}>
                        {metaName('status', status)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              size="sm"
              onClick={() =>
                setColumns([
                  ...columns,
                  {
                    key: nextKey(),
                    name: t('boards.newColumn'),
                    statusIds: [],
                    wipMin: '',
                    wipMax: '',
                  },
                ])
              }
            >
              <Plus size={14} aria-hidden />
              {t('boards.addColumn')}
            </Button>
            {unmapped.length > 0 && (
              <span className="text-xs text-[var(--ink-muted)]">
                {t('boards.unmapped', {
                  statuses: unmapped.map((status) => metaName('status', status)).join(', '),
                })}
              </span>
            )}
          </div>
        </fieldset>

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="tl-label mb-2 text-[var(--ink-muted)]">
            {t('boards.quickFilters')}
          </legend>
          {filters.map((filter) => (
            <div key={filter.key} className="flex flex-wrap items-center gap-2">
              <input
                aria-label={t('boards.filterName')}
                placeholder={t('boards.filterName')}
                value={filter.name}
                maxLength={40}
                required
                onChange={(event) =>
                  setFilters(
                    filters.map((entry) =>
                      entry.key === filter.key ? { ...entry, name: event.target.value } : entry,
                    ),
                  )
                }
                className={`${control} w-40`}
              />
              <input
                aria-label={t('boards.filterQuery')}
                placeholder="labels = frontend"
                value={filter.query}
                required
                onChange={(event) =>
                  setFilters(
                    filters.map((entry) =>
                      entry.key === filter.key ? { ...entry, query: event.target.value } : entry,
                    ),
                  )
                }
                className={`${control} min-w-48 flex-1 font-[family-name:var(--font-mono)] text-sm`}
              />
              <button
                type="button"
                className={iconButton}
                aria-label={t('boards.removeFilter', { name: filter.name })}
                onClick={() => setFilters(filters.filter((entry) => entry.key !== filter.key))}
              >
                <Trash size={14} aria-hidden />
              </button>
            </div>
          ))}
          <Button
            size="sm"
            className="self-start"
            onClick={() => setFilters([...filters, { key: nextKey(), name: '', query: '' }])}
          >
            <Plus size={14} aria-hidden />
            {t('boards.addFilter')}
          </Button>
        </fieldset>

        {remove.error && <FormError message={remove.error.message} />}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {confirmDelete ? (
            <span className="flex items-center gap-2">
              <span>{t('boards.deleteConfirm')}</span>
              <Button variant="danger" size="sm" onClick={() => remove.mutate()}>
                {t('boards.delete')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                {t('common.cancel')}
              </Button>
            </span>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              {t('boards.delete')}
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={save.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
