import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';

/**
 * Agents waiting for a person to start or complete a sprint (TL-96, E-148). Approving runs the
 * action in the agent's name; a rejection's reason goes back to the agent.
 */
export function SprintApprovals({ projectKey, boardId }: { projectKey: string; boardId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ['project', projectKey, 'sprint-approvals'];
  const pending = useQuery({
    queryKey,
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/projects/{key}/sprint-approvals', {
          params: { path: { key: projectKey }, query: { status: 'pending' } },
        }),
      ),
    refetchInterval: 60_000,
  });
  const decide = useMutation({
    mutationFn: (decision: { id: string; approve: boolean; reason: string }) =>
      unwrap(
        client.POST('/api/v1/sprint-approvals/{id}/decision', {
          params: { path: { id: decision.id } },
          body: { approve: decision.approve, reason: decision.reason },
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      await queryClient.invalidateQueries({ queryKey: ['backlog'] });
    },
  });
  const requests = (pending.data ?? []).filter((entry) => entry.sprint.boardId === boardId);
  if (requests.length === 0) return null;
  return (
    <section
      aria-label={t('approvals.title')}
      className="mx-6 flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--warning-soft)] px-4 py-3 lg:mx-10"
    >
      {decide.error && <FormError message={decide.error.message} />}
      {requests.map((request) => (
        <div key={request.id} className="flex flex-wrap items-center gap-3 text-[13px]">
          <span className="min-w-0 flex-1">
            {t(`approvals.${request.action}`, {
              agent: request.requestedBy.displayName,
              sprint: request.sprint.name,
            })}{' '}
            <span className="text-[var(--ink-muted)]">· {formatRelative(request.createdAt)}</span>
          </span>
          <Button
            size="sm"
            variant="primary"
            disabled={decide.isPending}
            onClick={() => decide.mutate({ id: request.id, approve: true, reason: '' })}
          >
            {t('approvals.approve')}
          </Button>
          <Button
            size="sm"
            disabled={decide.isPending}
            onClick={() => {
              const reason = window.prompt(t('approvals.reasonPrompt'));
              if (reason !== null) decide.mutate({ id: request.id, approve: false, reason });
            }}
          >
            {t('approvals.reject')}
          </Button>
        </div>
      ))}
    </section>
  );
}
