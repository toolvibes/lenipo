import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { PROJECT_ROLES, type ProjectRole } from '@tasklore/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, client, unwrap } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { AuthLayout } from './AuthLayout';

/** Accept an invitation or finish a registration: name and password, then signed in (E-119). */
export function InvitePage({ token }: { token: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const preview = useQuery({
    queryKey: ['invitation', token],
    retry: false,
    queryFn: () =>
      unwrap(client.GET('/api/v1/invitations/preview', { params: { query: { token } } as never })),
  });
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const accept = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/invitations/accept', {
          body: { token, displayName: name.trim(), password },
        }),
      ),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries();
      if (result.projectKey) {
        await navigate({ to: '/projects/$key', params: { key: result.projectKey } });
      } else {
        await navigate({ to: '/' });
      }
    },
  });

  if (preview.error) {
    const gone = preview.error instanceof ApiError && preview.error.status === 410;
    return (
      <AuthLayout title={t('invite.invalidTitle')}>
        <p className="m-0 text-[var(--ink-muted)]">
          {gone ? preview.error.message : t('invite.invalid')}
        </p>
        <Link to="/login" search={{}}>
          {t('invite.toLogin')}
        </Link>
      </AuthLayout>
    );
  }
  if (!preview.data) return null;
  const data = preview.data;

  function submit(event: FormEvent) {
    event.preventDefault();
    accept.mutate();
  }

  return (
    <AuthLayout
      title={
        data.registration
          ? t('invite.registerTitle', { instance: data.instanceName })
          : t('invite.title', { instance: data.instanceName })
      }
      subtitle={
        data.project
          ? t('invite.intoProject', { name: data.invitedBy ?? '', project: data.project.name })
          : data.invitedBy
            ? t('invite.by', { name: data.invitedBy })
            : undefined
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <TextField label={t('invite.email')} value={data.email} disabled />
        <TextField
          label={t('invite.name')}
          value={name}
          required
          maxLength={100}
          autoComplete="name"
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label={t('invite.password')}
          help={t('invite.passwordHelp')}
          type="password"
          value={password}
          required
          minLength={12}
          autoComplete="new-password"
          onChange={(event) => setPassword(event.target.value)}
        />
        {accept.error && <FormError message={accept.error.message} />}
        <Button type="submit" variant="primary" disabled={accept.isPending}>
          {t('invite.accept')}
        </Button>
      </form>
    </AuthLayout>
  );
}

/** Self-registration for listed domains: a confirmation link by e-mail. */
export function RegisterPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const register = useMutation({
    mutationFn: () =>
      unwrap(client.POST('/api/v1/auth/register', { body: { email: email.trim() } })),
  });
  return (
    <AuthLayout title={t('invite.registerHeading')} subtitle={t('invite.registerIntro')}>
      {register.isSuccess ? (
        <p className="m-0" role="status">
          {t('invite.checkMail', { email })}
        </p>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            register.mutate();
          }}
        >
          <TextField
            label={t('invite.email')}
            type="email"
            required
            value={email}
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
          />
          {register.error && <FormError message={register.error.message} />}
          <Button type="submit" variant="primary" disabled={register.isPending}>
            {t('invite.sendLink')}
          </Button>
        </form>
      )}
      <Link to="/login" search={{}}>
        {t('invite.toLogin')}
      </Link>
    </AuthLayout>
  );
}

/** Invite by e-mail and the list of invitations; for a project with a role, or instance-wide. */
export function InvitationsPanel({ projectKey }: { projectKey?: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ['invitations', projectKey ?? null];
  const list = useQuery({
    queryKey,
    queryFn: () =>
      projectKey
        ? unwrap(
            client.GET('/api/v1/projects/{key}/invitations', {
              params: { path: { key: projectKey } },
            }),
          )
        : unwrap(client.GET('/api/v1/admin/invitations')),
  });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProjectRole>('developers');
  const invite = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/invitations', {
          body: { email: email.trim(), ...(projectKey ? { projectKey, role } : {}) },
        }),
      ),
    onSuccess: () => {
      setEmail('');
      void queryClient.invalidateQueries({ queryKey });
      if (projectKey) void queryClient.invalidateQueries({ queryKey: ['project', projectKey] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) =>
      unwrap(client.DELETE('/api/v1/invitations/{id}', { params: { path: { id } } })),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
  const state = (entry: NonNullable<typeof list.data>[number]) =>
    entry.acceptedAt
      ? t('invite.states.accepted')
      : entry.revokedAt
        ? t('invite.states.revoked')
        : new Date(entry.expiresAt) < new Date()
          ? t('invite.states.expired')
          : t('invite.states.open', { when: formatRelative(entry.expiresAt) });
  return (
    <section className="flex max-w-[720px] flex-col gap-3">
      <h2 className="m-0 text-base font-semibold">{t('invite.panelTitle')}</h2>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          invite.mutate();
        }}
      >
        <div className="min-w-56 flex-1">
          <TextField
            label={t('invite.email')}
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        {projectKey && (
          <Select
            label={t('invite.role')}
            value={role}
            onChange={(event) => setRole(event.target.value as ProjectRole)}
            options={PROJECT_ROLES.map((value) => ({ value, label: t(`invite.roles.${value}`) }))}
          />
        )}
        <Button type="submit" variant="primary" disabled={invite.isPending}>
          {t('invite.send')}
        </Button>
      </form>
      {(invite.error || revoke.error) && (
        <FormError message={(invite.error ?? revoke.error)?.message ?? ''} />
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {(list.data ?? []).map((entry) => (
          <li
            key={entry.id}
            className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] py-2 text-[13px]"
          >
            <span className="flex-1">
              {entry.email}
              {entry.project && !projectKey && ` · ${entry.project.key}`}
              {entry.role && ` · ${t(`invite.roles.${entry.role}`)}`}
            </span>
            <span className="text-xs text-[var(--ink-muted)]">{state(entry)}</span>
            {!entry.acceptedAt && !entry.revokedAt && (
              <Button size="sm" variant="ghost" onClick={() => revoke.mutate(entry.id)}>
                {t('invite.revoke')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
