import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';

export const pendingApprovalsQuery = {
  queryKey: ['approvals', 'pending'],
  queryFn: () => unwrap(client.GET('/api/v1/approvals/pending')),
  refetchInterval: 60_000,
};

/**
 * Everything agents wait for the caller to approve (TL-98, E-150): sprint starts and completions
 * and moves into statuses the project keeps for people.
 */
export function PendingApprovals() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const pending = useQuery(pendingApprovalsQuery);
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['approvals'] });
    await queryClient.invalidateQueries({ queryKey: ['agents'] });
    await queryClient.invalidateQueries({ queryKey: ['backlog'] });
  };
  const decideSprint = useMutation({
    mutationFn: (decision: { id: string; approve: boolean; reason: string }) =>
      unwrap(
        client.POST('/api/v1/sprint-approvals/{id}/decision', {
          params: { path: { id: decision.id } },
          body: { approve: decision.approve, reason: decision.reason },
        }),
      ),
    onSuccess: refresh,
  });
  const decideIssue = useMutation({
    mutationFn: (decision: { id: string; approve: boolean; reason: string }) =>
      unwrap(
        client.POST('/api/v1/issue-approvals/{id}/decision', {
          params: { path: { id: decision.id } },
          body: { approve: decision.approve, reason: decision.reason },
        }),
      ),
    onSuccess: refresh,
  });
  const reason = () => {
    const text = window.prompt(t('approvals.reasonPrompt'));
    return text?.trim() ? text.trim() : null;
  };
  const sprints = pending.data?.sprints ?? [];
  const issues = pending.data?.issues ?? [];
  const busy = decideSprint.isPending || decideIssue.isPending;
  const error = pending.error ?? decideSprint.error ?? decideIssue.error;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="m-0 text-base font-semibold">{t('guard.approvals')}</h2>
      {error && <FormError message={error.message} />}
      {pending.data && sprints.length + issues.length === 0 && (
        <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('guard.approvalsEmpty')}</p>
      )}
      <ul className="m-0 flex list-none flex-col p-0 text-[13px]">
        {sprints.map((request) => (
          <li
            key={request.id}
            className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] py-2"
          >
            <span className="min-w-0 flex-1">
              {t(`approvals.${request.action}`, {
                agent: request.requestedBy.displayName,
                sprint: request.sprint.name,
              })}{' '}
              <Link
                to="/boards/$id/backlog"
                params={{ id: request.sprint.boardId }}
                className="text-[var(--accent)]"
              >
                {request.projectKey}
              </Link>
              <span className="text-[var(--ink-muted)]">
                {' '}
                · {formatRelative(request.createdAt)}
              </span>
            </span>
            <Button
              size="sm"
              variant="primary"
              disabled={busy}
              onClick={() => decideSprint.mutate({ id: request.id, approve: true, reason: '' })}
            >
              {t('approvals.approve')}
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => {
                const why = reason();
                if (why) decideSprint.mutate({ id: request.id, approve: false, reason: why });
              }}
            >
              {t('approvals.reject')}
            </Button>
          </li>
        ))}
        {issues.map((request) => (
          <li
            key={request.id}
            className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] py-2"
          >
            <span className="min-w-0 flex-1">
              {t('guard.transitionRequest', {
                agent: request.requestedBy.displayName,
                issue: request.issue.key,
                status: request.toStatus.name,
              })}{' '}
              <Link
                to="/issues/$key"
                params={{ key: request.issue.key }}
                className="text-[var(--accent)]"
              >
                {request.issue.summary}
              </Link>
              <span className="text-[var(--ink-muted)]">
                {' '}
                · {formatRelative(request.createdAt)}
              </span>
            </span>
            <Button
              size="sm"
              variant="primary"
              disabled={busy}
              onClick={() => decideIssue.mutate({ id: request.id, approve: true, reason: '' })}
            >
              {t('approvals.approve')}
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => {
                const why = reason();
                if (why) decideIssue.mutate({ id: request.id, approve: false, reason: why });
              }}
            >
              {t('approvals.reject')}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
