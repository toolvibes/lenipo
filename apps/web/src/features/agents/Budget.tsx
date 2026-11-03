import { type AgentUsage, BUDGET_METRICS, type BudgetMetric } from '@toolvibes/shared';
import { useTranslation } from 'react-i18next';

const amount = (metric: BudgetMetric, value: number) =>
  metric === 'cost' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(value);

/** Use against the limits of one period: a bar per limited metric, the number otherwise. */
export function BudgetUse({ usage, period }: { usage: AgentUsage; period: 'day' | 'month' }) {
  const { t } = useTranslation();
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs">
      {BUDGET_METRICS.map((metric) => {
        const used = usage[period][metric];
        const limit = usage.budget[period][metric];
        const over = usage.exceeded.includes(`${period}.${metric}`);
        const share = limit ? Math.min(100, (used / limit) * 100) : 0;
        return (
          <li key={metric} className="flex flex-col gap-0.5">
            <span className={over ? 'font-semibold text-[var(--danger)]' : ''}>
              {t(`guard.metrics.${metric}`)}: {amount(metric, used)}
              {limit !== null ? ` / ${amount(metric, limit)}` : ''}
              {over ? ` · ${t('guard.over')}` : ''}
            </span>
            {limit !== null && (
              <span
                aria-hidden
                className="block h-1 w-full max-w-[140px] overflow-hidden rounded-full bg-[var(--border)]"
              >
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${share}%`,
                    backgroundColor:
                      share >= 100
                        ? 'var(--danger)'
                        : share >= 80
                          ? 'var(--warning)'
                          : 'var(--accent)',
                  }}
                />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
