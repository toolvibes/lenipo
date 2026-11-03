import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  type Agent,
  type AgentActivity,
  type AgentBudget,
  BUDGET_METRICS,
  type BudgetMetric,
} from '@toolvibes/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, client, unwrap } from '../../lib/api';
import { formatDateTime, formatRelative } from '../../lib/format';
import { agentsQuery, meQuery } from '../../lib/queries';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';
import { TopBar } from '../../ui/TopBar';
import { useFieldLabel } from '../tracking/fieldLabel';
import { Avatar } from '../tracking/UserPicker';
import { BudgetUse } from './Budget';

/**
 * One agent (TL-98, E-150): its Not-Aus, budget, rights and history. The agent, its responsible
 * person and administrators see all of it; the pause and the budget change only the latter two.
 */
export function AgentDetailPage({ agentId }: { agentId: string }) {
  const { t } = useTranslation();
  const me = useQuery(meQuery);
  const agents = useQuery(agentsQuery);
  const agent = agents.data?.find((entry) => entry.id === agentId);
  const manages =
    !!me.data && (me.data.globalPermissions.includes('admin') || agent?.owner?.id === me.data.id);
  const usage = useQuery({
    queryKey: ['agents', agentId, 'usage'],
    queryFn: () =>
      unwrap(client.GET('/api/v1/agents/{id}/usage', { params: { path: { id: agentId } } })),
    retry: false,
  });
  const forbidden = usage.error instanceof ApiError && usage.error.status === 403;
  return (
    <>
      <TopBar
        crumbs={[
          <Link key="all" to="/agents" className="text-[var(--ink-muted)]">
            {t('guard.title')}
          </Link>,
          agent?.displayName ?? '…',
        ]}
      />
      <main className="flex max-w-[960px] flex-col gap-6 px-6 py-6 lg:px-10">
        {agent && (
          <header className="flex flex-wrap items-center gap-3">
            <Avatar user={agent} size={40} />
            <div className="flex min-w-0 flex-1 flex-col">
              <h1 className="m-0 text-[26px] leading-tight font-semibold tracking-[-0.015em]">
                {agent.displayName}
              </h1>
              <span className="text-[13px] text-[var(--ink-muted)]">
                {[
                  agent.vendor,
                  agent.model,
                  agent.owner
                    ? t('agents.ownedBy', { name: agent.owner.displayName })
                    : t('agents.noOwner'),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
            {manages && <PauseControl agent={agent} />}
          </header>
        )}
        {agent?.paused && (
          <p className="m-0 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--danger-soft)] px-4 py-3 text-[13px]">
            {agent.paused.by
              ? t('guard.pausedBy', {
                  name: agent.paused.by.displayName,
                  time: formatDateTime(agent.paused.at),
                })
              : t('guard.pausedSince', { time: formatDateTime(agent.paused.at) })}
            {agent.paused.reason && <span className="block">{agent.paused.reason}</span>}
          </p>
        )}
        {forbidden && <p className="m-0 text-[var(--ink-muted)]">{t('guard.notAllowed')}</p>}
        {usage.error && !forbidden && <FormError message={usage.error.message} />}
        {usage.data && agent && (
          <section className="flex flex-col gap-3">
            <h2 className="m-0 text-base font-semibold">{t('guard.budget')}</h2>
            <div className="flex flex-wrap gap-10">
              {(['day', 'month'] as const).map((period) => (
                <div key={period} className="flex flex-col gap-1.5">
                  <span className="tl-label text-[var(--ink-muted)]">{t(`guard.${period}`)}</span>
                  <BudgetUse usage={usage.data} period={period} />
                </div>
              ))}
            </div>
            {manages && <BudgetForm agent={agent} />}
          </section>
        )}
        {usage.data && <Rights agentId={agentId} />}
        {usage.data && <History agentId={agentId} />}
      </main>
    </>
  );
}

function PauseControl({ agent }: { agent: Agent }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: (reason: string | null) =>
      reason === null
        ? unwrap(client.DELETE('/api/v1/agents/{id}/pause', { params: { path: { id: agent.id } } }))
        : unwrap(
            client.PUT('/api/v1/agents/{id}/pause', {
              params: { path: { id: agent.id } },
              body: { reason },
            }),
          ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });
  return (
    <div className="flex flex-col items-end gap-1">
      {toggle.error && <FormError message={toggle.error.message} />}
      {agent.paused ? (
        <Button variant="primary" disabled={toggle.isPending} onClick={() => toggle.mutate(null)}>
          {t('guard.resume')}
        </Button>
      ) : (
        <Button
          variant="danger"
          title={t('guard.pauseHelp')}
          disabled={toggle.isPending}
          onClick={() => {
            const reason = window.prompt(t('guard.pauseConfirm', { name: agent.displayName }));
            if (reason !== null) toggle.mutate(reason.trim());
          }}
        >
          {t('guard.pause')}
        </Button>
      )}
    </div>
  );
}

type Draft = Record<'day' | 'month', Record<BudgetMetric, string>>;

const toDraft = (budget: AgentBudget): Draft => ({
  day: Object.fromEntries(
    BUDGET_METRICS.map((metric) => [metric, budget.day[metric]?.toString() ?? '']),
  ) as Record<BudgetMetric, string>,
  month: Object.fromEntries(
    BUDGET_METRICS.map((metric) => [metric, budget.month[metric]?.toString() ?? '']),
  ) as Record<BudgetMetric, string>,
});

function BudgetForm({ agent }: { agent: Agent }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => toDraft(agent.budget));
  const save = useMutation({
    mutationFn: () => {
      const limits = (period: 'day' | 'month') =>
        Object.fromEntries(
          BUDGET_METRICS.map((metric) => {
            const value = draft[period][metric].trim().replace(',', '.');
            return [metric, value === '' ? null : Number(value)];
          }),
        ) as AgentBudget['day'];
      return unwrap(
        client.PUT('/api/v1/agents/{id}/budget', {
          params: { path: { id: agent.id } },
          body: { day: limits('day'), month: limits('month') },
        }),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <p className="m-0 max-w-[680px] text-xs text-[var(--ink-muted)]">{t('guard.budgetHelp')}</p>
      {save.error && <FormError message={save.error.message} />}
      {(['day', 'month'] as const).map((period) => (
        <fieldset key={period} className="m-0 flex flex-wrap gap-3 border-0 p-0">
          <legend className="tl-label mb-1 p-0 text-[var(--ink-muted)]">
            {t(`guard.${period}`)}
          </legend>
          {BUDGET_METRICS.map((metric) => (
            <div key={metric} className="w-[140px]">
              <TextField
                label={t(`guard.metrics.${metric}`)}
                inputMode="decimal"
                placeholder={t('guard.noLimit')}
                value={draft[period][metric]}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    [period]: { ...draft[period], [metric]: event.target.value },
                  })
                }
              />
            </div>
          ))}
        </fieldset>
      ))}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={save.isPending}>
          {t('guard.saveBudget')}
        </Button>
        {save.isSuccess && (
          <span className="text-xs text-[var(--ink-muted)]">{t('guard.saved')}</span>
        )}
      </div>
    </form>
  );
}

function Rights({ agentId }: { agentId: string }) {
  const { t } = useTranslation();
  const rights = useQuery({
    queryKey: ['agents', agentId, 'rights'],
    queryFn: () =>
      unwrap(client.GET('/api/v1/agents/{id}/rights', { params: { path: { id: agentId } } })),
  });
  return (
    <section className="flex flex-col gap-2">
      <h2 className="m-0 text-base font-semibold">{t('guard.rights')}</h2>
      <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('guard.rightsIntro')}</p>
      {rights.error && <FormError message={rights.error.message} />}
      {rights.data && (
        <>
          <p className="m-0 text-[13px]">
            <span className="font-semibold">{t('guard.groups')}:</span>{' '}
            {rights.data.groups.join(', ') || t('guard.noGroups')}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-[var(--ink-muted)]">
                  <th className="tl-label py-1.5 pr-3 font-semibold">{t('guard.project')}</th>
                  <th className="tl-label py-1.5 pr-3 font-semibold">{t('guard.roles')}</th>
                  <th className="tl-label py-1.5 font-semibold">{t('guard.permissions')}</th>
                </tr>
              </thead>
              <tbody>
                {rights.data.projects.map((project) => (
                  <tr key={project.key} className="border-t border-[var(--border)] align-top">
                    <td className="py-2 pr-3">
                      <span className="font-[family-name:var(--font-mono)] text-xs">
                        {project.key}
                      </span>{' '}
                      {project.name}
                      {project.paused && (
                        <span className="block text-xs text-[var(--danger)]">
                          {t('guard.projectPaused')}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {project.roles.map((role) => t(`agentSettings.roles.${role}`)).join(', ')}
                    </td>
                    <td className="py-2 text-xs text-[var(--ink-muted)]">
                      {project.permissions.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rights.data.tokens.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
              <li className="font-semibold">{t('guard.tokens')}</li>
              {rights.data.tokens.map((token) => (
                <li key={`${token.name}-${token.expiresAt}`}>
                  {token.name}: <code className="text-xs">{token.scopes.join(', ')}</code>{' '}
                  <span className="text-xs text-[var(--ink-muted)]">
                    ·{' '}
                    {token.lastUsedAt
                      ? t('guard.lastUsed', { time: formatRelative(token.lastUsedAt) })
                      : t('guard.neverUsed')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function History({ agentId }: { agentId: string }) {
  const { t } = useTranslation();
  const [failures, setFailures] = useState(false);
  const history = useInfiniteQuery({
    queryKey: ['agents', agentId, 'activity', failures],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        client.GET('/api/v1/agents/{id}/activity', {
          params: {
            path: { id: agentId },
            query: {
              limit: 50,
              failures: failures ? 'true' : 'false',
              ...(pageParam ? { before: pageParam } : {}),
            },
          },
        }),
      ),
    getNextPageParam: (page) => page.next ?? undefined,
  });
  const entries = history.data?.pages.flatMap((page) => page.entries) ?? [];
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="m-0 flex-1 text-base font-semibold">{t('guard.history')}</h2>
        <label className="flex items-center gap-1.5 text-[13px]">
          <input
            type="checkbox"
            checked={failures}
            onChange={(event) => setFailures(event.target.checked)}
          />
          {t('guard.onlyFailures')}
        </label>
      </div>
      <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('guard.historyIntro')}</p>
      {history.error && <FormError message={history.error.message} />}
      {history.data && entries.length === 0 && (
        <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('guard.historyEmpty')}</p>
      )}
      <ul className="m-0 flex list-none flex-col p-0 text-[13px]">
        {entries.map((entry) => (
          <HistoryEntry key={`${entry.at}-${entry.kind}-${entry.title}`} entry={entry} />
        ))}
      </ul>
      {history.hasNextPage && (
        <div>
          <Button
            size="sm"
            disabled={history.isFetchingNextPage}
            onClick={() => void history.fetchNextPage()}
          >
            {t('guard.more')}
          </Button>
        </div>
      )}
    </section>
  );
}

/** Review and approval entries carry a code such as `review.given.approved`. */
function useEntryTitle() {
  const { t } = useTranslation();
  const label = useFieldLabel();
  return (entry: AgentActivity) => {
    // `status: Offen → In Arbeit; assignee: – → Claude`, with the fields named as elsewhere.
    if (entry.kind === 'change') {
      return entry.title
        .split('; ')
        .map((part) => {
          const colon = part.indexOf(': ');
          return colon < 0 ? part : `${label.name(part.slice(0, colon))}${part.slice(colon)}`;
        })
        .join('; ');
    }
    if (entry.kind === 'review') {
      const [, side, status] = entry.title.split('.');
      return `${t(side === 'given' ? 'reviews.given' : 'reviews.received')}: ${t(`reviews.status.${status === 'approved' || status === 'changes_requested' || status === 'cancelled' ? status : 'requested'}`)}`;
    }
    if (entry.kind === 'approval') {
      const [code = '', sprint] = entry.title.split(':');
      const [, action, status] = code.split('.');
      const outcome = status === 'approved' || status === 'rejected' ? status : 'requested';
      return `${t(`approvals.status.${outcome}`)}: ${
        action === 'transition'
          ? t('approvals.transition')
          : t(`notifications.approval.${action === 'complete' ? 'complete' : 'start'}`)
      }${sprint ? ` „${sprint}“` : ''}`;
    }
    if (entry.kind === 'comment') {
      return entry.title === 'comment.handover'
        ? t('handover.badge')
        : entry.title === 'comment.review'
          ? t('reviews.badge')
          : t('guard.kinds.comment');
    }
    return entry.title;
  };
}

function HistoryEntry({ entry }: { entry: AgentActivity }) {
  const { t } = useTranslation();
  const title = useEntryTitle();
  return (
    <li className="flex flex-wrap gap-x-3 gap-y-0.5 border-t border-[var(--border)] py-2">
      <span
        className="w-[92px] shrink-0 text-xs text-[var(--ink-muted)]"
        title={formatDateTime(entry.at)}
      >
        {formatRelative(entry.at)}
      </span>
      <span className="w-[80px] shrink-0 text-xs text-[var(--ink-muted)]">
        {t(`guard.kinds.${entry.kind}`)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={entry.ok ? '' : 'text-[var(--danger)]'}>
          {entry.kind === 'request' ? (
            <code className="text-xs">{title(entry)}</code>
          ) : (
            title(entry)
          )}
          {entry.status !== null && <span className="tabular-nums"> · {entry.status}</span>}
          {entry.issue && entry.kind !== 'request' && (
            <>
              {' · '}
              <Link
                to="/issues/$key"
                params={{ key: entry.issue.key }}
                className="text-[var(--accent)]"
              >
                {entry.issue.key}
              </Link>{' '}
              {entry.issue.summary}
            </>
          )}
        </span>
        {entry.detail && (
          <span className="text-xs whitespace-pre-wrap text-[var(--ink-muted)]">
            {entry.detail}
          </span>
        )}
      </span>
    </li>
  );
}
