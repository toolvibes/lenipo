import { useMutation, useQuery } from '@tanstack/react-query';
import type { TokenScope } from '@tasklore/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { AuthLayout } from './AuthLayout';

const SCOPE_KEYS = {
  'issues:read': 'issuesRead',
  'issues:write': 'issuesWrite',
  'wiki:read': 'wikiRead',
  'wiki:write': 'wikiWrite',
} as const;

export interface AuthorizeParams {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  scope?: string;
  resource?: string;
}

/**
 * The authorization page of the OAuth server for MCP clients (TL-69, E-115): shows who asks,
 * where the access goes and which scopes, and sends the browser back with a code or a refusal.
 * Broken requests are never redirected anywhere.
 */
export function OAuthConsentPage({ params }: { params: AuthorizeParams }) {
  const { t } = useTranslation();
  const complete =
    params.response_type === 'code' &&
    !!params.client_id &&
    !!params.redirect_uri &&
    !!params.code_challenge &&
    params.code_challenge_method === 'S256';
  const info = useQuery({
    queryKey: ['oauth-client', params.client_id, params.redirect_uri, params.scope],
    enabled: complete,
    retry: false,
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/oauth/client', {
          params: {
            query: {
              client_id: params.client_id ?? '',
              redirect_uri: params.redirect_uri ?? '',
              ...(params.scope ? { scope: params.scope } : {}),
            },
          },
        }),
      ),
  });
  const [scopes, setScopes] = useState<TokenScope[]>([]);
  useEffect(() => {
    if (info.data) setScopes(info.data.requestedScopes);
  }, [info.data]);

  const decide = useMutation({
    mutationFn: (approve: boolean) =>
      unwrap(
        client.POST('/api/v1/oauth/consent', {
          body: {
            clientId: params.client_id ?? '',
            redirectUri: params.redirect_uri ?? '',
            scopes: approve ? scopes : [],
            approve,
            codeChallenge: params.code_challenge ?? '',
            codeChallengeMethod: 'S256',
            ...(params.state !== undefined ? { state: params.state } : {}),
            ...(params.resource ? { resource: params.resource } : {}),
          },
        }),
      ),
    onSuccess: (result) => window.location.assign(result.redirect),
  });

  if (!complete || info.error) {
    return (
      <AuthLayout title={t('oauth.invalidTitle')}>
        <p className="m-0 text-[var(--ink-muted)]">
          {complete ? t('oauth.unknownClient') : t('oauth.invalidRequest')}
        </p>
      </AuthLayout>
    );
  }
  if (!info.data) return null;
  const toggle = (scope: TokenScope, on: boolean) =>
    setScopes((current) => (on ? [...current, scope] : current.filter((entry) => entry !== scope)));

  return (
    <AuthLayout
      title={t('oauth.title', { name: info.data.name })}
      subtitle={t('oauth.subtitle', { host: info.data.redirectHost })}
    >
      <div className="flex flex-col gap-4">
        {decide.error && <FormError message={decide.error.message} />}
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="tl-label mb-1 text-[var(--ink-muted)]">{t('oauth.scopes')}</legend>
          {(Object.keys(SCOPE_KEYS) as Array<keyof typeof SCOPE_KEYS>).map((scope) => (
            <label key={scope} className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={scopes.includes(scope)}
                onChange={(event) => toggle(scope, event.target.checked)}
              />
              <span>{t(`oauth.scopeNames.${SCOPE_KEYS[scope]}`)}</span>
            </label>
          ))}
        </fieldset>
        <p className="m-0 text-xs text-[var(--ink-muted)]">{t('oauth.hint')}</p>
        <div className="flex gap-2">
          <Button
            variant="primary"
            disabled={scopes.length === 0 || decide.isPending}
            onClick={() => decide.mutate(true)}
          >
            {t('oauth.allow')}
          </Button>
          <Button variant="ghost" disabled={decide.isPending} onClick={() => decide.mutate(false)}>
            {t('oauth.deny')}
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
