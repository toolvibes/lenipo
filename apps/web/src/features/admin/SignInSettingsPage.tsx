import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { securitySettingsQuery } from '../../lib/admin';
import { client, unwrap } from '../../lib/api';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';

/**
 * Sign-in rules (TL-18, E-100): how long sessions last, which groups must use two-factor
 * sign-in, and help for a single person after a lost phone or device.
 */
export function SignInSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const settings = useQuery(securitySettingsQuery);
  const groups = useQuery({
    queryKey: ['admin', 'groups'],
    queryFn: () => unwrap(client.GET('/api/v1/admin/groups')),
  });
  const users = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => unwrap(client.GET('/api/v1/admin/users')),
  });
  const [idle, setIdle] = useState('');
  const [max, setMax] = useState('');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    if (!settings.data) return;
    setIdle(String(settings.data.sessionIdleHours));
    setMax(String(settings.data.sessionMaxDays));
    setGroupIds(settings.data.twoFactorGroupIds);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () =>
      unwrap(
        client.PUT('/api/v1/admin/security-settings', {
          body: {
            sessionIdleHours: Number(idle),
            sessionMaxDays: Number(max),
            twoFactorGroupIds: groupIds,
          },
        }),
      ),
    onSuccess: (saved) => queryClient.setQueryData(securitySettingsQuery.queryKey, saved),
  });
  const userAction = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'sessions' | '2fa' }) => {
      if (action === 'sessions') {
        await unwrap(
          client.DELETE('/api/v1/admin/users/{id}/sessions', { params: { path: { id } } }),
        );
      } else {
        await unwrap(client.DELETE('/api/v1/admin/users/{id}/2fa', { params: { path: { id } } }));
      }
      return action;
    },
    onSuccess: (action) =>
      setDone(action === 'sessions' ? t('signIn.sessionsEnded') : t('signIn.twoFactorReset')),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  const needle = filter.trim().toLowerCase();
  const shown = (users.data ?? [])
    .filter(
      (user) =>
        !needle ||
        user.displayName.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle),
    )
    .slice(0, 20);

  return (
    <main className="flex max-w-[960px] flex-col gap-5 px-10 py-7">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-[22px] leading-7 font-semibold tracking-[-0.015em]">
          {t('signIn.title')}
        </h1>
      </header>
      <p className="m-0 max-w-[720px] text-[var(--ink-muted)]">{t('signIn.intro')}</p>
      {settings.error && <FormError message={settings.error.message} />}
      <form
        className="flex max-w-[560px] flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-4"
        onSubmit={submit}
      >
        {save.error && <FormError message={save.error.message} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label={t('signIn.idleHours')}
            type="number"
            min={1}
            max={720}
            required
            value={idle}
            onChange={(event) => {
              setIdle(event.target.value);
              save.reset();
            }}
          />
          <TextField
            label={t('signIn.maxDays')}
            type="number"
            min={1}
            max={365}
            required
            value={max}
            onChange={(event) => {
              setMax(event.target.value);
              save.reset();
            }}
          />
        </div>
        <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend className="tl-label pb-1.5 text-[var(--ink-muted)]">
            {t('signIn.twoFactorGroups')}
          </legend>
          {(groups.data ?? []).map((group) => (
            <label key={group.id} className="flex items-center gap-2 text-[13.5px]">
              <input
                type="checkbox"
                checked={groupIds.includes(group.id)}
                onChange={(event) => {
                  save.reset();
                  setGroupIds((current) =>
                    event.target.checked
                      ? [...current, group.id]
                      : current.filter((id) => id !== group.id),
                  );
                }}
              />
              {group.name}
              <span className="text-xs text-[var(--ink-muted)]">
                {t('signIn.members', { count: group.memberCount })}
              </span>
            </label>
          ))}
          <span className="text-xs text-[var(--ink-muted)]">{t('signIn.twoFactorHint')}</span>
        </fieldset>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {t('common.save')}
          </Button>
          {save.isSuccess && (
            <span role="status" className="text-[13px] text-[var(--ink-muted)]">
              {t('signIn.saved')}
            </span>
          )}
        </div>
      </form>

      <section className="flex max-w-[720px] flex-col gap-3">
        <h2 className="m-0 text-base font-semibold">{t('signIn.people')}</h2>
        <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('signIn.peopleIntro')}</p>
        {userAction.error && <FormError message={userAction.error.message} />}
        {done && <p className="m-0 text-[13px] text-[var(--ink-muted)]">{done}</p>}
        <TextField
          label={t('signIn.search')}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <ul className="m-0 flex list-none flex-col p-0">
          {shown.map((user) => (
            <li
              key={user.id}
              className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] py-2 text-[13px]"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">{user.displayName}</span>
                <span className="text-xs text-[var(--ink-muted)]">{user.email}</span>
              </span>
              <Button
                size="sm"
                disabled={userAction.isPending}
                onClick={() => {
                  if (window.confirm(t('signIn.endSessionsConfirm', { name: user.displayName }))) {
                    setDone(null);
                    userAction.mutate({ id: user.id, action: 'sessions' });
                  }
                }}
              >
                {t('signIn.endSessions')}
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={userAction.isPending}
                onClick={() => {
                  if (window.confirm(t('signIn.resetConfirm', { name: user.displayName }))) {
                    setDone(null);
                    userAction.mutate({ id: user.id, action: '2fa' });
                  }
                }}
              >
                {t('signIn.reset')}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
