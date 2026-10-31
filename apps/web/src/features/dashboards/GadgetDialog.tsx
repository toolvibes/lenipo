import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type Dashboard,
  GADGET_TYPES,
  type Gadget,
  type GadgetConfig,
  type GadgetType,
  STATISTIC_FIELDS,
  type StatisticField,
} from '@tasklore/shared';
import { type FormEvent, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { boardsQuery } from '../../lib/boards';
import { everythingQuery, filtersQuery } from '../../lib/search';
import { projectsQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';

/** The starting settings of a new gadget of each type. */
function initial(type: GadgetType): GadgetConfig {
  switch (type) {
    case 'filter-results':
      return { type, query: '', limit: 10 };
    case 'assigned-to-me':
      return { type, limit: 10 };
    case 'activity':
      return { type, projectKey: null, limit: 10 };
    case 'pie':
      return { type, query: '', field: 'status' };
    case 'two-dimensional':
      return { type, query: '', x: 'status', y: 'assignee' };
    case 'created-vs-resolved':
      return { type, query: '', days: 30 };
    case 'sprint-burndown':
      return { type, boardId: '' };
    case 'calendar':
      return { type, query: 'due is not EMPTY' };
    case 'wiki-page':
      return { type, pageId: '' };
    case 'text':
      return { type, markdown: '' };
  }
}

function complete(config: GadgetConfig): boolean {
  if (config.type === 'sprint-burndown') return !!config.boardId;
  if (config.type === 'wiki-page') return !!config.pageId;
  if (config.type === 'text') return config.markdown.trim() !== '';
  return true;
}

/** A TQL query, optionally taken from a saved filter. */
function QueryField({ value, onChange }: { value: string; onChange: (query: string) => void }) {
  const { t } = useTranslation();
  const filters = useQuery(filtersQuery());
  return (
    <div className="flex flex-col gap-2">
      {(filters.data ?? []).length > 0 && (
        <Select
          label={t('dashboards.config.filter')}
          value=""
          options={[
            { value: '', label: t('dashboards.config.chooseFilter') },
            ...(filters.data ?? []).map((filter) => ({ value: filter.query, label: filter.name })),
          ]}
          onChange={(event) => event.target.value && onChange(event.target.value)}
        />
      )}
      <TextField
        label={t('dashboards.config.query')}
        help={t('dashboards.config.queryHelp')}
        value={value}
        className="font-[family-name:var(--font-mono)]"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: StatisticField;
  onChange: (field: StatisticField) => void;
}) {
  const { t } = useTranslation();
  return (
    <Select
      label={label}
      value={value}
      options={STATISTIC_FIELDS.map((field) => ({
        value: field,
        label: t(`dashboards.fields.${field}`),
      }))}
      onChange={(event) => onChange(event.target.value as StatisticField)}
    />
  );
}

function PagePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const pages = useQuery(everythingQuery(q, 'page'));
  const listId = useId();
  return (
    <div className="flex flex-col gap-2">
      <TextField
        label={t('dashboards.config.page')}
        value={q}
        placeholder={t('dashboards.config.pageSearch')}
        onChange={(event) => setQ(event.target.value)}
      />
      {q.trim() && (
        <ul
          id={listId}
          aria-label={t('dashboards.config.page')}
          className="m-0 flex max-h-48 list-none flex-col overflow-y-auto p-0"
        >
          {(pages.data?.pages ?? []).map((page) => (
            <li key={page.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[13px] hover:bg-[var(--selected)]">
                <input
                  type="radio"
                  name={listId}
                  checked={value === page.id}
                  onChange={() => onChange(page.id)}
                />
                <span className="min-w-0 flex-1 truncate">{page.title}</span>
                <span className="text-xs text-[var(--ink-muted)]">{page.space.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {value && !q.trim() && (
        <span className="text-xs text-[var(--ink-muted)]">{t('dashboards.config.pageChosen')}</span>
      )}
    </div>
  );
}

function ConfigFields({
  config,
  onChange,
}: {
  config: GadgetConfig;
  onChange: (config: GadgetConfig) => void;
}) {
  const { t } = useTranslation();
  const boards = useQuery({ ...boardsQuery(), enabled: config.type === 'sprint-burndown' });
  const projects = useQuery({ ...projectsQuery, enabled: config.type === 'activity' });
  const limit = (value: number) => (
    <TextField
      label={t('dashboards.config.limit')}
      type="number"
      min={1}
      max={50}
      value={String(value)}
      onChange={(event) =>
        onChange({
          ...config,
          limit: Math.max(1, Math.min(50, Number(event.target.value) || 1)),
        } as GadgetConfig)
      }
    />
  );
  switch (config.type) {
    case 'filter-results':
      return (
        <>
          <QueryField value={config.query} onChange={(query) => onChange({ ...config, query })} />
          {limit(config.limit)}
        </>
      );
    case 'assigned-to-me':
      return limit(config.limit);
    case 'activity':
      return (
        <>
          <Select
            label={t('dashboards.config.project')}
            value={config.projectKey ?? ''}
            options={[
              { value: '', label: t('dashboards.config.allProjects') },
              ...(projects.data ?? []).map((project) => ({
                value: project.key,
                label: `${project.name} (${project.key})`,
              })),
            ]}
            onChange={(event) => onChange({ ...config, projectKey: event.target.value || null })}
          />
          {limit(config.limit)}
        </>
      );
    case 'pie':
      return (
        <>
          <QueryField value={config.query} onChange={(query) => onChange({ ...config, query })} />
          <FieldSelect
            label={t('dashboards.config.field')}
            value={config.field}
            onChange={(field) => onChange({ ...config, field })}
          />
        </>
      );
    case 'two-dimensional':
      return (
        <>
          <QueryField value={config.query} onChange={(query) => onChange({ ...config, query })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldSelect
              label={t('dashboards.config.rows')}
              value={config.x}
              onChange={(x) => onChange({ ...config, x })}
            />
            <FieldSelect
              label={t('dashboards.config.columns')}
              value={config.y}
              onChange={(y) => onChange({ ...config, y })}
            />
          </div>
        </>
      );
    case 'created-vs-resolved':
      return (
        <>
          <QueryField value={config.query} onChange={(query) => onChange({ ...config, query })} />
          <Select
            label={t('dashboards.config.days')}
            value={String(config.days)}
            options={[7, 14, 30, 90, 180, 365].map((days) => ({
              value: String(days),
              label: t('dashboards.config.lastDays', { count: days }),
            }))}
            onChange={(event) => onChange({ ...config, days: Number(event.target.value) })}
          />
        </>
      );
    case 'sprint-burndown':
      return (
        <Select
          label={t('dashboards.config.board')}
          value={config.boardId}
          options={[
            { value: '', label: t('dashboards.config.chooseBoard') },
            ...(boards.data ?? [])
              .filter((board) => board.type === 'scrum')
              .map((board) => ({
                value: board.id,
                label: `${board.name} (${board.project.key})`,
              })),
          ]}
          onChange={(event) => onChange({ ...config, boardId: event.target.value })}
        />
      );
    case 'calendar':
      return (
        <QueryField value={config.query} onChange={(query) => onChange({ ...config, query })} />
      );
    case 'wiki-page':
      return (
        <PagePicker value={config.pageId} onChange={(pageId) => onChange({ ...config, pageId })} />
      );
    case 'text':
      return (
        <div className="flex flex-col gap-1">
          <label htmlFor="gadget-markdown" className="tl-field-label">
            {t('dashboards.config.markdown')}
          </label>
          <textarea
            id="gadget-markdown"
            rows={8}
            maxLength={20_000}
            value={config.markdown}
            className="rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] p-2 font-[family-name:var(--font-mono)] text-[13px] text-[var(--ink)]"
            onChange={(event) => onChange({ ...config, markdown: event.target.value })}
          />
        </div>
      );
  }
}

/** Adds a gadget, or changes title and settings of one; the type stays once added. */
export function GadgetDialog({
  dashboard,
  editing,
  open,
  onOpenChange,
}: {
  dashboard: Dashboard;
  editing?: Gadget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [column, setColumn] = useState(0);
  const [config, setConfig] = useState<GadgetConfig>(initial('filter-results'));
  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? '');
    setColumn(0);
    setConfig(editing?.config ?? initial('filter-results'));
  }, [open, editing]);
  const save = useMutation({
    mutationFn: () =>
      editing
        ? unwrap(
            client.PATCH('/api/v1/dashboards/{id}/gadgets/{gadgetId}', {
              params: { path: { id: dashboard.id, gadgetId: editing.id } },
              body: { title, config },
            }),
          )
        : unwrap(
            client.POST('/api/v1/dashboards/{id}/gadgets', {
              params: { path: { id: dashboard.id } },
              body: { title, column, config },
            }),
          ),
    onSuccess: (saved) => {
      queryClient.setQueryData(['dashboard', dashboard.id], saved);
      onOpenChange(false);
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t('dashboards.editGadget') : t('dashboards.addGadget')}
      width={560}
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {save.error && <FormError message={save.error.message} />}
        {!editing && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label={t('dashboards.config.type')}
              value={config.type}
              options={GADGET_TYPES.map((type) => ({
                value: type,
                label: t(`dashboards.types.${type}`),
              }))}
              onChange={(event) => setConfig(initial(event.target.value as GadgetType))}
            />
            {dashboard.columns.length > 1 && (
              <Select
                label={t('dashboards.config.column')}
                value={String(column)}
                options={dashboard.columns.map((_, index) => ({
                  value: String(index),
                  label: t('dashboards.config.columnN', { n: index + 1 }),
                }))}
                onChange={(event) => setColumn(Number(event.target.value))}
              />
            )}
          </div>
        )}
        <p className="m-0 text-xs text-[var(--ink-muted)]">
          {t(`dashboards.typeHelp.${config.type}`)}
        </p>
        <TextField
          label={t('dashboards.config.title')}
          value={title}
          maxLength={100}
          placeholder={t(`dashboards.types.${config.type}`)}
          onChange={(event) => setTitle(event.target.value)}
        />
        <ConfigFields config={config} onChange={setConfig} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={!complete(config) || save.isPending}>
            {editing ? t('common.save') : t('dashboards.add')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
