import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AGENT_VENDORS, type Agent } from '@toolvibes/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { agentsQuery, meQuery } from '../../lib/queries';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { Tokens } from '../personal/ProfilePage';
import { Avatar } from '../tracking/UserPicker';

const usersQuery = {
  queryKey: ['admin', 'users'],
  queryFn: () => unwrap(client.GET('/api/v1/admin/users')),
};

interface Draft {
  displayName: string;
  vendor: string;
  model: string;
  taskFilter: string;
  ownerId: string;
}

/** Name, tool, model and responsible person of an agent. */
function AgentForm({ agent, onDone }: { agent: Agent | null; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const me = useQuery(meQuery);
  const users = useQuery(usersQuery);
  const [draft, setDraft] = useState<Draft>({
    displayName: agent?.displayName ?? '',
    vendor: agent?.vendor ?? AGENT_VENDORS[0],
    model: agent?.model ?? '',
    taskFilter: agent?.taskFilter ?? '',
    ownerId: agent?.owner?.id ?? me.data?.id ?? '',
  });
  const save = useMutation({
    mutationFn: () => {
      const body = { ...draft, displayName: draft.displayName.trim(), vendor: draft.vendor.trim() };
      return agent
        ? unwrap(client.PATCH('/api/v1/agents/{id}', { params: { path: { id: agent.id } }, body }))
        : unwrap(client.POST('/api/v1/agents', { body }));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: agentsQuery.queryKey });
      await queryClient.invalidateQueries({ queryKey: usersQuery.queryKey });
      onDone();
    },
  });
  const people = (users.data ?? []).filter((user) => !user.agent && user.status === 'active');
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  return (
    <form
      className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {save.error && <FormError message={save.error.message} />}
      <TextField
        label={t('agents.name')}
        value={draft.displayName}
        placeholder={t('agents.namePlaceholder')}
        maxLength={120}
        onChange={(event) => set({ displayName: event.target.value })}
      />
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[200px] flex-1">
          <TextField
            label={t('agents.vendor')}
            list="agent-vendors"
            value={draft.vendor}
            maxLength={60}
            onChange={(event) => set({ vendor: event.target.value })}
          />
          <datalist id="agent-vendors">
            {AGENT_VENDORS.map((vendor) => (
              <option key={vendor} value={vendor} />
            ))}
          </datalist>
        </div>
        <div className="min-w-[200px] flex-1">
          <TextField
            label={t('agents.model')}
            value={draft.model}
            placeholder="claude-opus-5-5"
            maxLength={80}
            onChange={(event) => set({ model: event.target.value })}
          />
        </div>
      </div>
      <TextField
        label={t('agents.taskFilter')}
        help={t('agents.taskFilterHelp')}
        value={draft.taskFilter}
        placeholder="component = Frontend AND labels != security"
        maxLength={2000}
        onChange={(event) => set({ taskFilter: event.target.value })}
      />
      <Select
        label={t('agents.owner')}
        help={t('agents.ownerHelp')}
        value={draft.ownerId}
        onChange={(event) => set({ ownerId: event.target.value })}
        options={people.map((user) => ({ value: user.id, label: user.displayName }))}
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          disabled={!draft.displayName.trim() || !draft.vendor.trim() || save.isPending}
        >
          {t('common.save')}
        </Button>
        <Button type="button" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

/** Where the agent's notifications go, instead of polling (TL-95, E-147). */
export function AgentWebhookForm({ agent }: { agent: Agent }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState(agent.webhookUrl ?? '');
  const [secret, setSecret] = useState<string | null>(null);
  const done = () => queryClient.invalidateQueries({ queryKey: agentsQuery.queryKey });
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        client.PUT('/api/v1/agents/{id}/webhook', {
          params: { path: { id: agent.id } },
          body: { url: url.trim() },
        }),
      ),
    onSuccess: (hook) => {
      setSecret(hook.secret);
      void done();
    },
  });
  const remove = useMutation({
    mutationFn: () =>
      unwrap(client.DELETE('/api/v1/agents/{id}/webhook', { params: { path: { id: agent.id } } })),
    onSuccess: () => {
      setUrl('');
      setSecret(null);
      void done();
    },
  });
  return (
    <form
      className="flex max-w-[720px] flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {(save.error ?? remove.error) && (
        <FormError message={(save.error ?? remove.error)?.message ?? ''} />
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[260px] flex-1">
          <TextField
            label={t('agents.webhook')}
            help={t('agents.webhookHelp')}
            type="url"
            value={url}
            placeholder="https://runner.example.org/lenipo"
            onChange={(event) => setUrl(event.target.value)}
          />
        </div>
        <Button type="submit" size="sm" disabled={!url.trim() || save.isPending}>
          {t('common.save')}
        </Button>
        {agent.webhookUrl && (
          <Button
            type="button"
            size="sm"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            {t('agents.webhookRemove')}
          </Button>
        )}
      </div>
      {secret && (
        <p role="status" className="m-0 text-[13px]">
          {t('agents.webhookSecret')} <code className="break-all">{secret}</code>
        </p>
      )}
    </form>
  );
}

/** Accounts of AI agents with their tokens (TL-92, E-144). */
export function AgentsPage() {
  const { t } = useTranslation();
  const me = useQuery(meQuery);
  const agents = useQuery(agentsQuery);
  const [editing, setEditing] = useState<Agent | 'new' | null>(null);
  const [tokensOf, setTokensOf] = useState<string | null>(null);
  return (
    <main className="flex max-w-[880px] flex-col gap-4">
      <h1 className="m-0 text-[24px] leading-[30px] font-extrabold tracking-[-0.025em]">
        {t('agents.title')}
      </h1>
      <p className="m-0 max-w-[680px] text-[var(--ink-muted)]">{t('agents.intro')}</p>
      {agents.error && <FormError message={agents.error.message} />}
      {editing ? (
        <AgentForm
          key={editing === 'new' ? 'new' : editing.id}
          agent={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      ) : (
        <div>
          <Button variant="primary" onClick={() => setEditing('new')}>
            {t('agents.create')}
          </Button>
        </div>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {agents.data?.map((agent) => (
          <li key={agent.id} className="flex flex-col gap-3 border-b border-[var(--border)] py-3">
            <div className="flex flex-wrap items-center gap-3 text-[13px]">
              <Avatar user={agent} size={28} />
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{agent.displayName}</span>
                {agent.status === 'deactivated' && (
                  <span className="text-[var(--ink-muted)]"> · {t('agents.deactivated')}</span>
                )}
                <span className="block text-[var(--ink-muted)]">
                  {[agent.vendor, agent.model].filter(Boolean).join(' · ')}
                  {' · '}
                  {agent.owner
                    ? t('agents.ownedBy', { name: agent.owner.displayName })
                    : t('agents.noOwner')}
                </span>
              </span>
              <Button size="sm" onClick={() => setEditing(agent)}>
                {t('agents.edit')}
              </Button>
              <Button
                size="sm"
                aria-expanded={tokensOf === agent.id}
                disabled={agent.status !== 'active'}
                onClick={() => setTokensOf(tokensOf === agent.id ? null : agent.id)}
              >
                {t('agents.tokens')}
              </Button>
            </div>
            {tokensOf === agent.id && me.data && (
              <>
                <Tokens me={me.data} agentId={agent.id} />
                <AgentWebhookForm agent={agent} />
              </>
            )}
          </li>
        ))}
      </ul>
      {agents.data?.length === 0 && (
        <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('agents.empty')}</p>
      )}
    </main>
  );
}
