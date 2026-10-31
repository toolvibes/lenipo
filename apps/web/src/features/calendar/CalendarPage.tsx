import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { IssueSummary } from '@tasklore/shared';
import { type DragEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { trackingMetaQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { STATUS_TONE } from '../tracking/icons';

export type CalendarView = 'month' | 'week';

/** At most this many issues are placed; more need a narrower query. */
const LIMIT = 500;
const PAGE = 100;
const MONTH_CHIPS = 4;

const pad = (value: number) => String(value).padStart(2, '0');
const dayOf = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseDay = (day: string) => {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, date ?? 1);
};
const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
/** Monday of the week of `date`. */
const mondayOf = (date: Date) => addDays(date, -((date.getDay() + 6) % 7));

interface DateField {
  id: string;
  label: string;
  /** Changed by moving a card; false for timestamps the system sets. */
  editable: boolean;
  value: (issue: IssueSummary) => string | null;
  patch: (day: string) => Record<string, unknown>;
}

/** The local calendar day of a date or a point in time. */
function localDay(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length === 10 ? value : dayOf(new Date(value));
}

/** Without ORDER BY, so the query can be combined with the date range. */
function conditionsOf(query: string): string {
  return query.replace(/\s+order\s+by\s[\s\S]*$/i, '').trim();
}

/**
 * Issues on a calendar by any date field (T-VIEW-02, E-113): month or week, cards moved to
 * another day change the date where the field and the issue allow it.
 */
export function CalendarPage({
  query,
  field: fieldId,
  date,
  view,
}: {
  query: string;
  field: string;
  date: string | undefined;
  view: CalendarView;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const meta = useQuery(trackingMetaQuery).data;
  const [draft, setDraft] = useState(query);
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => setDraft(query), [query]);

  const fields = useMemo<DateField[]>(() => {
    const system: DateField[] = [
      {
        id: 'due',
        label: t('calendar.fields.due'),
        editable: true,
        value: (issue) => issue.dueDate,
        patch: (day) => ({ dueDate: day }),
      },
      {
        id: 'startDate',
        label: t('calendar.fields.startDate'),
        editable: true,
        value: (issue) => issue.startDate,
        patch: (day) => ({ startDate: day }),
      },
      {
        id: 'created',
        label: t('calendar.fields.created'),
        editable: false,
        value: (issue) => issue.createdAt,
        patch: () => ({}),
      },
      {
        id: 'updated',
        label: t('calendar.fields.updated'),
        editable: false,
        value: (issue) => issue.updatedAt,
        patch: () => ({}),
      },
      {
        id: 'resolved',
        label: t('calendar.fields.resolved'),
        editable: false,
        value: (issue) => issue.resolvedAt,
        patch: () => ({}),
      },
    ];
    const custom = (meta?.customFields ?? [])
      .filter((entry) => !entry.archived && (entry.type === 'date' || entry.type === 'datetime'))
      .map(
        (entry): DateField => ({
          id: `cf[${entry.number}]`,
          label: entry.name,
          editable: entry.type === 'date',
          value: (issue) => (issue.customFields[entry.id] as string | undefined) ?? null,
          patch: (day) => ({ customFields: { [entry.id]: day } }),
        }),
      );
    return [...system, ...custom];
  }, [meta, t]);
  const field = fields.find((entry) => entry.id === fieldId) ?? (fields[0] as DateField);

  const anchor = date ? parseDay(date) : new Date();
  const first =
    view === 'week'
      ? mondayOf(anchor)
      : mondayOf(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  const days = Array.from({ length: view === 'week' ? 7 : 42 }, (_, index) =>
    addDays(first, index),
  );
  const start = dayOf(days[0] as Date);
  const end = dayOf(addDays(days[days.length - 1] as Date, 1));

  const tql = [
    conditionsOf(query) ? `(${conditionsOf(query)})` : '',
    `${field.id} >= "${start}"`,
    `${field.id} < "${end}"`,
  ]
    .filter(Boolean)
    .join(' AND ');
  const results = useQuery({
    queryKey: ['calendar', tql],
    queryFn: async () => {
      const issues: IssueSummary[] = [];
      let total = 0;
      for (let offset = 0; offset < LIMIT; offset += PAGE) {
        const page = await unwrap(
          client.POST('/api/v1/search', { body: { query: tql, limit: PAGE, offset } }),
        );
        issues.push(...page.issues);
        total = page.total;
        if (issues.length >= total) break;
      }
      return { issues, total };
    },
  });

  const move = useMutation({
    mutationFn: ({ issue, day }: { issue: IssueSummary; day: string }) =>
      unwrap(
        client.PATCH('/api/v1/issues/{key}', {
          params: { path: { key: issue.key } },
          body: field.patch(day),
        }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['calendar'] }),
  });

  const byDay = new Map<string, IssueSummary[]>();
  for (const issue of results.data?.issues ?? []) {
    const day = localDay(field.value(issue));
    if (!day) continue;
    byDay.set(day, [...(byDay.get(day) ?? []), issue]);
  }

  const go = (next: Partial<{ q: string; field: string; date: string; view: CalendarView }>) =>
    void navigate({
      to: '/calendar',
      search: { q: query, field: field.id, date: dayOf(anchor), view, ...next },
    });
  const shift = (direction: number) =>
    go({
      date: dayOf(
        view === 'week'
          ? addDays(anchor, 7 * direction)
          : new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1),
      ),
    });
  const title =
    view === 'week'
      ? `${(days[0] as Date).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })} – ${(days[6] as Date).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })}`
      : anchor.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });
  const weekdays = days
    .slice(0, 7)
    .map((day) => day.toLocaleDateString(i18n.language, { weekday: 'short' }));
  const today = dayOf(new Date());

  function submit(event: FormEvent) {
    event.preventDefault();
    go({ q: draft });
  }
  const onDrop = (day: string) => (event: DragEvent) => {
    event.preventDefault();
    const key = event.dataTransfer.getData('text/plain');
    const issue = results.data?.issues.find((entry) => entry.key === key);
    if (issue && localDay(field.value(issue)) !== day) move.mutate({ issue, day });
  };

  return (
    <div className="flex flex-col gap-3 px-6 py-5">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-xl font-semibold">{t('calendar.title')}</h1>
        <form onSubmit={submit} className="flex min-w-64 flex-1 gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label={t('calendar.query')}
            placeholder={t('calendar.queryPlaceholder')}
            className="h-[var(--control-md)] min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 font-mono text-[13px]"
          />
          <Button type="submit">{t('calendar.apply')}</Button>
        </form>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          aria-label={t('calendar.previous')}
          onClick={() => shift(-1)}
        >
          <CaretLeft size={16} aria-hidden />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => go({ date: today })}>
          {t('calendar.today')}
        </Button>
        <Button size="sm" variant="ghost" aria-label={t('calendar.next')} onClick={() => shift(1)}>
          <CaretRight size={16} aria-hidden />
        </Button>
        <h2 className="m-0 min-w-44 text-[15px] font-semibold">{title}</h2>
        <span className="flex-1" />
        <label className="flex items-center gap-1.5 text-[13px]">
          {t('calendar.field')}
          <select
            value={field.id}
            onChange={(event) => go({ field: event.target.value })}
            className="h-[var(--control-sm)] rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-1"
          >
            {fields.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="m-0 inline-flex rounded-[var(--radius-md)] border border-[var(--border-strong)] p-0.5">
          <legend className="sr-only">{t('calendar.view')}</legend>
          {(['month', 'week'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => go({ view: option })}
              className="h-6 rounded-[var(--radius-sm)] px-2.5 text-[12.5px] text-[var(--ink-muted)] aria-pressed:bg-[var(--accent-soft)] aria-pressed:font-semibold aria-pressed:text-[var(--accent)]"
            >
              {t(`calendar.views.${option}`)}
            </button>
          ))}
        </fieldset>
      </div>
      {results.error && <FormError message={results.error.message} />}
      {move.error && <FormError message={move.error.message} />}
      {results.data && results.data.total > results.data.issues.length && (
        <p className="m-0 text-xs text-[var(--ink-muted)]">
          {t('calendar.limited', { count: results.data.issues.length, total: results.data.total })}
        </p>
      )}
      {field.editable && (
        <p className="m-0 text-xs text-[var(--ink-muted)]">{t('calendar.dragHint')}</p>
      )}
      <div className="grid grid-cols-7 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
        {weekdays.map((name) => (
          <div
            key={name}
            className="border-b border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-xs font-semibold text-[var(--ink-muted)]"
          >
            {name}
          </div>
        ))}
        {days.map((day) => {
          const key = dayOf(day);
          const entries = byDay.get(key) ?? [];
          const outside = view === 'month' && day.getMonth() !== anchor.getMonth();
          const open = expanded === key || view === 'week';
          const shown = open ? entries : entries.slice(0, MONTH_CHIPS);
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: a drop target for cards; moving dates also works on the issue itself
            <div
              key={key}
              onDragOver={field.editable ? (event) => event.preventDefault() : undefined}
              onDrop={field.editable ? onDrop(key) : undefined}
              className={`flex min-h-24 flex-col gap-1 border-r border-b border-[var(--border)] p-1 [&:nth-child(7n)]:border-r-0 ${
                view === 'week' ? 'min-h-80' : ''
              } ${outside ? 'bg-[var(--surface-2)]' : ''}`}
            >
              <span
                className={`self-end rounded-full px-1.5 text-xs ${
                  key === today
                    ? 'bg-[var(--accent)] font-semibold text-white'
                    : outside
                      ? 'text-[var(--ink-muted)] italic'
                      : 'text-[var(--ink-muted)]'
                }`}
              >
                {day.getDate()}
              </span>
              {shown.map((issue) => (
                <Link
                  key={issue.id}
                  to="/issues/$key"
                  params={{ key: issue.key }}
                  draggable={field.editable && issue.canEdit}
                  onDragStart={(event) => event.dataTransfer.setData('text/plain', issue.key)}
                  title={`${issue.key} ${issue.summary} · ${issue.status.name}`}
                  className={`block truncate rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[12px] no-underline ${STATUS_TONE[issue.status.category]}`}
                >
                  <span className="font-mono">{issue.key}</span> {issue.summary}
                </Link>
              ))}
              {!open && entries.length > MONTH_CHIPS && (
                <button
                  type="button"
                  onClick={() => setExpanded(key)}
                  className="self-start text-[12px] text-[var(--accent)] hover:underline"
                >
                  {t('calendar.more', { count: entries.length - MONTH_CHIPS })}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
