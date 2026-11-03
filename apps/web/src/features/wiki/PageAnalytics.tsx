import { useQuery } from '@tanstack/react-query';
import type { PageAnalytics } from '@toolvibes/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { Dialog } from '../../ui/Dialog';
import { Select } from '../../ui/Select';

const PERIODS = [7, 30, 90, 365] as const;

/** Every day of the period, with zero where nobody read the page. */
function filled(analytics: PageAnalytics): PageAnalytics['daily'] {
  const byDay = new Map(analytics.daily.map((entry) => [entry.day, entry]));
  const days: PageAnalytics['daily'] = [];
  const today = new Date();
  for (let offset = analytics.days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    days.push(byDay.get(day) ?? { day, views: 0, readers: 0 });
  }
  return days;
}

/** Views per day as bars; each bar names its day and count on hover. */
function ViewsChart({ analytics }: { analytics: PageAnalytics }) {
  const { t } = useTranslation();
  const days = filled(analytics);
  const max = Math.max(1, ...days.map((entry) => entry.views));
  const width = 560;
  const height = 120;
  const step = width / days.length;
  const bar = Math.max(1, step - 2);
  return (
    <svg
      viewBox={`0 0 ${width} ${height + 16}`}
      role="img"
      aria-label={t('analytics.chart', { views: analytics.views, days: analytics.days })}
      className="block h-auto w-full"
    >
      <line x1={0} x2={width} y1={height} y2={height} stroke="var(--border)" strokeWidth={1} />
      {days.map((entry, index) => {
        const h = (entry.views / max) * (height - 4);
        return (
          <g key={entry.day}>
            {/* A full-height hit area, so short bars still show their numbers. */}
            <rect x={index * step} y={0} width={step} height={height} fill="transparent">
              <title>
                {t('analytics.bar', {
                  day: formatDate(entry.day),
                  views: entry.views,
                  readers: entry.readers,
                })}
              </title>
            </rect>
            {entry.views > 0 && (
              <rect
                x={index * step + 1}
                y={height - h}
                width={bar}
                height={h}
                rx={Math.min(2, bar / 2)}
                fill="var(--accent)"
                pointerEvents="none"
              />
            )}
          </g>
        );
      })}
      <text x={0} y={height + 13} fontSize={11} fill="var(--ink-muted)">
        {formatDate(days[0]?.day ?? '')}
      </text>
      <text x={width} y={height + 13} fontSize={11} fill="var(--ink-muted)" textAnchor="end">
        {formatDate(days.at(-1)?.day ?? '')}
      </text>
    </svg>
  );
}

/**
 * Page analytics (W-PAG-14, TL-51, E-135): views and readers over a period; the list of readers
 * only for space administrators, from the last 90 days.
 */
export function PageAnalyticsDialog({
  pageId,
  open,
  onOpenChange,
}: {
  pageId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [days, setDays] = useState<number>(30);
  const analytics = useQuery({
    queryKey: ['page', pageId, 'analytics', days],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/pages/{id}/analytics', {
          params: { path: { id: pageId }, query: { days } },
        }),
      ),
    enabled: open,
  });
  const data = analytics.data;
  const stat = 'flex flex-col rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2';
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('analytics.title')} width={640}>
      <div className="flex flex-col gap-4">
        <Select
          label={t('analytics.period')}
          value={String(days)}
          options={PERIODS.map((value) => ({
            value: String(value),
            label: t('analytics.days', { count: value }),
          }))}
          onChange={(event) => setDays(Number(event.target.value))}
        />
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className={stat}>
                <span className="text-xs text-[var(--ink-muted)]">{t('analytics.views')}</span>
                <strong className="text-2xl">{data.views}</strong>
              </div>
              <div className={stat}>
                <span className="text-xs text-[var(--ink-muted)]">{t('analytics.readers')}</span>
                <strong className="text-2xl">{data.readers}</strong>
              </div>
            </div>
            <ViewsChart analytics={data} />
            {data.readerList && (
              <table className="w-full border-collapse text-[13px]">
                <caption className="mb-1 text-left text-xs text-[var(--ink-muted)]">
                  {t('analytics.readerList')}
                </caption>
                <thead>
                  <tr className="text-left text-xs text-[var(--ink-muted)]">
                    <th className="py-1 font-medium">{t('analytics.reader')}</th>
                    <th className="py-1 text-right font-medium">{t('analytics.views')}</th>
                    <th className="py-1 text-right font-medium">{t('analytics.lastViewed')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.readerList.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-1 text-[var(--ink-muted)]">
                        {t('analytics.none')}
                      </td>
                    </tr>
                  )}
                  {data.readerList.map((entry) => (
                    <tr key={entry.user.id} className="border-t border-[var(--border)]">
                      <td className="py-1">{entry.user.displayName}</td>
                      <td className="py-1 text-right">{entry.views}</td>
                      <td className="py-1 text-right">{formatDate(entry.lastViewed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="m-0 text-xs text-[var(--ink-muted)]">{t('analytics.privacy')}</p>
          </>
        )}
      </div>
    </Dialog>
  );
}
