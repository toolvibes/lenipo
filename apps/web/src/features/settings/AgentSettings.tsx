import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AGENT_ROLES, type AgentRole, type ProjectAgentSettings } from '@toolvibes/shared';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { agentsQuery } from '../../lib/queries';
import { projectQuery } from '../../lib/tracking';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { Avatar } from '../tracking/UserPicker';

/** Roles of agents in the project and whether sprints need a person's approval (TL-96, E-148). */
export function AgentSettings({ projectKey }: { projectKey: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ['project', projectKey, 'agent-settings'];
  const settings = useQuery({
    queryKey,
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/projects/{key}/agent-settings', {
          params: { path: { key: projectKey } },
        }),
      ),
  });
  const agents = useQuery(agentsQuery);
  const project = useQuery(projectQuery(projectKey));
  const statusOptions = [
    { value: '', label: t('agentSettings.reviewStay') },
    ...(project.data?.statuses ?? []).map((status) => ({ value: status.id, label: status.name })),
  ];
  const reviewRule = useMutation({
    mutationFn: (reviewStatuses: { approved: string | null; changesRequested: string | null }) =>
      unwrap(
        client.PUT('/api/v1/projects/{key}/agent-settings', {
          params: { path: { key: projectKey } },
          body: { reviewStatuses },
        }),
      ),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });
  const rule = settings.data?.reviewStatuses ?? { approved: null, changesRequested: null };
  const saved = (data: ProjectAgentSettings) => queryClient.setQueryData(queryKey, data);
  const approval = useMutation({
    mutationFn: (sprintApproval: boolean) =>
      unwrap(
        client.PUT('/api/v1/projects/{key}/agent-settings', {
          params: { path: { key: projectKey } },
          body: { sprintApproval },
        }),
      ),
    onSuccess: saved,
  });
  const roles = useMutation({
    mutationFn: (change: { userId: string; roles: AgentRole[] }) =>
      unwrap(
        client.PUT('/api/v1/projects/{key}/agent-settings/roles/{userId}', {
          params: { path: { key: projectKey, userId: change.userId } },
          body: { roles: change.roles },
        }),
      ),
    onSuccess: saved,
  });
  const rolesOf = (id: string) =>
    settings.data?.agents.find((entry) => entry.agent.id === id)?.roles ?? [];
  const error = settings.error ?? approval.error ?? roles.error ?? reviewRule.error;
  return (
    <section className="flex flex-col gap-4">
      <h2 className="m-0 text-base font-semibold">{t('agentSettings.title')}</h2>
      <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('agentSettings.intro')}</p>
      {error && <FormError message={error.message} />}
      <label className="flex items-start gap-2 text-[13px]">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={settings.data?.sprintApproval ?? false}
          disabled={!settings.data || approval.isPending}
          onChange={(event) => approval.mutate(event.target.checked)}
        />
        <span>
          {t('agentSettings.approval')}
          <span className="block text-xs text-[var(--ink-muted)]">
            {t('agentSettings.approvalHelp')}
          </span>
        </span>
      </label>
      <div className="flex flex-wrap gap-3">
        <Select
          label={t('agentSettings.reviewApproved')}
          value={rule.approved ?? ''}
          disabled={!settings.data || reviewRule.isPending}
          options={statusOptions}
          onChange={(event) => reviewRule.mutate({ ...rule, approved: event.target.value || null })}
        />
        <Select
          label={t('agentSettings.reviewChanges')}
          value={rule.changesRequested ?? ''}
          disabled={!settings.data || reviewRule.isPending}
          options={statusOptions}
          onChange={(event) =>
            reviewRule.mutate({ ...rule, changesRequested: event.target.value || null })
          }
        />
      </div>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-left text-[var(--ink-muted)]">
            <th className="tl-label py-1.5 pr-3 font-semibold">{t('agents.title')}</th>
            {AGENT_ROLES.map((role) => (
              <th key={role} className="tl-label py-1.5 pr-3 font-semibold">
                {t(`agentSettings.roles.${role}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(agents.data ?? [])
            .filter((agent) => agent.status === 'active')
            .map((agent) => {
              const current = rolesOf(agent.id);
              return (
                <tr key={agent.id} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-2">
                      <Avatar user={agent} size={20} />
                      {agent.displayName}
                    </span>
                  </td>
                  {AGENT_ROLES.map((role) => (
                    <td key={role} className="py-2 pr-3">
                      <input
                        type="checkbox"
                        aria-label={`${agent.displayName}: ${t(`agentSettings.roles.${role}`)}`}
                        checked={current.includes(role)}
                        disabled={roles.isPending}
                        onChange={(event) =>
                          roles.mutate({
                            userId: agent.id,
                            roles: event.target.checked
                              ? [...current, role]
                              : current.filter((entry) => entry !== role),
                          })
                        }
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
        </tbody>
      </table>
      <p className="m-0 text-xs text-[var(--ink-muted)]">{t('agentSettings.default')}</p>
    </section>
  );
}
