import type { Burndown, EstimationField, Velocity } from '@tasklore/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../../lib/format';
import { useDuration } from '../tracking/TimeTracking';

/** Small chart helpers for the Sprint reports (E-56): linear scales, round ticks. */

const WIDTH = 720;
const HEIGHT = 300;
const PAD = { top: 16, right: 28, bottom: 36, left: 48 };

function scale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (value: number) => r0 + ((value - d0) / span) * (r1 - r0);
}

/** About `count` round tick values from 0 to at least `max`. */
function ticks(max: number, count = 5): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 5, 10].map((factor) => factor * magnitude).find((value) => value >= raw) ?? raw;
  const result: number[] = [];
  for (let value = 0; value <= max + step / 2; value += step)
    result.push(Math.round(value * 100) / 100);
  return result;
}

/** Numbers in the board's unit: points, time or count (T-SPR-08). */
export function useValueFormat(estimation: EstimationField) {
  const duration = useDuration();
  return (value: number) =>
    estimation === 'originalEstimate'
      ? (duration(Math.round(value)) ?? '0m')
      : String(Math.round(value * 10) / 10);
}

/** A chart with its title, description and the same data as a table for everyone (WCAG). */
function Figure({
  title,
  description,
  chart,
  table,
}: {
  title: string;
  description: string;
  chart: ReactNode;
  table: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <figure className="m-0 flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-4">
      <figcaption className="flex flex-col gap-0.5">
        <span className="tl-heading-md">{title}</span>
        <span className="text-xs text-[var(--ink-muted)]">{description}</span>
      </figcaption>
      {chart}
      <details>
        <summary className="cursor-pointer text-xs text-[var(--ink-muted)]">
          {t('reports.asTable')}
        </summary>
        <div className="mt-2 overflow-x-auto">{table}</div>
      </details>
    </figure>
  );
}

const cell = 'border-b border-[var(--border)] px-2 py-1 text-left';

export function BurndownChart({ data }: { data: Burndown }) {
  const { t } = useTranslation();
  const format = useValueFormat(data.estimation);
  const times = data.points.map((point) => Date.parse(point.at));
  const start = times[0] ?? Date.now();
  const end = Math.max(...times, data.plannedEnd ? Date.parse(data.plannedEnd) : 0);
  const max = Math.max(data.committed, ...data.points.map((point) => point.remaining), 1);
  const yTicks = ticks(max);
  const x = scale([start, end], [PAD.left, WIDTH - PAD.right]);
  const y = scale([0, yTicks.at(-1) ?? max], [HEIGHT - PAD.bottom, PAD.top]);
  const days = Math.max(1, Math.round((end - start) / 86_400_000));
  const dayStep = Math.ceil(days / 10);
  const dayTicks = Array.from(
    { length: Math.floor(days / dayStep) + 1 },
    (_, index) => start + index * dayStep * 86_400_000,
  );

  // A step line: each value holds until the next event.
  let path = '';
  data.points.forEach((point, index) => {
    const px = x(Date.parse(point.at));
    const py = y(point.remaining);
    if (index === 0) path += `M${px},${py}`;
    else path += `H${px}V${py}`;
  });
  const label = (type: string) => t(`reports.events.${type}` as never);

  return (
    <Figure
      title={t('reports.burndown')}
      description={t('reports.burndownHelp', { committed: format(data.committed) })}
      chart={
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full"
          role="img"
          aria-label={t('reports.burndownLabel', {
            committed: format(data.committed),
            remaining: format(data.points.at(-1)?.remaining ?? 0),
          })}
        >
          {yTicks.map((value) => (
            <g key={value}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(value)}
                y2={y(value)}
                stroke="var(--border)"
              />
              <text
                x={PAD.left - 6}
                y={y(value)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="11"
                fill="var(--ink-muted)"
              >
                {format(value)}
              </text>
            </g>
          ))}
          {dayTicks.map((time) => (
            <text
              key={time}
              x={x(time)}
              y={HEIGHT - PAD.bottom + 16}
              textAnchor="middle"
              fontSize="11"
              fill="var(--ink-muted)"
            >
              {new Date(time).toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' })}
            </text>
          ))}
          {data.plannedEnd && (
            <line
              x1={x(start)}
              y1={y(data.committed)}
              x2={x(Date.parse(data.plannedEnd))}
              y2={y(0)}
              stroke="var(--ink-muted)"
              strokeDasharray="6 4"
            >
              <title>{t('reports.guideline')}</title>
            </line>
          )}
          <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
          {data.points.map((point) => (
            <circle
              key={`${point.at}:${point.type}:${point.issueKey}`}
              cx={x(Date.parse(point.at))}
              cy={y(point.remaining)}
              r="3.5"
              fill="var(--surface-1)"
              stroke="var(--accent)"
              strokeWidth="2"
            >
              <title>
                {`${formatDateTime(point.at)}: ${label(point.type)}${point.issueKey ? ` ${point.issueKey}` : ''} → ${format(point.remaining)}`}
              </title>
            </circle>
          ))}
        </svg>
      }
      table={
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="tl-label text-[var(--ink-muted)]">
              <th className={cell}>{t('reports.when')}</th>
              <th className={cell}>{t('reports.event')}</th>
              <th className={cell}>{t('reports.issue')}</th>
              <th className={`${cell} text-right`}>{t('reports.change')}</th>
              <th className={`${cell} text-right`}>{t('reports.remaining')}</th>
            </tr>
          </thead>
          <tbody>
            {data.points.map((point) => (
              <tr key={`${point.at}:${point.type}:${point.issueKey}`}>
                <td className={cell}>{formatDateTime(point.at)}</td>
                <td className={cell}>{label(point.type)}</td>
                <td className={cell}>{point.issueKey ?? '–'}</td>
                <td className={`${cell} text-right tabular-nums`}>
                  {point.delta === 0
                    ? '–'
                    : `${point.delta > 0 ? '+' : '−'}${format(Math.abs(point.delta))}`}
                </td>
                <td className={`${cell} text-right tabular-nums`}>{format(point.remaining)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  );
}

export function VelocityChart({ data }: { data: Velocity }) {
  const { t } = useTranslation();
  const format = useValueFormat(data.estimation);
  const max = Math.max(1, ...data.sprints.flatMap((entry) => [entry.committed, entry.completed]));
  const yTicks = ticks(max);
  const y = scale([0, yTicks.at(-1) ?? max], [HEIGHT - PAD.bottom, PAD.top]);
  const band = (WIDTH - PAD.left - PAD.right) / Math.max(1, data.sprints.length);
  const bar = Math.min(36, band / 3);
  const average =
    data.sprints.length > 0
      ? data.sprints.reduce((sum, entry) => sum + entry.completed, 0) / data.sprints.length
      : 0;

  return (
    <Figure
      title={t('reports.velocity')}
      description={t('reports.velocityHelp', { average: format(average) })}
      chart={
        data.sprints.length === 0 ? (
          <p className="m-0 text-[var(--ink-muted)]">{t('reports.noClosedSprints')}</p>
        ) : (
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-auto w-full"
            role="img"
            aria-label={t('reports.velocityLabel', {
              count: data.sprints.length,
              average: format(average),
            })}
          >
            {yTicks.map((value) => (
              <g key={value}>
                <line
                  x1={PAD.left}
                  x2={WIDTH - PAD.right}
                  y1={y(value)}
                  y2={y(value)}
                  stroke="var(--border)"
                />
                <text
                  x={PAD.left - 6}
                  y={y(value)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize="11"
                  fill="var(--ink-muted)"
                >
                  {format(value)}
                </text>
              </g>
            ))}
            {data.sprints.map((entry, index) => {
              const center = PAD.left + band * index + band / 2;
              return (
                <g key={entry.sprint.id}>
                  <rect
                    x={center - bar - 2}
                    y={y(entry.committed)}
                    width={bar}
                    height={y(0) - y(entry.committed)}
                    fill="var(--border-strong)"
                  >
                    <title>{`${entry.sprint.name}: ${t('reports.committed')} ${format(entry.committed)}`}</title>
                  </rect>
                  <rect
                    x={center + 2}
                    y={y(entry.completed)}
                    width={bar}
                    height={y(0) - y(entry.completed)}
                    fill="var(--accent)"
                  >
                    <title>{`${entry.sprint.name}: ${t('reports.completed')} ${format(entry.completed)}`}</title>
                  </rect>
                  <text
                    x={center}
                    y={HEIGHT - PAD.bottom + 16}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--ink-muted)"
                  >
                    {entry.sprint.name.length > 18
                      ? `${entry.sprint.name.slice(0, 17)}…`
                      : entry.sprint.name}
                  </text>
                </g>
              );
            })}
          </svg>
        )
      }
      table={
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="tl-label text-[var(--ink-muted)]">
              <th className={cell}>{t('reports.sprint')}</th>
              <th className={`${cell} text-right`}>{t('reports.committed')}</th>
              <th className={`${cell} text-right`}>{t('reports.completed')}</th>
            </tr>
          </thead>
          <tbody>
            {data.sprints.map((entry) => (
              <tr key={entry.sprint.id}>
                <td className={cell}>{entry.sprint.name}</td>
                <td className={`${cell} text-right tabular-nums`}>{format(entry.committed)}</td>
                <td className={`${cell} text-right tabular-nums`}>{format(entry.completed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  );
}

export function Legend({
  items,
}: {
  items: Array<{ color: string; label: string; dashed?: boolean }>;
}) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-4 p-0 text-xs text-[var(--ink-muted)]">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <svg width="20" height="8" aria-hidden="true">
            <line
              x1="0"
              y1="4"
              x2="20"
              y2="4"
              stroke={item.color}
              strokeWidth="3"
              strokeDasharray={item.dashed ? '5 3' : undefined}
            />
          </svg>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
