import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { authProvidersQuery, meQuery } from '../../lib/queries';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';
import { AuthLayout } from './AuthLayout';

export type LoginError = 'oidc' | 'oidc_denied';

export function LoginPage({ redirect, error }: { redirect?: string; error?: LoginError }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const providers = useQuery(authProvidersQuery);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: () => unwrap(client.POST('/api/v1/auth/login', { body: { email, password } })),
    onSuccess: async (me) => {
      queryClient.setQueryData(meQuery.queryKey, me);
      await navigate({ to: redirect ?? '/' });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    login.mutate();
  }

  return (
    <AuthLayout title={t('auth.signInTitle')}>
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        {login.isError && <FormError message={t('auth.invalidCredentials')} />}
        {!login.isError && error && (
          <FormError
            message={error === 'oidc_denied' ? t('auth.oidcDenied') : t('auth.oidcFailed')}
          />
        )}
        <TextField
          label={t('auth.email')}
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" variant="primary" disabled={login.isPending}>
          {login.isPending ? t('auth.signingIn') : t('auth.signIn')}
        </Button>
      </form>
      {providers.data?.oidc.enabled && (
        <>
          <div className="flex items-center gap-3 text-xs text-[var(--ink-muted)]">
            <span className="h-px flex-1 bg-[var(--border)]" />
            {t('auth.or')}
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>
          {/* A full-page navigation: the identity provider redirects back to the API. */}
          <a
            href={`/api/v1/auth/oidc/start?redirect=${encodeURIComponent(redirect ?? '/')}`}
            className="inline-flex h-[var(--control-md)] items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 font-semibold text-[var(--ink)] no-underline hover:bg-[var(--surface-2)]"
          >
            {t('auth.signInWith', { provider: providers.data.oidc.displayName ?? 'SSO' })}
          </a>
        </>
      )}
    </AuthLayout>
  );
}
