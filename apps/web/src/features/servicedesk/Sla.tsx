import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { IssueSla, SlaMetric } from '@toolvibes/shared';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { TopBar } from '../../ui/TopBar';
import { StatusLozenge } from '../tracking/icons';

/** One SLA clock as words: met, running, resting or breached (TL-47, E-137). */
function MetricText({ metric }: { metric: SlaMetric }) {
  const { t } = useTranslation();
  const hours = (value: number) =>
    Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (metric.breached) {
    return (
      <span className="font-semibold text-[var(--danger)]">
        {t('sla.breached', { hours: hours(metric.remainingHours) })}
      </span>
    );
  }
  if (metric.stopped) {
    return (
      <span className="text-[var(--success)]">
        {t('sla.met', { hours: hours(metric.elapsedHours) })}
      </span>
    );
  }
  return (
    <span>
      {t('sla.remaining', { hours: hours(metric.remainingHours) })}
      {metric.paused && <span className="text-[var(--ink-muted)]"> · {t('sla.paused')}</span>}
    </span>
  );
}

/** The SLA clocks on the issue page; nothing for issues that are no service requests. */
export function SlaPanel({ issueKey }: { issueKey: string }) {
  const { t } = useTranslation();
  const sla = useQuery({
    queryKey: ['issue', issueKey, 'sla'],
    queryFn: () =>
      unwrap(client.GET('/api/v1/issues/{key}/sla', { params: { path: { key: issueKey } } })),
  }).data?.sla;
  if (!sla || (!sla.firstResponse && !sla.resolution)) return null;
  return (
    <section aria-label={t('sla.title')} className="flex flex-col gap-1 text-[13px]">
      <h3 className="tl-label m-0 text-[var(--ink-muted)]">{t('sla.title')}</h3>
      {sla.firstResponse && (
        <span>
          {t('sla.firstResponse')}: <MetricText metric={sla.firstResponse} />
        </span>
      )}
      {sla.resolution && (
        <span>
          {t('sla.resolution')}: <MetricText metric={sla.resolution} />
        </span>
      )}
    </section>
  );
}

/** The open metric that runs out first. */
function urgent(sla: IssueSla): SlaMetric | null {
  return (
    [sla.firstResponse, sla.resolution]
      .filter((metric): metric is SlaMetric => !!metric && !metric.stopped)
      .sort((a, b) => a.remainingHours - b.remainingHours)[0] ?? null
  );
}

/** Open requests of a service desk, the most urgent first (TL-47, E-137). */
export function QueuePage({ projectKey }: { projectKey: string }) {
  const { t } = useTranslation();
  const queue = useQuery({
    queryKey: ['project', projectKey, 'queue'],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/projects/{key}/service-desk/queue', {
          params: { path: { key: projectKey } },
        }),
      ),
    refetchInterval: 60_000,
  });
  return (
    <main className="flex flex-col">
      <TopBar
        crumbs={[
          <Link key="project" to="/projects/$key" params={{ key: projectKey }}>
            {projectKey}
          </Link>,
          t('sla.queue'),
        ]}
      />
      <div className="flex flex-col gap-4 px-6 py-5">
        <h1 className="tl-heading-xl">{t('sla.queue')}</h1>
        {queue.error && <p className="m-0 text-[var(--danger)]">{queue.error.message}</p>}
        {queue.data?.length === 0 && (
          <p className="m-0 text-[var(--ink-muted)]">{t('sla.empty')}</p>
        )}
        {queue.data && queue.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-xs text-[var(--ink-muted)]">
                  <th className="py-1.5 pr-3 font-medium">{t('sla.request')}</th>
                  <th className="py-1.5 pr-3 font-medium">{t('sla.type')}</th>
                  <th className="py-1.5 pr-3 font-medium">{t('issues.priority')}</th>
                  <th className="py-1.5 pr-3 font-medium">{t('sla.status')}</th>
                  <th className="py-1.5 pr-3 font-medium">{t('issues.assignee')}</th>
                  <th className="py-1.5 pr-3 font-medium">{t('sla.customer')}</th>
                  <th className="py-1.5 font-medium">{t('sla.next')}</th>
                </tr>
              </thead>
              <tbody>
                {queue.data.map((entry) => {
                  const next = urgent(entry.sla);
                  return (
                    <tr key={entry.key} className="border-t border-[var(--border)]">
                      <td className="py-1.5 pr-3">
                        <Link to="/issues/$key" params={{ key: entry.key }} className="tl-key mr-2">
                          {entry.key}
                        </Link>
                        {entry.summary}
                      </td>
                      <td className="py-1.5 pr-3">{entry.requestType}</td>
                      <td className="py-1.5 pr-3">{entry.priority}</td>
                      <td className="py-1.5 pr-3">
                        <StatusLozenge status={entry.status} />
                      </td>
                      <td className="py-1.5 pr-3">{entry.assignee?.displayName ?? '–'}</td>
                      <td className="py-1.5 pr-3">
                        {entry.reporter?.displayName ?? '–'}
                        <span className="block text-xs text-[var(--ink-muted)]">
                          {formatRelative(entry.createdAt)}
                        </span>
                      </td>
                      <td className="py-1.5">{next ? <MetricText metric={next} /> : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
