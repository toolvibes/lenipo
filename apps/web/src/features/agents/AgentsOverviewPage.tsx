import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { PresenceState } from '@toolvibes/shared';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { FormError } from '../../ui/FormError';
import { TopBar } from '../../ui/TopBar';
import { Avatar } from '../tracking/UserPicker';
import { BudgetUse } from './Budget';
import { PendingApprovals } from './PendingApprovals';

export const STATE_TONES: Record<PresenceState, string> = {
  active: 'var(--success)',
  waiting: 'var(--warning)',
  blocked: 'var(--danger)',
  offline: 'var(--ink-muted)',
};

export const overviewQuery = {
  queryKey: ['agents', 'overview'],
  queryFn: () => unwrap(client.GET('/api/v1/agents/overview')),
  // Heartbeats come every few minutes; no realtime signal for them.
  refetchInterval: 60_000,
};

/**
 * The agents dashboard (TL-98, E-150): who works on what, budget use today, throughput and
 * failures of the last week, open questions, and what waits for the viewer's approval.
 */
export function AgentsOverviewPage() {
  const { t } = useTranslation();
  const overview = useQuery(overviewQuery);
  return (
    <>
      <TopBar crumbs={[t('guard.title')]} />
      <main className="flex max-w-[1120px] flex-col gap-6 px-6 py-6 lg:px-10">
        <header className="flex flex-col gap-1">
          <h1 className="m-0 text-[26px] leading-tight font-semibold tracking-[-0.015em]">
            {t('guard.title')}
          </h1>
          <p className="m-0 max-w-[680px] text-[var(--ink-muted)]">{t('guard.intro')}</p>
        </header>
        <PendingApprovals />
        {overview.error && <FormError message={overview.error.message} />}
        {overview.data && overview.data.length === 0 && (
          <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('guard.empty')}</p>
        )}
        {overview.data && overview.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-[var(--ink-muted)]">
                  <th className="tl-label py-1.5 pr-3 font-semibold">{t('guard.agent')}</th>
                  <th className="tl-label py-1.5 pr-3 font-semibold">{t('guard.state')}</th>
                  <th className="tl-label py-1.5 pr-3 font-semibold">{t('guard.workingOn')}</th>
                  <th className="tl-label py-1.5 pr-3 font-semibold">{t('guard.budgetToday')}</th>
                  <th className="tl-label py-1.5 pr-3 text-right font-semibold">
                    {t('guard.throughput')}
                  </th>
                  <th className="tl-label py-1.5 pr-3 text-right font-semibold">
                    {t('guard.failures')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {overview.data.map(({ agent, presence, usage, throughput, failures, question }) => (
                  <tr key={agent.id} className="border-t border-[var(--border)] align-top">
                    <td className="py-2 pr-3">
                      <Link
                        to="/agents/$id"
                        params={{ id: agent.id }}
                        className="flex items-center gap-2 text-[var(--ink)] no-underline hover:underline"
                      >
                        <Avatar user={agent} />
                        <span className="flex flex-col">
                          <span className="font-semibold">{agent.displayName}</span>
                          <span className="text-xs text-[var(--ink-muted)]">
                            {[agent.vendor, agent.model].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="py-2 pr-3">
                      {agent.paused ? (
                        <span className="font-semibold text-[var(--danger)]">
                          {t('guard.paused')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            aria-hidden
                            className="size-2 rounded-full"
                            style={{ backgroundColor: STATE_TONES[presence.state] }}
                          />
                          {t(`team.states.${presence.state}`)}
                        </span>
                      )}
                      {presence.heartbeatAt && (
                        <span className="block text-xs text-[var(--ink-muted)]">
                          {formatRelative(presence.heartbeatAt)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {presence.issue && (
                        <>
                          <Link
                            to="/issues/$key"
                            params={{ key: presence.issue.key }}
                            className="text-[var(--accent)]"
                          >
                            {presence.issue.key}
                          </Link>{' '}
                          {presence.issue.summary}
                        </>
                      )}
                      {question && (
                        <span className="block text-xs text-[var(--warning)]">
                          {t('guard.question')}:{' '}
                          {question.note || t(`team.states.${question.state}`)} ·{' '}
                          {formatRelative(question.since)}
                        </span>
                      )}
                      {!question && presence.note && (
                        <span className="block text-xs text-[var(--ink-muted)]">
                          {presence.note}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <BudgetUse usage={usage} period="day" />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{throughput}</td>
                    <td
                      className={`py-2 pr-3 text-right tabular-nums ${failures > 0 ? 'text-[var(--danger)]' : ''}`}
                    >
                      {failures}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
