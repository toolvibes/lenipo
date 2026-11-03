import { PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type {
  ApplyScenarioResult,
  PlanScenario,
  PlanView,
  ScenarioChange,
  TimelineRow,
} from '@toolvibes/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TopBar } from '../../ui/TopBar';
import { fromDay, toDay } from '../timeline/scale';
import { PlanDialog } from './PlansPage';

const LABEL = 'w-[260px] shrink-0 truncate pr-3';

/** The range of whole months around every bar and capacity month of the plan. */
function monthsOf(view: PlanView): string[] {
  const days: number[] = [];
  for (const project of view.projects) {
    for (const epic of project.epics) {
      for (const row of [epic, ...epic.children]) {
        if (row.span) days.push(toDay(row.span.start), toDay(row.span.end));
      }
    }
  }
  for (const entry of view.capacity) days.push(toDay(entry.month));
  const now = new Date();
  days.push(Date.UTC(now.getFullYear(), now.getMonth(), 1) / 86_400_000);
  const first = fromDay(Math.min(...days)).slice(0, 7);
  const last = fromDay(Math.max(...days)).slice(0, 7);
  const months: string[] = [];
  let [year, month] = first.split('-').map(Number) as [number, number];
  while (`${year}-${String(month).padStart(2, '0')}` <= last) {
    months.push(`${year}-${String(month).padStart(2, '0')}-01`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

function monthLabel(month: string, locale: string): string {
  return new Date(`${month}T00:00:00Z`).toLocaleDateString(locale, {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

/** A bar placed in the range from `start` to `end` (day numbers, end exclusive). */
function Bar({
  row,
  start,
  end,
  changed,
  epic,
}: {
  row: TimelineRow;
  start: number;
  end: number;
  changed: boolean;
  epic?: boolean;
}) {
  const { t } = useTranslation();
  if (!row.span) return null;
  const total = end - start;
  const left = ((toDay(row.span.start) - start) / total) * 100;
  const width = Math.max(((toDay(row.span.end) + 1 - toDay(row.span.start)) / total) * 100, 0.6);
  return (
    <span
      title={`${formatDate(row.span.start)} – ${formatDate(row.span.end)}${changed ? ` · ${t('plans.changed')}` : ''}`}
      className={`absolute top-1/2 h-3.5 -translate-y-1/2 rounded-[4px] ${
        epic ? 'bg-[var(--accent)]' : 'bg-[var(--accent-soft)] border border-[var(--accent)]'
      } ${row.span.derived ? 'opacity-60' : ''} ${changed ? 'outline-2 outline-dashed outline-offset-1 outline-[var(--warning)]' : ''}`}
      style={{ left: `${left}%`, width: `${width}%` }}
    />
  );
}

/** Start, due date and points of an issue in the scenario. */
function ChangeForm({
  row,
  change,
  onSave,
  onReset,
  busy,
}: {
  row: TimelineRow;
  change: ScenarioChange | undefined;
  onSave: (change: ScenarioChange) => void;
  onReset: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState(row.issue.startDate ?? '');
  const [dueDate, setDueDate] = useState(row.issue.dueDate ?? '');
  const [points, setPoints] = useState(row.issue.storyPoints?.toString() ?? '');
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      startDate: startDate || null,
      dueDate: dueDate || null,
      storyPoints: points === '' ? null : Number(points),
    });
  }
  const field =
    'h-8 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-[13px]';
  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px]"
    >
      <label className="flex flex-col gap-0.5">
        {t('issues.startDate')}
        <input
          type="date"
          className={field}
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-0.5">
        {t('issues.dueDate')}
        <input
          type="date"
          className={field}
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-0.5">
        {t('issues.storyPoints')}
        <input
          type="number"
          min={0}
          step="any"
          className={`${field} w-20`}
          value={points}
          onChange={(event) => setPoints(event.target.value)}
        />
      </label>
      <Button type="submit" size="sm" variant="primary" disabled={busy}>
        {t('plans.saveChange')}
      </Button>
      {change && (
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onReset}>
          {t('plans.resetChange')}
        </Button>
      )}
    </form>
  );
}

/**
 * A cross-project plan (T-RDM-03, T-RDM-04, TL-46, E-136): the epics of its projects over the
 * months, capacity against planned points, and scenarios that move dates and points.
 */
export function PlanPage({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState(false);
  const [result, setResult] = useState<ApplyScenarioResult | null>(null);
  const view = useQuery({
    queryKey: ['plan', id, 'view', scenarioId],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/plans/{id}/view', {
          params: { path: { id }, query: scenarioId ? { scenario: scenarioId } : {} },
        }),
      ),
    placeholderData: (previous) => previous,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['plan', id] });
  const path = { params: { path: { id } } };
  const createScenario = useMutation({
    mutationFn: (name: string) =>
      unwrap(client.POST('/api/v1/plans/{id}/scenarios', { ...path, body: { name } })),
    onSuccess: async (scenario: PlanScenario) => {
      await refresh();
      setScenarioId(scenario.id);
    },
  });
  const removeScenario = useMutation({
    mutationFn: (scenario: string) =>
      unwrap(
        client.DELETE('/api/v1/plans/{id}/scenarios/{scenarioId}', {
          params: { path: { id, scenarioId: scenario } },
        }),
      ),
    onSuccess: async () => {
      setScenarioId(null);
      await refresh();
    },
  });
  const setChange = useMutation({
    mutationFn: ({ key, change }: { key: string; change: ScenarioChange }) =>
      unwrap(
        client.PUT('/api/v1/plans/{id}/scenarios/{scenarioId}/changes/{key}', {
          params: { path: { id, scenarioId: scenarioId ?? '', key } },
          body: change,
        }),
      ),
    onSuccess: async () => {
      setEditing(null);
      await refresh();
    },
  });
  const apply = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/plans/{id}/scenarios/{scenarioId}/apply', {
          params: { path: { id, scenarioId: scenarioId ?? '' } },
          body: {},
        }),
      ),
    onSuccess: async (applied) => {
      setResult(applied);
      await queryClient.invalidateQueries();
    },
  });
  const setCapacity = useMutation({
    mutationFn: (body: { projectKey: string; month: string; points: number | null }) =>
      unwrap(client.PUT('/api/v1/plans/{id}/capacity', { ...path, body })),
    onSuccess: refresh,
  });
  const error =
    view.error ??
    createScenario.error ??
    removeScenario.error ??
    setChange.error ??
    apply.error ??
    setCapacity.error;

  const data = view.data;
  if (!data) {
    return error ? <p className="px-6 py-8 text-[var(--danger)]">{error.message}</p> : null;
  }
  const { plan } = data;
  const scenario = data.scenarios.find((entry) => entry.id === data.scenarioId) ?? null;
  const changes = new Map(scenario?.changes.map((entry) => [entry.key, entry.change]));
  const months = monthsOf(data);
  const start = toDay(months[0] ?? fromDay(0));
  const lastMonth = months.at(-1) ?? fromDay(0);
  const [lastYear, lastMonthNumber] = lastMonth.split('-').map(Number) as [number, number];
  const end = Date.UTC(lastYear, lastMonthNumber, 1) / 86_400_000;
  const editable = plan.canEdit && scenario !== null;

  const childRow = (row: TimelineRow) => {
    const isChanged = changes.has(row.issue.key);
    return (
      <div key={row.issue.id}>
        <div className="flex h-8 items-center border-b border-[var(--border)] text-[13px]">
          <span className={`${LABEL} flex items-center gap-1.5 pl-8`}>
            <Link
              to="/issues/$key"
              params={{ key: row.issue.key }}
              className="tl-key shrink-0 text-[var(--ink-muted)]"
            >
              {row.issue.key}
            </Link>
            <span className="truncate">{row.issue.summary}</span>
            {editable && (
              <button
                type="button"
                aria-label={t('plans.changeIssue', { key: row.issue.key })}
                onClick={() => setEditing(editing === row.issue.key ? null : row.issue.key)}
                className="ml-auto grid size-6 shrink-0 place-items-center rounded-[var(--radius-sm)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
              >
                <PencilSimple size={14} aria-hidden />
              </button>
            )}
          </span>
          <span className="relative h-full flex-1">
            <Bar row={row} start={start} end={end} changed={isChanged} />
          </span>
        </div>
        {editing === row.issue.key && (
          <ChangeForm
            row={row}
            change={changes.get(row.issue.key)}
            busy={setChange.isPending}
            onSave={(change) => setChange.mutate({ key: row.issue.key, change })}
            onReset={() => setChange.mutate({ key: row.issue.key, change: {} })}
          />
        )}
      </div>
    );
  };

  return (
    <main className="flex flex-col">
      <TopBar
        crumbs={[
          <Link key="plans" to="/plans">
            {t('plans.title')}
          </Link>,
          plan.name,
        ]}
        actions={
          plan.canEdit && (
            <Button size="sm" variant="ghost" onClick={() => setEditingPlan(true)}>
              <PencilSimple size={16} aria-hidden />
              {t('plans.edit')}
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-5 px-6 py-5">
        <header className="flex flex-col gap-1">
          <h1 className="tl-heading-xl">{plan.name}</h1>
          {plan.description && <p className="m-0 text-[var(--ink-muted)]">{plan.description}</p>}
          <p className="m-0 text-xs text-[var(--ink-muted)]">
            {plan.projects.map((project) => project.name).join(' · ')}
            {plan.tql && <span className="tl-key"> · {plan.tql}</span>}
          </p>
        </header>
        {error && <FormError message={error.message} />}

        <section aria-label={t('plans.scenarios')} className="flex flex-wrap items-end gap-2">
          <div className="min-w-56">
            <Select
              label={t('plans.scenario')}
              value={scenarioId ?? ''}
              options={[
                { value: '', label: t('plans.reality') },
                ...data.scenarios.map((entry) => ({
                  value: entry.id,
                  label: t('plans.scenarioName', { name: entry.name, count: entry.changes.length }),
                })),
              ]}
              onChange={(event) => {
                setResult(null);
                setEditing(null);
                setScenarioId(event.target.value || null);
              }}
            />
          </div>
          {plan.canEdit && (
            <Button
              size="sm"
              onClick={() => {
                const name = window.prompt(t('plans.scenarioPrompt'));
                if (name?.trim()) createScenario.mutate(name.trim());
              }}
            >
              <Plus size={16} aria-hidden />
              {t('plans.newScenario')}
            </Button>
          )}
          {editable && scenario && (
            <>
              <Button
                size="sm"
                variant="primary"
                disabled={apply.isPending || scenario.changes.length === 0}
                onClick={() => {
                  if (window.confirm(t('plans.applyConfirm', { count: scenario.changes.length })))
                    apply.mutate();
                }}
              >
                {t('plans.apply')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (window.confirm(t('plans.deleteScenarioConfirm', { name: scenario.name })))
                    removeScenario.mutate(scenario.id);
                }}
              >
                <Trash size={16} aria-hidden />
                {t('plans.deleteScenario')}
              </Button>
            </>
          )}
        </section>
        {editable && <p className="m-0 text-xs text-[var(--ink-muted)]">{t('plans.editHint')}</p>}
        {result && (
          <p role="status" className="m-0 text-[13.5px]">
            {t('plans.applied', { count: result.applied.length })}
            {result.skipped.length > 0 &&
              ` ${t('plans.skipped')} ${result.skipped
                .map((entry) => `${entry.key} (${t(`plans.reasons.${entry.reason}`)})`)
                .join(', ')}`}
          </p>
        )}

        <section aria-label={t('plans.timeline')} className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="flex h-8 items-center border-b border-[var(--border)] text-xs text-[var(--ink-muted)]">
              <span className={LABEL} />
              <span className="flex flex-1">
                {months.map((month) => (
                  <span key={month} className="flex-1 border-l border-[var(--border)] pl-1">
                    {monthLabel(month, i18n.language)}
                  </span>
                ))}
              </span>
            </div>
            {data.projects.map((project) => (
              <div key={project.key}>
                <div className="flex h-8 items-center border-b border-[var(--border)] bg-[var(--surface-2)] text-[13px] font-semibold">
                  <span className={`${LABEL} pl-1`}>
                    {project.name}{' '}
                    <span className="tl-key text-[var(--ink-muted)]">{project.key}</span>
                  </span>
                </div>
                {project.epics.length === 0 && (
                  <p className="m-0 border-b border-[var(--border)] py-1.5 pl-4 text-[13px] text-[var(--ink-muted)]">
                    {t('plans.noEpics')}
                  </p>
                )}
                {project.epics.map((epic) => (
                  <div key={epic.issue.id}>
                    <div className="flex h-8 items-center border-b border-[var(--border)] text-[13px] font-medium">
                      <span className={`${LABEL} pl-4`}>
                        <Link
                          to="/issues/$key"
                          params={{ key: epic.issue.key }}
                          className="tl-key mr-1.5 text-[var(--ink-muted)]"
                        >
                          {epic.issue.key}
                        </Link>
                        {epic.issue.summary}
                      </span>
                      <span className="relative h-full flex-1">
                        <Bar
                          row={epic}
                          start={start}
                          end={end}
                          changed={changes.has(epic.issue.key)}
                          epic
                        />
                      </span>
                    </div>
                    {epic.children.map(childRow)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section aria-label={t('plans.capacity')} className="flex flex-col gap-2 overflow-x-auto">
          <h2 className="tl-heading-md m-0">{t('plans.capacity')}</h2>
          <p className="m-0 text-xs text-[var(--ink-muted)]">{t('plans.capacityHelp')}</p>
          <table className="border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-xs text-[var(--ink-muted)]">
                <th className="py-1 pr-3 font-medium">{t('plans.project')}</th>
                {months.map((month) => (
                  <th key={month} className="px-2 py-1 text-right font-medium">
                    {monthLabel(month, i18n.language)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.projects.map((project) => (
                <tr key={project.key} className="border-t border-[var(--border)]">
                  <th scope="row" className="py-1 pr-3 text-left font-medium">
                    {project.key}
                  </th>
                  {months.map((month) => {
                    const cell = data.capacity.find(
                      (entry) => entry.projectKey === project.key && entry.month === month,
                    );
                    const planned = cell?.planned ?? 0;
                    const over = cell?.capacity != null && planned > cell.capacity;
                    return (
                      <td key={month} className="px-2 py-1 text-right whitespace-nowrap">
                        <span
                          className={over ? 'font-semibold text-[var(--danger)]' : undefined}
                          title={over ? t('plans.overloaded') : undefined}
                        >
                          {planned}
                          {over && <span className="sr-only"> ({t('plans.overloaded')})</span>}
                        </span>
                        {' / '}
                        {plan.canEdit ? (
                          <input
                            key={`${project.key}:${month}:${cell?.capacity ?? ''}`}
                            type="number"
                            min={0}
                            step="any"
                            aria-label={t('plans.capacityFor', {
                              project: project.key,
                              month: monthLabel(month, i18n.language),
                            })}
                            defaultValue={cell?.capacity ?? ''}
                            onBlur={(event) => {
                              const value = event.target.value;
                              const points = value === '' ? null : Number(value);
                              if (points !== (cell?.capacity ?? null))
                                setCapacity.mutate({ projectKey: project.key, month, points });
                            }}
                            className="h-7 w-14 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-1 text-right"
                          />
                        ) : (
                          (cell?.capacity ?? '–')
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      {editingPlan && <PlanDialog plan={plan} open onOpenChange={setEditingPlan} />}
    </main>
  );
}
