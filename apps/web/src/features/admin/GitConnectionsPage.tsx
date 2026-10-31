import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type CreatedGitConnection, GIT_PROVIDERS, type GitProvider } from '@tasklore/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { CopyButton } from '../personal/ProfilePage';

/** Git hosting connected by webhook (TL-36, E-116). */
export function GitConnectionsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const connections = useQuery({
    queryKey: ['admin', 'git-connections'],
    queryFn: () => unwrap(client.GET('/api/v1/admin/git-connections')),
  });
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<GitProvider>('github');
  const [created, setCreated] = useState<CreatedGitConnection | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'git-connections'] });
  const create = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/admin/git-connections', { body: { name: name.trim(), provider } }),
      ),
    onSuccess: (connection) => {
      setCreated(connection);
      setName('');
      void refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      unwrap(client.DELETE('/api/v1/admin/git-connections/{id}', { params: { path: { id } } })),
    onSettled: () => refresh(),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) create.mutate();
  }

  return (
    <div className="flex max-w-[760px] flex-col gap-5">
      <h1 className="m-0 text-xl font-semibold">{t('git.title')}</h1>
      <p className="m-0 text-[var(--ink-muted)]">{t('git.intro')}</p>
      {created && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--success-soft)] p-4 text-[13px]"
        >
          <strong>{t('git.created', { name: created.name })}</strong>
          <span>{t('git.secretOnce')}</span>
          <span className="tl-label text-[var(--ink-muted)]">{t('git.webhookUrl')}</span>
          <span className="flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all">{created.webhookUrl}</code>
            <CopyButton text={created.webhookUrl} />
          </span>
          <span className="tl-label text-[var(--ink-muted)]">{t('git.secret')}</span>
          <span className="flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all">{created.secret}</code>
            <CopyButton text={created.secret} />
          </span>
          <p className="m-0">{t(`git.setup.${created.provider}`)}</p>
          <div>
            <Button size="sm" onClick={() => setCreated(null)}>
              {t('profile.tokenDone')}
            </Button>
          </div>
        </div>
      )}
      <form onSubmit={submit} className="grid items-end gap-3 sm:grid-cols-[1fr_200px_auto]">
        <TextField
          label={t('git.name')}
          value={name}
          maxLength={100}
          placeholder="GitHub acme"
          onChange={(event) => setName(event.target.value)}
        />
        <Select
          label={t('git.provider')}
          value={provider}
          onChange={(event) => setProvider(event.target.value as GitProvider)}
          options={GIT_PROVIDERS.map((value) => ({ value, label: t(`git.providers.${value}`) }))}
        />
        <Button type="submit" variant="primary" disabled={!name.trim() || create.isPending}>
          {t('git.add')}
        </Button>
      </form>
      {(create.error || remove.error) && (
        <FormError message={(create.error ?? remove.error)?.message ?? ''} />
      )}
      {connections.data?.length === 0 && (
        <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('git.none')}</p>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {(connections.data ?? []).map((connection) => (
          <li
            key={connection.id}
            className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] py-2.5 text-[13px]"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">
                {connection.name} · {t(`git.providers.${connection.provider}`)}
              </span>
              <code className="text-xs break-all text-[var(--ink-muted)]">
                {connection.webhookUrl}
              </code>
              <span
                className={`text-xs ${connection.lastError ? 'text-[var(--danger)]' : 'text-[var(--ink-muted)]'}`}
              >
                {connection.lastError ??
                  (connection.lastEventAt
                    ? t('git.lastEvent', { when: formatRelative(connection.lastEventAt) })
                    : t('git.never'))}
              </span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => remove.mutate(connection.id)}>
              {t('git.remove')}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
