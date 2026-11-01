import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { Me } from '@toolvibes/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { renderSVG } from 'uqr';
import { client, unwrap } from '../../lib/api';
import { meQuery } from '../../lib/queries';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';
import { AuthLayout } from './AuthLayout';

/**
 * Setting up two-factor sign-in (TL-18, E-100): a QR code and the secret for the app, a first
 * code to confirm, then the recovery codes, shown once.
 */
export function TwoFactorSetupFlow({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const setup = useMutation({
    mutationFn: () => unwrap(client.POST('/api/v1/me/2fa/setup')),
  });
  const enable = useMutation({
    mutationFn: () => unwrap(client.POST('/api/v1/me/2fa/enable', { body: { code } })),
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: one secret per visit
  useEffect(() => {
    setup.mutate();
  }, []);
  if (enable.data) return <RecoveryCodeList codes={enable.data.codes} onDone={onDone} />;
  function submit(event: FormEvent) {
    event.preventDefault();
    enable.mutate();
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {(setup.error ?? enable.error) && (
        <FormError message={(setup.error ?? enable.error)?.message ?? ''} />
      )}
      <p className="m-0 text-[13.5px]">{t('twoFactor.scan')}</p>
      {setup.data && (
        <div className="flex flex-wrap items-center gap-4">
          <div
            role="img"
            aria-label={t('twoFactor.qr')}
            className="size-40 rounded-[var(--radius-md)] bg-white p-2"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: an SVG we generate from our own URI
            dangerouslySetInnerHTML={{ __html: renderSVG(setup.data.uri) }}
          />
          <div className="flex min-w-0 flex-col gap-1 text-[12.5px]">
            <span className="text-[var(--ink-muted)]">{t('twoFactor.manual')}</span>
            <code className="tl-key break-all">{setup.data.secret}</code>
          </div>
        </div>
      )}
      <TextField
        label={t('twoFactor.code')}
        value={code}
        inputMode="numeric"
        autoComplete="one-time-code"
        onChange={(event) => setCode(event.target.value)}
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          disabled={code.trim().length < 6 || enable.isPending || !setup.data}
        >
          {t('twoFactor.enable')}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}

export function RecoveryCodeList({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[13.5px]">{t('twoFactor.recoveryIntro')}</p>
      <ol className="m-0 grid grid-cols-2 gap-x-6 gap-y-1 rounded-[var(--radius-md)] bg-[var(--surface-2)] p-3 pl-8 font-mono text-[13px]">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ol>
      <div className="flex gap-2">
        <Button onClick={() => void navigator.clipboard.writeText(codes.join('\n'))}>
          {t('twoFactor.copy')}
        </Button>
        <Button variant="primary" onClick={onDone}>
          {t('twoFactor.saved')}
        </Button>
      </div>
    </div>
  );
}

/** After the password: the code from the app, or setting it up where a group demands it. */
export function TwoFactorPage({ me, redirect }: { me: Me; redirect?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const verify = useMutation({
    mutationFn: () => unwrap(client.POST('/api/v1/auth/2fa', { body: { code } })),
    onSuccess: async (next) => {
      queryClient.setQueryData(meQuery.queryKey, next);
      await navigate({ to: redirect ?? '/' });
    },
  });
  const logout = useMutation({
    mutationFn: () => unwrap(client.POST('/api/v1/auth/logout')),
    onSuccess: async () => {
      queryClient.setQueryData(meQuery.queryKey, null);
      await navigate({ to: '/login' });
    },
  });
  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
    await navigate({ to: redirect ?? '/' });
  };
  return (
    <AuthLayout
      title={me.twoFactor.pending === 'setup' ? t('twoFactor.setupTitle') : t('twoFactor.title')}
      subtitle={me.twoFactor.pending === 'setup' ? t('twoFactor.required') : t('twoFactor.enter')}
    >
      <div className="flex flex-col gap-4">
        {me.twoFactor.pending === 'setup' ? (
          <TwoFactorSetupFlow onDone={() => void done()} />
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              verify.mutate();
            }}
            className="flex flex-col gap-4"
          >
            {verify.error && <FormError message={t('twoFactor.invalid')} />}
            <TextField
              label={t('twoFactor.code')}
              value={code}
              autoFocus
              autoComplete="one-time-code"
              onChange={(event) => setCode(event.target.value)}
            />
            <Button
              type="submit"
              variant="primary"
              disabled={code.trim().length < 6 || verify.isPending}
            >
              {t('twoFactor.verify')}
            </Button>
          </form>
        )}
        <Button variant="ghost" onClick={() => logout.mutate()}>
          {t('twoFactor.cancel')}
        </Button>
      </div>
    </AuthLayout>
  );
}
