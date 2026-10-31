import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { markdownToDoc } from '@tasklore/editor';
import type {
  CreatedResolved,
  GadgetConfig,
  RichText,
  StatisticField,
  Statistics,
  StatisticValue,
} from '@tasklore/shared';
import { type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { client, unwrap } from '../../lib/api';
import { createdResolvedQuery, statisticsQuery } from '../../lib/dashboards';
import { formatDate } from '../../lib/format';
import { activityQuery } from '../../lib/personal';
import { pageQuery } from '../../lib/wiki';
import { ActivityFeed } from '../personal/ActivityFeed';
import { ReportView } from '../reports/analysis';
import { BurndownChart } from '../reports/charts';
import { IssueTable, ShowAll } from '../shell/HomePage';
import { RichTextView } from '../tracking/RichTextEditor';

type Of<T extends GadgetConfig['type']> = Extract<GadgetConfig, { type: T }>;

/** Categorical series in their fixed order (E-101); an eighth and more fold into "other". */
const SERIES = Array.from({ length: 8 }, (_, index) => `var(--series-${index + 1})`);
const OTHER = 'var(--border-strong)';

const ASSIGNED = 'assignee = currentUser() AND resolution is EMPTY ORDER BY priority, updated DESC';

export function Muted({ children }: { children: ReactNode }) {
  return <p className="m-0 text-[13px] text-[var(--ink-muted)]">{children}</p>;
}

function Failed({ error }: { error: Error | null }) {
  const { t } = useTranslation();
  if (!error) return null;
  return (
    <p role="alert" className="m-0 text-[13px] text-[var(--danger)]">
      {t('dashboards.gadgetError', { message: error.message })}
    </p>
  );
}

function useIssues(query: string, limit: number) {
  return useQuery({
    queryKey: ['search', query, 0, limit],
    queryFn: () => unwrap(client.POST('/api/v1/search', { body: { query, offset: 0, limit } })),
    retry: false,
  });
}

function IssueList({ query, limit }: { query: string; limit: number }) {
  const { t } = useTranslation();
  const result = useIssues(query, limit);
  if (result.error) return <Failed error={result.error} />;
  if (!result.data) return <Muted>{t('common.loading')}</Muted>;
  if (result.data.issues.length === 0) return <Muted>{t('dashboards.noIssues')}</Muted>;
  return (
    <div className="-mx-5 flex flex-col gap-2">
      <IssueTable issues={result.data.issues} />
      {result.data.total > result.data.issues.length && (
        <div className="px-5">
          <ShowAll query={query} total={result.data.total} />
        </div>
      )}
    </div>
  );
}

function Activity({ config }: { config: Of<'activity'> }) {
  const { t } = useTranslation();
  const activity = useInfiniteQuery(
    activityQuery(config.projectKey ? { project: config.projectKey } : {}, config.limit),
  );
  if (activity.error) return <Failed error={activity.error} />;
  const entries = activity.data?.pages[0]?.entries ?? [];
  if (activity.data && entries.length === 0) return <Muted>{t('activity.empty')}</Muted>;
  return <ActivityFeed entries={entries} compact />;
}

/** The name of a counted value; "none" and status categories are named here. */
export function useValueLabel() {
  const { t } = useTranslation();
  return (field: StatisticField, value: StatisticValue) => {
    if (value.key === null) {
      return field === 'assignee' ? t('dashboards.unassigned') : t('dashboards.none');
    }
    if (field === 'statusCategory') {
      return value.key === 'done'
        ? t('home.done')
        : value.key === 'in_progress'
          ? t('home.inProgress')
          : t('home.todo');
    }
    return value.label;
  };
}

const cell = 'border-b border-[var(--border)] px-2 py-1 text-left';
const number = `${cell} text-right font-[family-name:var(--font-mono)]`;

function AsTable({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <details>
      <summary className="cursor-pointer text-xs text-[var(--ink-muted)]">
        {t('reports.asTable')}
      </summary>
      <div className="mt-2 overflow-x-auto">{children}</div>
    </details>
  );
}

/** A donut of shares: at most seven named slices, the rest as "other". */
export function Pie({ config }: { config: Of<'pie'> }) {
  const { t } = useTranslation();
  const label = useValueLabel();
  const stats = useQuery(statisticsQuery({ query: config.query, x: config.field }));
  if (stats.error) return <Failed error={stats.error} />;
  if (!stats.data) return <Muted>{t('common.loading')}</Muted>;
  const data = stats.data;
  const all = data.x.map((value, index) => ({
    label: label(config.field, value),
    count: data.counts[index]?.[0] ?? 0,
  }));
  const shown = all.length > 8 ? all.slice(0, 7) : all;
  const rest = all.slice(shown.length).reduce((sum, entry) => sum + entry.count, 0);
  const slices = [
    ...shown.map((entry, index) => ({ ...entry, color: SERIES[index] as string })),
    ...(rest > 0 ? [{ label: t('dashboards.other'), count: rest, color: OTHER }] : []),
  ];
  const sum = slices.reduce((total, slice) => total + slice.count, 0);
  if (sum === 0) return <Muted>{t('dashboards.noIssues')}</Muted>;
  const radius = 60;
  const inner = 36;
  let angle = -Math.PI / 2;
  const point = (r: number, a: number) => `${80 + r * Math.cos(a)} ${80 + r * Math.sin(a)}`;
  const percent = (count: number) => `${Math.round((count / sum) * 100)} %`;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-5">
        <svg
          viewBox="0 0 160 160"
          className="size-36 shrink-0"
          role="img"
          aria-label={t('dashboards.pieLabel', { total: data.total })}
        >
          {slices.map((slice) => {
            const sweep = (slice.count / sum) * Math.PI * 2;
            const start = angle;
            angle += sweep;
            const large = sweep > Math.PI ? 1 : 0;
            const path =
              slices.length === 1
                ? `M ${point(radius, 0)} A ${radius} ${radius} 0 1 1 ${point(radius, Math.PI)} A ${radius} ${radius} 0 1 1 ${point(radius, 0)} M ${point(inner, 0)} A ${inner} ${inner} 0 1 0 ${point(inner, Math.PI)} A ${inner} ${inner} 0 1 0 ${point(inner, 0)} Z`
                : `M ${point(radius, start)} A ${radius} ${radius} 0 ${large} 1 ${point(radius, angle)} L ${point(inner, angle)} A ${inner} ${inner} 0 ${large} 0 ${point(inner, start)} Z`;
            return (
              <path
                key={slice.label}
                d={path}
                fill={slice.color}
                stroke="var(--surface-1)"
                strokeWidth="2"
                fillRule="evenodd"
                className="hover:opacity-80"
              >
                <title>{`${slice.label}: ${slice.count} (${percent(slice.count)})`}</title>
              </path>
            );
          })}
          <text
            x="80"
            y="86"
            textAnchor="middle"
            className="fill-[var(--ink)] text-[18px] font-semibold"
          >
            {data.total}
          </text>
        </svg>
        <ul className="m-0 flex min-w-[180px] flex-1 list-none flex-col gap-1 p-0 text-[13px]">
          {slices.map((slice) => (
            <li key={slice.label} className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ background: slice.color }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{slice.label}</span>
              <span className="shrink-0 font-[family-name:var(--font-mono)] whitespace-nowrap text-[var(--ink-muted)]">
                {slice.count} · {percent(slice.count)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <AsTable>
        <table className="w-full border-collapse text-xs">
          <tbody>
            {all.map((entry) => (
              <tr key={entry.label}>
                <th scope="row" className={cell}>
                  {entry.label}
                </th>
                <td className={number}>{entry.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AsTable>
    </div>
  );
}

function TwoDimensional({ config }: { config: Of<'two-dimensional'> }) {
  const { t } = useTranslation();
  const label = useValueLabel();
  const stats = useQuery(statisticsQuery({ query: config.query, x: config.x, y: config.y }));
  if (stats.error) return <Failed error={stats.error} />;
  if (!stats.data) return <Muted>{t('common.loading')}</Muted>;
  const data: Statistics = stats.data;
  if (data.x.length === 0) return <Muted>{t('dashboards.noIssues')}</Muted>;
  const columns = data.y ?? [];
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={`${cell} text-[var(--ink-muted)]`}>
              {t(`dashboards.fields.${config.x}`)} / {t(`dashboards.fields.${config.y}`)}
            </th>
            {columns.map((value) => (
              <th key={value.key ?? '∅'} scope="col" className={`${cell} text-right`}>
                {label(config.y, value)}
              </th>
            ))}
            <th scope="col" className={`${cell} text-right`}>
              {t('dashboards.sum')}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.x.map((value, i) => {
            const row = data.counts[i] ?? [];
            return (
              <tr key={value.key ?? '∅'}>
                <th scope="row" className={`${cell} font-medium`}>
                  {label(config.x, value)}
                </th>
                {columns.map((column, j) => (
                  <td key={column.key ?? '∅'} className={number}>
                    {row[j] ? row[j] : <span className="text-[var(--ink-muted)]">–</span>}
                  </td>
                ))}
                <td className={`${number} font-semibold`}>
                  {row.reduce((sum, count) => sum + count, 0)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Two lines on one count axis: created and resolved per day. */
export function CreatedVsResolved({ config }: { config: Of<'created-vs-resolved'> }) {
  const { t } = useTranslation();
  const series = useQuery(createdResolvedQuery(config.query, config.days));
  const [hover, setHover] = useState<number | null>(null);
  if (series.error) return <Failed error={series.error} />;
  if (!series.data) return <Muted>{t('common.loading')}</Muted>;
  const points: CreatedResolved['points'] = series.data.points;
  const width = 480;
  const height = 180;
  const pad = { top: 10, right: 12, bottom: 24, left: 32 };
  const max = Math.max(1, ...points.flatMap((point) => [point.created, point.resolved]));
  // Round steps (1, 2, 5 × 10ⁿ) for about four grid lines.
  const raw = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const step = [1, 2, 5, 10].map((f) => f * magnitude).find((v) => v >= raw) ?? magnitude;
  const top = Math.ceil(max / step) * step;
  const x = (index: number) =>
    pad.left + (index / Math.max(1, points.length - 1)) * (width - pad.left - pad.right);
  const y = (value: number) => pad.top + (1 - value / top) * (height - pad.top - pad.bottom);
  const line = (key: 'created' | 'resolved') =>
    points.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point[key])}`).join(' ');
  const ticks = Array.from({ length: top / step + 1 }, (_, index) => index * step);
  const labelEvery = Math.ceil(points.length / 6);
  const totals = points.reduce(
    (sum, point) => ({
      created: sum.created + point.created,
      resolved: sum.resolved + point.resolved,
    }),
    { created: 0, resolved: 0 },
  );
  const active = hover === null ? null : points[hover];
  const legend = [
    { key: 'created' as const, color: SERIES[0], label: t('dashboards.created') },
    { key: 'resolved' as const, color: SERIES[1], label: t('dashboards.resolved') },
  ];
  return (
    <div className="flex flex-col gap-2">
      <ul className="m-0 flex list-none flex-wrap gap-4 p-0 text-xs text-[var(--ink-muted)]">
        {legend.map((entry) => (
          <li key={entry.key} className="flex items-center gap-1.5">
            <svg width="16" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="16" y2="4" stroke={entry.color} strokeWidth="2" />
            </svg>
            {entry.label}{' '}
            <span className="font-[family-name:var(--font-mono)] text-[var(--ink)]">
              {totals[entry.key]}
            </span>
          </li>
        ))}
        {active && (
          <li className="ml-auto text-[var(--ink)]">
            {formatDate(active.date)}: {active.created} / {active.resolved}
          </li>
        )}
      </ul>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={t('dashboards.createdResolvedLabel', {
          days: config.days,
          created: totals.created,
          resolved: totals.resolved,
        })}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--border)"
            />
            <text
              x={pad.left - 6}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-[var(--ink-muted)] text-[10px]"
            >
              {tick}
            </text>
          </g>
        ))}
        {points.map(
          (point, index) =>
            index % labelEvery === 0 && (
              <text
                key={point.date}
                x={x(index)}
                y={height - 6}
                textAnchor="middle"
                className="fill-[var(--ink-muted)] text-[10px]"
              >
                {formatDate(point.date).replace(/\.?\s?\d{4}$/, '')}
              </text>
            ),
        )}
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={pad.top}
            y2={height - pad.bottom}
            stroke="var(--border-strong)"
          />
        )}
        {legend.map((entry) => (
          <path
            key={entry.key}
            d={line(entry.key)}
            fill="none"
            stroke={entry.color}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        ))}
        {active &&
          hover !== null &&
          legend.map((entry) => (
            <circle
              key={entry.key}
              cx={x(hover)}
              cy={y(active[entry.key])}
              r="4"
              fill={entry.color}
              stroke="var(--surface-1)"
              strokeWidth="2"
            />
          ))}
        {points.map((point, index) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: a hover target for the pointer; the same values are in the table view
          <rect
            key={point.date}
            x={x(index) - (width - pad.left - pad.right) / points.length / 2}
            y={pad.top}
            width={(width - pad.left - pad.right) / Math.max(1, points.length - 1)}
            height={height - pad.top - pad.bottom}
            fill="transparent"
            onMouseEnter={() => setHover(index)}
          />
        ))}
      </svg>
      <AsTable>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={cell}>{t('dashboards.day')}</th>
              <th className={`${cell} text-right`}>{t('dashboards.created')}</th>
              <th className={`${cell} text-right`}>{t('dashboards.resolved')}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.date}>
                <td className={cell}>{formatDate(point.date)}</td>
                <td className={number}>{point.created}</td>
                <td className={number}>{point.resolved}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AsTable>
    </div>
  );
}

function SprintBurndown({ config }: { config: Of<'sprint-burndown'> }) {
  const { t } = useTranslation();
  const sprints = useQuery({
    queryKey: ['board', config.boardId, 'sprints', 'active'],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/boards/{id}/sprints', {
          params: { path: { id: config.boardId }, query: { state: 'active' } },
        }),
      ),
  });
  const sprint = sprints.data?.[0];
  const burndown = useQuery({
    queryKey: ['sprint', sprint?.id, 'burndown'],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/sprints/{id}/burndown', {
          params: { path: { id: sprint?.id ?? '' } },
        }),
      ),
    enabled: !!sprint,
  });
  if (sprints.error ?? burndown.error) return <Failed error={sprints.error ?? burndown.error} />;
  if (sprints.data && !sprint) return <Muted>{t('dashboards.noActiveSprint')}</Muted>;
  if (!burndown.data) return <Muted>{t('common.loading')}</Muted>;
  return <BurndownChart data={burndown.data} />;
}

/** Due dates of a query in a month grid, Monday first. */
function Calendar({ config }: { config: Of<'calendar'> }) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const result = useIssues(config.query, 100);
  const days = useMemo(() => {
    const first = (month.getDay() + 6) % 7;
    const length = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [
      ...Array.from({ length: first }, () => null),
      ...Array.from({ length }, (_, index) => index + 1),
    ];
  }, [month]);
  const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-`;
  const byDay = new Map<number, NonNullable<typeof result.data>['issues']>();
  for (const issue of result.data?.issues ?? []) {
    if (!issue.dueDate?.startsWith(prefix)) continue;
    const day = Number(issue.dueDate.slice(8, 10));
    byDay.set(day, [...(byDay.get(day) ?? []), issue]);
  }
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(i18n.language, { weekday: 'short' }).format(
      new Date(2024, 0, 1 + index),
    ),
  );
  const today = new Date();
  const shift = (by: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));
  return (
    <div className="flex flex-col gap-2">
      <Failed error={result.error} />
      <div className="flex items-center justify-between text-[13px]">
        <button
          type="button"
          className="rounded px-2 py-0.5 hover:bg-[var(--selected)]"
          aria-label={t('dashboards.previousMonth')}
          onClick={() => shift(-1)}
        >
          ‹
        </button>
        <span className="font-semibold">
          {new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(month)}
        </span>
        <button
          type="button"
          className="rounded px-2 py-0.5 hover:bg-[var(--selected)]"
          aria-label={t('dashboards.nextMonth')}
          onClick={() => shift(1)}
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--border)] text-[11.5px]">
        {weekdays.map((weekday) => (
          <span
            key={weekday}
            className="bg-[var(--surface-2)] px-1 py-0.5 text-center text-[var(--ink-muted)]"
          >
            {weekday}
          </span>
        ))}
        {days.map((day, index) => {
          const isToday =
            day === today.getDate() &&
            month.getMonth() === today.getMonth() &&
            month.getFullYear() === today.getFullYear();
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: grid cells are positional
              key={index}
              className="flex min-h-[54px] min-w-0 flex-col gap-0.5 bg-[var(--surface-1)] p-1"
            >
              {day && (
                <span
                  className={
                    isToday ? 'font-semibold text-[var(--accent)]' : 'text-[var(--ink-muted)]'
                  }
                >
                  {day}
                </span>
              )}
              {day &&
                (byDay.get(day) ?? []).map((issue) => (
                  <Link
                    key={issue.id}
                    to="/issues/$key"
                    params={{ key: issue.key }}
                    title={`${issue.key} ${issue.summary}`}
                    className="truncate rounded-[3px] bg-[var(--accent-soft)] px-1 text-[var(--ink)] no-underline hover:underline"
                  >
                    {issue.key}
                  </Link>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WikiPage({ config }: { config: Of<'wiki-page'> }) {
  const { t } = useTranslation();
  const page = useQuery({ ...pageQuery(config.pageId), retry: false });
  if (page.error) return <Failed error={page.error} />;
  if (!page.data) return <Muted>{t('common.loading')}</Muted>;
  const content = page.data.content;
  return (
    <div className="flex flex-col gap-2">
      {content && typeof content === 'object' ? (
        <div className="max-h-[420px] overflow-y-auto">
          <RichTextView
            doc={content}
            page={{ spaceKey: page.data.space.key, pageId: page.data.id }}
            liveKeys
          />
        </div>
      ) : (
        <Muted>{t('dashboards.pageEmpty')}</Muted>
      )}
      <Link
        to="/spaces/$key/pages/$id"
        params={{ key: page.data.space.key, id: page.data.id }}
        className="text-[13px] font-medium text-[var(--accent)] no-underline hover:underline"
      >
        {t('dashboards.openPage', { title: page.data.title })}
      </Link>
    </div>
  );
}

function Text({ config }: { config: Of<'text'> }) {
  const doc = useMemo(() => markdownToDoc(config.markdown) as RichText, [config.markdown]);
  return <RichTextView doc={doc} liveKeys />;
}

export function GadgetBody({ config }: { config: GadgetConfig }) {
  switch (config.type) {
    case 'filter-results':
      return <IssueList query={config.query} limit={config.limit} />;
    case 'assigned-to-me':
      return <IssueList query={ASSIGNED} limit={config.limit} />;
    case 'activity':
      return <Activity config={config} />;
    case 'pie':
      return <Pie config={config} />;
    case 'two-dimensional':
      return <TwoDimensional config={config} />;
    case 'created-vs-resolved':
      return <CreatedVsResolved config={config} />;
    case 'sprint-burndown':
      return <SprintBurndown config={config} />;
    case 'calendar':
      return <Calendar config={config} />;
    case 'wiki-page':
      return <WikiPage config={config} />;
    case 'text':
      return <Text config={config} />;
    case 'report':
      return <ReportView config={config.report} />;
  }
}
