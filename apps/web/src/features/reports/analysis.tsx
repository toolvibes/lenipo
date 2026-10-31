import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { Burndown, ControlChart, ReportConfig, SeriesField } from '@tasklore/shared';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import { CreatedVsResolved, Pie, useValueLabel } from '../dashboards/gadgets';
import { useDuration } from '../tracking/TimeTracking';
import { useValueFormat } from './charts';

/** Categorical series in their fixed order (E-101); more fold into "other". */
const SERIES = Array.from({ length: 8 }, (_, index) => `var(--series-${index + 1})`);
const OTHER = 'var(--border-strong)';

const cell = 'border-b border-[var(--border)] px-2 py-1 text-left';
const number = `${cell} text-right font-[family-name:var(--font-mono)]`;

function Muted({ children }: { children: ReactNode }) {
  return <p className="m-0 text-[13px] text-[var(--ink-muted)]">{children}</p>;
}

function Failed({ error }: { error: Error }) {
  return (
    <p role="alert" className="m-0 text-[13px] text-[var(--danger)]">
      {error.message}
    </p>
  );
}

function AsTable({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <details>
      <summary className="cursor-pointer text-xs text-[var(--ink-muted)]">
        {t('reports.asTable')}
      </summary>
      <div className="mt-2 max-h-80 overflow-auto">{children}</div>
    </details>
  );
}

/** Round steps (1, 2, 5 × 10ⁿ) from 0 to at least max, about four grid lines. */
function axis(max: number): number[] {
  const raw = Math.max(max, 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(raw, 0.1)));
  const step = [1, 2, 5, 10].map((f) => f * magnitude).find((v) => v >= raw) ?? magnitude;
  const top = Math.ceil(Math.max(max, 1) / step) * step;
  return Array.from(
    { length: Math.round(top / step) + 1 },
    (_, index) => Math.round(index * step * 100) / 100,
  );
}

export interface Series {
  label: string;
  values: number[];
  dashed?: boolean;
}

/**
 * Series over one shared axis: lines, stacked areas (cumulative flow) or stacked bars (per
 * sprint). Colors follow the series order; a crosshair shows every value of a point.
 */
export function SeriesChart({
  labels,
  series,
  mode = 'lines',
  format = (value: number) => String(Math.round(value * 10) / 10),
  ariaLabel,
}: {
  labels: string[];
  series: Series[];
  mode?: 'lines' | 'stacked' | 'bars';
  format?: (value: number) => string;
  ariaLabel: string;
}) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<number | null>(null);
  // At most eight colors; further series fold into "other" when stacked.
  const shown =
    series.length > 8 && mode !== 'lines'
      ? [
          ...series.slice(0, 7),
          {
            label: t('dashboards.other'),
            values: labels.map((_, index) =>
              series.slice(7).reduce((sum, entry) => sum + (entry.values[index] ?? 0), 0),
            ),
          },
        ]
      : series.slice(0, 8);
  const colors = shown.map((entry, index) =>
    entry.label === t('dashboards.other') && index === 7 ? OTHER : (SERIES[index] as string),
  );
  const width = 640;
  const height = 220;
  const pad = { top: 10, right: 12, bottom: 24, left: 44 };
  const stacked = mode !== 'lines';
  const tops = labels.map((_, index) =>
    stacked
      ? shown.reduce((sum, entry) => sum + (entry.values[index] ?? 0), 0)
      : Math.max(0, ...shown.map((entry) => entry.values[index] ?? 0)),
  );
  const ticks = axis(Math.max(0, ...tops));
  const top = ticks.at(-1) ?? 1;
  const inner = width - pad.left - pad.right;
  const slot = inner / Math.max(1, labels.length);
  const x = (index: number) =>
    mode === 'bars'
      ? pad.left + slot * index + slot / 2
      : pad.left + (index / Math.max(1, labels.length - 1)) * inner;
  const y = (value: number) => pad.top + (1 - value / top) * (height - pad.top - pad.bottom);
  const base = labels.map(() => 0);
  const layers = shown.map((entry) => {
    const lower = [...base];
    const upper = labels.map((_, index) =>
      stacked ? (base[index] ?? 0) + (entry.values[index] ?? 0) : (entry.values[index] ?? 0),
    );
    if (stacked) for (const [index, value] of upper.entries()) base[index] = value;
    return { lower, upper };
  });
  const labelEvery = Math.ceil(labels.length / 7);
  const hit = mode === 'bars' ? slot : inner / Math.max(1, labels.length - 1);
  return (
    <div className="flex flex-col gap-2">
      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-[var(--ink-muted)]">
        {shown.map((entry, index) => (
          <li key={entry.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-3 rounded-[2px]"
              style={{ background: colors[index] }}
              aria-hidden
            />
            {entry.label}
            {hover !== null && (
              <span className="font-[family-name:var(--font-mono)] text-[var(--ink)]">
                {format(entry.values[hover] ?? 0)}
              </span>
            )}
          </li>
        ))}
        {hover !== null && <li className="ml-auto text-[var(--ink)]">{labels[hover]}</li>}
      </ul>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={ariaLabel}
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
              {format(tick)}
            </text>
          </g>
        ))}
        {labels.map(
          (label, index) =>
            index % labelEvery === 0 && (
              <text
                // biome-ignore lint/suspicious/noArrayIndexKey: labels may repeat; points are positional
                key={`${label}-${index}`}
                x={x(index)}
                y={height - 6}
                textAnchor="middle"
                className="fill-[var(--ink-muted)] text-[10px]"
              >
                {label}
              </text>
            ),
        )}
        {mode === 'bars' &&
          layers.map((layer, layerIndex) =>
            labels.map((label, index) => {
              const upper = layer.upper[index] ?? 0;
              const lower = layer.lower[index] ?? 0;
              if (upper === lower) return null;
              return (
                <rect
                  key={`${shown[layerIndex]?.label}-${label}`}
                  x={x(index) - Math.min(28, slot * 0.6) / 2}
                  width={Math.min(28, slot * 0.6)}
                  y={y(upper)}
                  height={Math.max(0, y(lower) - y(upper) - 2)}
                  rx={2}
                  fill={colors[layerIndex]}
                />
              );
            }),
          )}
        {mode === 'stacked' &&
          layers.map((layer, layerIndex) => {
            const upper = layer.upper.map((value, index) => `${x(index)},${y(value)}`);
            const lower = layer.lower.map((value, index) => `${x(index)},${y(value)}`).reverse();
            return (
              <polygon
                key={shown[layerIndex]?.label}
                points={[...upper, ...lower].join(' ')}
                fill={colors[layerIndex]}
                fillOpacity={0.85}
                stroke="var(--surface-1)"
                strokeWidth={1}
              />
            );
          })}
        {mode === 'lines' &&
          layers.map((layer, layerIndex) => (
            <path
              key={shown[layerIndex]?.label}
              d={layer.upper
                .map((value, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(value)}`)
                .join(' ')}
              fill="none"
              stroke={colors[layerIndex]}
              strokeWidth={2}
              strokeDasharray={shown[layerIndex]?.dashed ? '5 3' : undefined}
              strokeLinejoin="round"
            />
          ))}
        {hover !== null && mode !== 'bars' && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={pad.top}
            y2={height - pad.bottom}
            stroke="var(--border-strong)"
          />
        )}
        {labels.map((label, index) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: a hover target for the pointer; the same values are in the table view
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: labels may repeat; points are positional
            key={`hit-${label}-${index}`}
            x={x(index) - hit / 2}
            y={pad.top}
            width={hit}
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
              <th className={cell} />
              {series.map((entry) => (
                <th key={entry.label} className={`${cell} text-right`}>
                  {entry.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((label, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: labels may repeat; rows are positional
              <tr key={`${label}-${index}`}>
                <th scope="row" className={cell}>
                  {label}
                </th>
                {series.map((entry) => (
                  <td key={entry.label} className={number}>
                    {format(entry.values[index] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </AsTable>
    </div>
  );
}

const shortDate = (date: string) => formatDate(date).replace(/\.?\s?\d{4}$/, '');

function FieldSeriesView({
  query,
  field,
  days,
  stacked,
}: {
  query: string;
  field: SeriesField;
  days: number;
  stacked: boolean;
}) {
  const { t } = useTranslation();
  const label = useValueLabel();
  const result = useQuery({
    queryKey: ['report', 'field-series', query, field, days],
    queryFn: () =>
      unwrap(client.POST('/api/v1/reports/field-series', { body: { query, field, days } })),
    retry: false,
  });
  if (result.error) return <Failed error={result.error} />;
  if (!result.data) return <Muted>{t('common.loading')}</Muted>;
  const data = result.data;
  if (data.values.length === 0) return <Muted>{t('dashboards.noIssues')}</Muted>;
  return (
    <>
      <SeriesChart
        mode={stacked ? 'stacked' : 'lines'}
        labels={data.dates.map(shortDate)}
        series={(() => {
          const all = data.values.map((value, index) => ({
            label: label(field, value),
            values: data.counts[index] ?? [],
          }));
          // Cumulative flow stacks done work at the bottom.
          return stacked ? all.reverse() : all;
        })()}
        ariaLabel={t('analysis.seriesLabel', {
          field: t(`dashboards.fields.${field}`),
          days,
        })}
      />
      {data.truncated && <Muted>{t('analysis.truncated')}</Muted>}
    </>
  );
}

/** Rolling average over the last five resolved issues. */
function rolling(values: number[], window = 5): number[] {
  return values.map((_, index) => {
    const part = values.slice(Math.max(0, index - window + 1), index + 1);
    return part.reduce((sum, value) => sum + value, 0) / part.length;
  });
}

function ControlChartView({ query, days }: { query: string; days: number }) {
  const { t } = useTranslation();
  const [measure, setMeasure] = useState<'cycle' | 'lead'>('cycle');
  const [hover, setHover] = useState<number | null>(null);
  const result = useQuery({
    queryKey: ['report', 'control-chart', query, days],
    queryFn: () => unwrap(client.POST('/api/v1/reports/control-chart', { body: { query, days } })),
    retry: false,
  });
  if (result.error) return <Failed error={result.error} />;
  if (!result.data) return <Muted>{t('common.loading')}</Muted>;
  const data: ControlChart = result.data;
  const points = data.points.flatMap((point) => {
    const value = measure === 'cycle' ? point.cycleDays : point.leadDays;
    return value === null ? [] : [{ ...point, value }];
  });
  const stats = measure === 'cycle' ? data.cycle : data.lead;
  const width = 640;
  const height = 220;
  const pad = { top: 10, right: 12, bottom: 24, left: 44 };
  const end = Date.now();
  const start = end - days * 86_400_000;
  const ticks = axis(Math.max(stats.p85 ?? 0, ...points.map((point) => point.value)));
  const top = ticks.at(-1) ?? 1;
  const x = (at: string) =>
    pad.left + ((Date.parse(at) - start) / (end - start)) * (width - pad.left - pad.right);
  const y = (value: number) => pad.top + (1 - value / top) * (height - pad.top - pad.bottom);
  const average = rolling(points.map((point) => point.value));
  const active = hover === null ? null : points[hover];
  const fmt = (value: number | null) =>
    value === null ? '–' : t('analysis.days', { count: Math.round(value * 10) / 10 });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--ink-muted)]">
        <div role="toolbar" aria-label={t('analysis.measure')} className="flex gap-1">
          {(['cycle', 'lead'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={measure === value}
              onClick={() => setMeasure(value)}
              className="h-7 rounded-[var(--radius-md)] border border-[var(--border-strong)] px-2 aria-pressed:border-[var(--accent)] aria-pressed:bg-[var(--accent-soft)] aria-pressed:text-[var(--accent)]"
            >
              {t(`analysis.${value}`)}
            </button>
          ))}
        </div>
        <span>
          {t('analysis.average')}{' '}
          <strong className="text-[var(--ink)]">{fmt(stats.average)}</strong>
        </span>
        <span>
          {t('analysis.median')} <strong className="text-[var(--ink)]">{fmt(stats.median)}</strong>
        </span>
        <span>
          {t('analysis.p85')} <strong className="text-[var(--ink)]">{fmt(stats.p85)}</strong>
        </span>
        {active && (
          <Link
            to="/issues/$key"
            params={{ key: active.key }}
            className="ml-auto text-[var(--ink)] no-underline hover:underline"
          >
            {active.key} · {fmt(active.value)}
          </Link>
        )}
      </div>
      {points.length === 0 ? (
        <Muted>{t('analysis.noneResolved')}</Muted>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-label={t('analysis.controlLabel', { count: points.length, days })}
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
          {stats.p85 !== null && (
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(stats.p85)}
              y2={y(stats.p85)}
              stroke={SERIES[1]}
              strokeWidth={1.5}
              strokeDasharray="5 3"
            />
          )}
          <path
            d={points
              .map(
                (point, index) =>
                  `${index ? 'L' : 'M'} ${x(point.resolvedAt)} ${y(average[index] ?? 0)}`,
              )
              .join(' ')}
            fill="none"
            stroke={SERIES[0]}
            strokeWidth={2}
          />
          {points.map((point, index) => (
            // biome-ignore lint/a11y/noStaticElementInteractions: a hover target for the pointer; the same values are in the table view
            <circle
              key={point.key}
              cx={x(point.resolvedAt)}
              cy={y(point.value)}
              r={hover === index ? 6 : 4}
              fill={SERIES[0]}
              fillOpacity={0.55}
              stroke="var(--surface-1)"
              strokeWidth={1.5}
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
            >
              <title>{`${point.key} ${point.summary}: ${fmt(point.value)}`}</title>
            </circle>
          ))}
        </svg>
      )}
      <ul className="m-0 flex list-none flex-wrap gap-4 p-0 text-xs text-[var(--ink-muted)]">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: SERIES[0] }} aria-hidden />
          {t('analysis.issue')}
        </li>
        <li className="flex items-center gap-1.5">
          <svg width="16" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="16" y2="4" stroke={SERIES[0]} strokeWidth="2" />
          </svg>
          {t('analysis.rolling')}
        </li>
        <li className="flex items-center gap-1.5">
          <svg width="16" height="8" aria-hidden="true">
            <line
              x1="0"
              y1="4"
              x2="16"
              y2="4"
              stroke={SERIES[1]}
              strokeWidth="2"
              strokeDasharray="5 3"
            />
          </svg>
          {t('analysis.p85')}
        </li>
      </ul>
      <AsTable>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={cell}>{t('analysis.issue')}</th>
              <th className={cell}>{t('analysis.resolved')}</th>
              <th className={`${cell} text-right`}>{t('analysis.lead')}</th>
              <th className={`${cell} text-right`}>{t('analysis.cycle')}</th>
            </tr>
          </thead>
          <tbody>
            {data.points.map((point) => (
              <tr key={point.key}>
                <td className={cell}>
                  {point.key} {point.summary}
                </td>
                <td className={cell}>{formatDateTime(point.resolvedAt)}</td>
                <td className={number}>{fmt(point.leadDays)}</td>
                <td className={number}>{fmt(point.cycleDays)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AsTable>
    </div>
  );
}

function AverageAgeView({ query, days }: { query: string; days: number }) {
  const { t } = useTranslation();
  const result = useQuery({
    queryKey: ['report', 'average-age', query, days],
    queryFn: () => unwrap(client.POST('/api/v1/reports/average-age', { body: { query, days } })),
    retry: false,
  });
  if (result.error) return <Failed error={result.error} />;
  if (!result.data) return <Muted>{t('common.loading')}</Muted>;
  const points = result.data.points;
  return (
    <SeriesChart
      labels={points.map((point) => shortDate(point.date))}
      series={[
        { label: t('analysis.averageAge'), values: points.map((point) => point.averageDays) },
      ]}
      ariaLabel={t('analysis.ageLabel', {
        days,
        age: points.at(-1)?.averageDays ?? 0,
        open: points.at(-1)?.open ?? 0,
      })}
    />
  );
}

function ScopeProgressView({ query, boardId }: { query: string; boardId: string }) {
  const { t } = useTranslation();
  const result = useQuery({
    queryKey: ['report', 'scope-progress', query, boardId],
    queryFn: () =>
      unwrap(client.POST('/api/v1/reports/scope-progress', { body: { query, boardId } })),
    retry: false,
  });
  const format = useValueFormat(result.data?.estimation ?? 'issueCount');
  if (result.error) return <Failed error={result.error} />;
  if (!result.data) return <Muted>{t('common.loading')}</Muted>;
  const data = result.data;
  return (
    <div className="flex flex-col gap-3">
      <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [t('analysis.scope'), format(data.scope)],
          [t('analysis.done'), format(data.done)],
          [t('analysis.remaining'), format(data.remaining)],
          [
            t('analysis.forecast'),
            data.forecastSprints === null
              ? '–'
              : t('analysis.sprints', { count: data.forecastSprints }),
          ],
        ].map(([term, value]) => (
          <div key={term} className="flex flex-col">
            <dt className="text-xs text-[var(--ink-muted)]">{term}</dt>
            <dd className="m-0 text-[18px] font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {data.sprints.length === 0 ? (
        <Muted>{t('analysis.noClosedSprint')}</Muted>
      ) : (
        <SeriesChart
          mode="bars"
          format={format}
          labels={data.sprints.map((sprint) => sprint.name)}
          series={[
            { label: t('analysis.done'), values: data.sprints.map((sprint) => sprint.done) },
            {
              label: t('analysis.remaining'),
              values: data.sprints.map((sprint) => sprint.remaining),
            },
          ]}
          ariaLabel={t('analysis.scopeLabel', {
            scope: format(data.scope),
            done: format(data.done),
          })}
        />
      )}
      <Muted>
        {t('analysis.velocity', { value: format(data.velocity) })} · {t('analysis.scopeHint')}
      </Muted>
    </div>
  );
}

/** Scope and done work during a sprint, rebuilt from its burndown events (T-RPT-04). */
function burnup(data: Burndown) {
  let scope = data.committed;
  let done = 0;
  return data.points.map((point) => {
    if (point.type === 'done') done -= point.delta;
    else if (point.type === 'reopened') done -= point.delta;
    else if (point.type !== 'start' && point.type !== 'now') scope += point.delta;
    return { at: point.at, scope, done };
  });
}

function BurnupView({ boardId }: { boardId: string }) {
  const { t } = useTranslation();
  const sprints = useQuery({
    queryKey: ['board', boardId, 'sprints', 'all'],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/boards/{id}/sprints', { params: { path: { id: boardId }, query: {} } }),
      ),
  });
  const sprint = (sprints.data ?? [])
    .filter((entry) => entry.startedAt)
    .sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))[0];
  const burndown = useQuery({
    queryKey: ['report', 'burndown', sprint?.id],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/sprints/{id}/burndown', {
          params: { path: { id: sprint?.id ?? '' } },
        }),
      ),
    enabled: !!sprint,
  });
  const format = useValueFormat(burndown.data?.estimation ?? 'issueCount');
  if (sprints.error ?? burndown.error)
    return <Failed error={(sprints.error ?? burndown.error) as Error} />;
  if (sprints.data && !sprint) return <Muted>{t('reports.noStartedSprint')}</Muted>;
  if (!burndown.data) return <Muted>{t('common.loading')}</Muted>;
  const points = burnup(burndown.data);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-[var(--ink-muted)]">{burndown.data.sprint.name}</span>
      <SeriesChart
        format={format}
        labels={points.map((point) => formatDateTime(point.at))}
        series={[
          { label: t('analysis.done'), values: points.map((point) => point.done) },
          { label: t('analysis.scope'), values: points.map((point) => point.scope), dashed: true },
        ]}
        ariaLabel={t('analysis.burnupLabel', { sprint: burndown.data.sprint.name })}
      />
    </div>
  );
}

function TimeReportView({ query, days }: { query: string; days: number }) {
  const { t } = useTranslation();
  const duration = useDuration();
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86_400_000);
  const iso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const body = { query, from: iso(from), to: iso(to) };
  const result = useQuery({
    queryKey: ['report', 'time-tracking', body],
    queryFn: () => unwrap(client.POST('/api/v1/reports/time-tracking', { body })),
    retry: false,
  });
  if (result.error) return <Failed error={result.error} />;
  if (!result.data) return <Muted>{t('common.loading')}</Muted>;
  const data = result.data;
  const show = (seconds: number | null) => (seconds ? (duration(seconds) ?? '–') : '–');
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className={cell}>{t('analysis.issue')}</th>
              <th className={`${cell} text-right`}>{t('analysis.estimate')}</th>
              <th className={`${cell} text-right`}>{t('analysis.spent')}</th>
              <th className={`${cell} text-right`}>{t('analysis.remainingTime')}</th>
              <th className={`${cell} text-right`}>{t('analysis.logged', { count: days })}</th>
            </tr>
          </thead>
          <tbody>
            {data.issues.map((issue) => (
              <tr key={issue.key}>
                <td className={cell}>
                  <Link
                    to="/issues/$key"
                    params={{ key: issue.key }}
                    className="text-[var(--ink)] no-underline hover:underline"
                  >
                    <span className="tl-key">{issue.key}</span> {issue.summary}
                  </Link>
                </td>
                <td className={number}>{show(issue.originalEstimateSeconds)}</td>
                <td className={number}>{show(issue.timeSpentSeconds)}</td>
                <td className={number}>{show(issue.remainingEstimateSeconds)}</td>
                <td className={number}>{show(issue.loggedSeconds)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <th scope="row" className={cell}>
                {t('dashboards.sum')}
              </th>
              <td className={number}>{show(data.totals.originalEstimateSeconds)}</td>
              <td className={number}>{show(data.totals.timeSpentSeconds)}</td>
              <td className={number}>{show(data.totals.remainingEstimateSeconds)}</td>
              <td className={number}>{show(data.totals.loggedSeconds)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {data.issues.length === 0 && <Muted>{t('analysis.noTime')}</Muted>}
      {data.people.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="tl-heading-md m-0">{t('analysis.perPerson', { count: days })}</h3>
          <ul className="m-0 flex max-w-[420px] list-none flex-col p-0 text-[13px]">
            {data.people.map((person) => (
              <li
                key={person.user?.id ?? 'unknown'}
                className="flex justify-between border-b border-[var(--border)] py-1"
              >
                <span>{person.user?.displayName ?? t('analysis.formerUser')}</span>
                <span className="font-[family-name:var(--font-mono)]">
                  {show(person.loggedSeconds)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.truncated && <Muted>{t('analysis.truncated')}</Muted>}
    </div>
  );
}

/** Any report with its settings: on the reports page, in a gadget or in a wiki page. */
export function ReportView({ config }: { config: ReportConfig }) {
  switch (config.kind) {
    case 'cfd':
      return <FieldSeriesView query={config.query} field="status" days={config.days} stacked />;
    case 'field-series':
      return (
        <FieldSeriesView
          query={config.query}
          field={config.field}
          days={config.days}
          stacked={false}
        />
      );
    case 'control-chart':
      return <ControlChartView query={config.query} days={config.days} />;
    case 'average-age':
      return <AverageAgeView query={config.query} days={config.days} />;
    case 'created-vs-resolved':
      return (
        <CreatedVsResolved
          config={{ type: 'created-vs-resolved', query: config.query, days: config.days }}
        />
      );
    case 'pie':
      return <Pie config={{ type: 'pie', query: config.query, field: config.field }} />;
    case 'scope-progress':
      return <ScopeProgressView query={config.query} boardId={config.boardId} />;
    case 'burnup':
      return <BurnupView boardId={config.boardId} />;
    case 'time-tracking':
      return <TimeReportView query={config.query} days={config.days} />;
  }
}
