import { Check, Copy } from '@phosphor-icons/react';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  type Agent,
  type CreatedToken,
  type Me,
  TOKEN_SCOPES,
  type TokenScope,
  type UpdateMeRequest,
} from '@toolvibes/shared';
import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { applyLocale } from '../../i18n';
import { client, unwrap } from '../../lib/api';
import { formatDate, formatRelative } from '../../lib/format';
import { agentsQuery, meQuery } from '../../lib/queries';
import { applyTheme, readTheme, type ThemePreference } from '../../lib/theme';
import { timeZones } from '../../lib/timeZones';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { TopBar } from '../../ui/TopBar';
import { RecoveryCodeList, TwoFactorSetupFlow } from '../auth/TwoFactorPage';
import { Settings as EmailSettings } from '../notifications/NotificationBell';

const sessionsQuery = queryOptions({
  queryKey: ['me', 'sessions'],
  queryFn: () => unwrap(client.GET('/api/v1/me/sessions')),
});

const EXPIRY_DAYS = [30, 90, 180, 366];
const SCOPE_KEYS = {
  'issues:read': 'issues_read',
  'issues:write': 'issues_write',
  'wiki:read': 'wiki_read',
  'wiki:write': 'wiki_write',
  admin: 'admin',
} as const satisfies Record<TokenScope, string>;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-6 flex-col gap-4 border-t border-[var(--border)] pt-6"
    >
      <h2 id={`${id}-title`} className="m-0 text-base font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function useSaveMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateMeRequest) => unwrap(client.PATCH('/api/v1/me', { body })),
    onSuccess: (me) => queryClient.setQueryData(meQuery.queryKey, me),
  });
}

function ProfileForm({ me }: { me: Me }) {
  const { t } = useTranslation();
  const save = useSaveMe();
  const [displayName, setDisplayName] = useState(me.displayName);
  const [locale, setLocale] = useState(me.locale === 'en' ? 'en' : 'de');
  const [timeZone, setTimeZone] = useState(me.timeZone);
  const zones = useMemo(() => timeZones(timeZone), [timeZone]);
  const changed =
    displayName.trim() !== me.displayName || locale !== me.locale || timeZone !== me.timeZone;

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate(
      { displayName: displayName.trim(), locale: locale as 'de' | 'en', timeZone },
      { onSuccess: (saved) => applyLocale(saved.locale) },
    );
  }

  return (
    <form onSubmit={submit} className="flex max-w-[480px] flex-col gap-4">
      {save.error && <FormError message={save.error.message} />}
      <TextField
        label={t('welcome.displayName')}
        value={displayName}
        required
        maxLength={100}
        onChange={(event) => setDisplayName(event.target.value)}
      />
      <TextField
        label={t('profile.email')}
        value={me.email}
        readOnly
        className="bg-[var(--surface-2)] text-[var(--ink-muted)]"
        help={t('profile.emailHelp')}
      />
      <Select
        label={t('welcome.language')}
        value={locale}
        onChange={(event) => setLocale(event.target.value === 'en' ? 'en' : 'de')}
        options={[
          { value: 'de', label: t('welcome.languages.de') },
          { value: 'en', label: t('welcome.languages.en') },
        ]}
      />
      <Select
        label={t('welcome.timeZone')}
        value={timeZone}
        onChange={(event) => setTimeZone(event.target.value)}
        options={zones.map((zone) => ({ value: zone, label: zone.replaceAll('_', ' ') }))}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={!changed || save.isPending}>
          {t('common.save')}
        </Button>
        {save.isSuccess && !changed && (
          <span className="flex items-center gap-1 text-[13px] text-[var(--ink-muted)]">
            <Check size={14} aria-hidden />
            {t('profile.saved')}
          </span>
        )}
      </div>
    </form>
  );
}

function PasswordForm() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const change = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/me/password', {
          body: { currentPassword: current, newPassword: next },
        }),
      ),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      setRepeat('');
      void queryClient.invalidateQueries({ queryKey: sessionsQuery.queryKey });
    },
  });
  const mismatch = repeat.length > 0 && repeat !== next;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        change.mutate();
      }}
      className="flex max-w-[480px] flex-col gap-4"
    >
      {change.error && <FormError message={change.error.message} />}
      {change.isSuccess && (
        <p role="status" className="m-0 flex items-center gap-1.5 text-[13px]">
          <Check size={14} aria-hidden />
          {t('profile.passwordChanged', { count: change.data.endedSessions })}
        </p>
      )}
      <TextField
        label={t('profile.currentPassword')}
        type="password"
        autoComplete="current-password"
        value={current}
        required
        onChange={(event) => setCurrent(event.target.value)}
      />
      <TextField
        label={t('profile.newPassword')}
        type="password"
        autoComplete="new-password"
        value={next}
        required
        minLength={12}
        help={t('profile.passwordHelp')}
        onChange={(event) => setNext(event.target.value)}
      />
      <TextField
        label={t('profile.repeatPassword')}
        type="password"
        autoComplete="new-password"
        value={repeat}
        required
        error={mismatch ? t('profile.passwordMismatch') : undefined}
        onChange={(event) => setRepeat(event.target.value)}
      />
      <div>
        <Button
          type="submit"
          variant="primary"
          disabled={!current || next.length < 12 || next !== repeat || change.isPending}
        >
          {t('profile.changePassword')}
        </Button>
      </div>
    </form>
  );
}

function Appearance({ me }: { me: Me }) {
  const { t } = useTranslation();
  const save = useSaveMe();
  const [theme, setTheme] = useState<ThemePreference>(readTheme);
  return (
    <div className="flex flex-col gap-5">
      <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
        <legend className="tl-field-label mb-1.5 p-0">{t('profile.theme')}</legend>
        {(['system', 'light', 'dark'] as const).map((value) => (
          <label key={value} className="flex items-center gap-2">
            <input
              type="radio"
              name="theme"
              checked={theme === value}
              onChange={() => {
                setTheme(value);
                applyTheme(value);
              }}
            />
            {t(`profile.themes.${value}`)}
          </label>
        ))}
        <span className="text-xs text-[var(--ink-muted)]">{t('profile.themeHelp')}</span>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        {save.error && <FormError message={save.error.message} />}
        <label className="flex items-center gap-2 font-semibold">
          <input
            type="checkbox"
            checked={me.keyboardShortcuts}
            disabled={save.isPending}
            onChange={(event) => save.mutate({ keyboardShortcuts: event.target.checked })}
          />
          {t('profile.shortcuts')}
        </label>
        <span className="pl-6 text-xs text-[var(--ink-muted)]">{t('profile.shortcutsHelp')}</span>
      </div>
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      onClick={() =>
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
      }
    >
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      {copied ? t('profile.copied') : t('profile.copy')}
    </Button>
  );
}

/** Personal access tokens, or with `agentId` those of an agent one answers for (TL-92). */
export function Tokens({ me, agentId }: { me: Me; agentId?: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = agentId ? ['agents', agentId, 'tokens'] : ['me', 'tokens'];
  const tokens = useQuery({
    queryKey,
    queryFn: () =>
      agentId
        ? unwrap(client.GET('/api/v1/agents/{id}/tokens', { params: { path: { id: agentId } } }))
        : unwrap(client.GET('/api/v1/me/tokens')),
  });
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<TokenScope[]>(
    agentId ? ['issues:read', 'issues:write'] : ['issues:read', 'wiki:read'],
  );
  const [days, setDays] = useState(90);
  const [created, setCreated] = useState<CreatedToken | null>(null);
  // Agent tokens never administer (E-144).
  const available = TOKEN_SCOPES.filter(
    (scope) => scope !== 'admin' || (!agentId && me.globalPermissions.includes('admin')),
  );
  const create = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), scopes, expiresInDays: days };
      return agentId
        ? unwrap(
            client.POST('/api/v1/agents/{id}/tokens', {
              params: { path: { id: agentId } },
              body,
            }),
          )
        : unwrap(client.POST('/api/v1/me/tokens', { body }));
    },
    onSuccess: (token) => {
      setCreated(token);
      setName('');
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) =>
      agentId
        ? unwrap(
            client.DELETE('/api/v1/agents/{id}/tokens/{tokenId}', {
              params: { path: { id: agentId, tokenId: id } },
            }),
          )
        : unwrap(client.DELETE('/api/v1/me/tokens/{id}', { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const mcpCommand = created
    ? `claude mcp add --transport http lenipo ${window.location.origin}/mcp --header "Authorization: Bearer ${created.secret}"`
    : '';

  return (
    <div className="flex flex-col gap-5">
      {!agentId && (
        <p className="m-0 max-w-[640px] text-[var(--ink-muted)]">{t('profile.tokensIntro')}</p>
      )}
      {created && (
        <div
          role="status"
          className="flex max-w-[720px] flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--success-soft)] p-4"
        >
          <strong>{t('profile.tokenCreated', { name: created.name })}</strong>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all">{created.secret}</code>
            <CopyButton text={created.secret} />
          </div>
          <span className="text-[13px]">{t('profile.mcpHint')}</span>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 text-xs break-all">{mcpCommand}</code>
            <CopyButton text={mcpCommand} />
          </div>
          <div>
            <Button size="sm" onClick={() => setCreated(null)}>
              {t('profile.tokenDone')}
            </Button>
          </div>
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
        className="flex max-w-[720px] flex-col gap-3"
      >
        {create.error && <FormError message={create.error.message} />}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <TextField
              label={t('profile.tokenName')}
              placeholder={t('profile.tokenNamePlaceholder')}
              value={name}
              required
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Select
            label={t('profile.tokenExpiry')}
            value={String(days)}
            onChange={(event) => setDays(Number(event.target.value))}
            options={EXPIRY_DAYS.map((value) => ({
              value: String(value),
              label: t('profile.days', { count: value }),
            }))}
          />
        </div>
        <fieldset className="m-0 flex flex-wrap gap-x-5 gap-y-1.5 border-0 p-0">
          <legend className="tl-field-label mb-1.5 p-0">{t('profile.tokenScopes')}</legend>
          {available.map((scope) => (
            <label key={scope} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={scopes.includes(scope)}
                onChange={(event) =>
                  setScopes((current) =>
                    event.target.checked
                      ? [...current, scope]
                      : current.filter((entry) => entry !== scope),
                  )
                }
              />
              <span>
                <code>{scope}</code> · {t(`profile.scopes.${SCOPE_KEYS[scope]}`)}
              </span>
            </label>
          ))}
        </fieldset>
        <div>
          <Button
            type="submit"
            variant="primary"
            disabled={!name.trim() || scopes.length === 0 || create.isPending}
          >
            {t('profile.createToken')}
          </Button>
        </div>
      </form>
      {tokens.data && tokens.data.length > 0 && (
        <table className="w-full max-w-[880px] border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[var(--ink-muted)]">
              <th className="tl-label py-1.5 pr-3 font-semibold">{t('profile.tokenName')}</th>
              <th className="tl-label py-1.5 pr-3 font-semibold">{t('profile.tokenScopes')}</th>
              <th className="tl-label py-1.5 pr-3 font-semibold">{t('profile.lastUsed')}</th>
              <th className="tl-label py-1.5 pr-3 font-semibold">{t('profile.expires')}</th>
              <th className="py-1.5" />
            </tr>
          </thead>
          <tbody>
            {tokens.data.map((token) => (
              <tr key={token.id} className="border-t border-[var(--border)] align-top">
                <td className="py-2 pr-3">
                  <span className="font-semibold">{token.name}</span>
                  <span className="block text-xs text-[var(--ink-muted)]">
                    <code>{token.prefix}…</code>
                  </span>
                </td>
                <td className="py-2 pr-3">{token.scopes.join(', ')}</td>
                <td className="py-2 pr-3">
                  {token.lastUsedAt ? formatRelative(token.lastUsedAt) : t('profile.never')}
                </td>
                <td className="py-2 pr-3">{formatDate(token.expiresAt.slice(0, 10))}</td>
                <td className="py-2 text-right">
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={revoke.isPending}
                    onClick={() => {
                      if (window.confirm(t('profile.revokeConfirm', { name: token.name })))
                        revoke.mutate(token.id);
                    }}
                  >
                    {t('profile.revoke')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** A short "Browser on system" from the user agent, enough to recognise a session. */
function deviceOf(userAgent: string | null, unknown: string): string {
  if (!userAgent) return unknown;
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Firefox\//.test(userAgent)
      ? 'Firefox'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : null;
  const system = /Mac OS X/.test(userAgent)
    ? 'macOS'
    : /Windows/.test(userAgent)
      ? 'Windows'
      : /Android/.test(userAgent)
        ? 'Android'
        : /iPhone|iPad/.test(userAgent)
          ? 'iOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null;
  return [browser, system].filter(Boolean).join(' · ') || unknown;
}

/** MCP clients signed in with OAuth (TL-69, E-115), each can be disconnected. */
function ConnectedApps() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const grants = useQuery({
    queryKey: ['oauth-grants'],
    queryFn: () => unwrap(client.GET('/api/v1/me/oauth-grants')),
  });
  const end = useMutation({
    mutationFn: (id: string) =>
      unwrap(client.DELETE('/api/v1/me/oauth-grants/{id}', { params: { path: { id } } })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['oauth-grants'] }),
  });
  const command = `claude mcp add --transport http lenipo ${window.location.origin}/mcp`;
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 max-w-[640px] text-[var(--ink-muted)]">{t('oauth.connectedIntro')}</p>
      <div className="flex max-w-[720px] flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 text-xs break-all">{command}</code>
        <CopyButton text={command} />
      </div>
      {end.error && <FormError message={end.error.message} />}
      {grants.data?.length === 0 && (
        <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('oauth.noneConnected')}</p>
      )}
      <ul className="m-0 flex max-w-[720px] list-none flex-col p-0">
        {(grants.data ?? []).map((grant) => (
          <li
            key={grant.id}
            className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] py-2.5 text-[13px]"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">{grant.client.name}</span>
              <span className="text-xs text-[var(--ink-muted)]">
                {grant.scopes.join(', ')} ·{' '}
                {grant.lastUsedAt
                  ? t('oauth.lastUsed', { when: formatRelative(grant.lastUsedAt) })
                  : t('oauth.connectedAt', { when: formatRelative(grant.createdAt) })}
              </span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => end.mutate(grant.id)}>
              {t('oauth.disconnect')}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sessions() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const sessions = useQuery(sessionsQuery);
  const revoke = useMutation({
    mutationFn: async (ids: string[] | 'others') => {
      if (ids === 'others') return unwrap(client.DELETE('/api/v1/me/sessions'));
      for (const id of ids) {
        await unwrap(client.DELETE('/api/v1/me/sessions/{id}', { params: { path: { id } } }));
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: sessionsQuery.queryKey }),
  });
  const others = (sessions.data ?? []).filter((session) => !session.current);
  return (
    <div className="flex flex-col gap-3">
      {revoke.error && <FormError message={revoke.error.message} />}
      <ul className="m-0 flex max-w-[720px] list-none flex-col p-0">
        {(sessions.data ?? []).map((session) => (
          <li
            key={session.id}
            className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] py-2.5 text-[13px]"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">
                {deviceOf(session.userAgent, t('profile.unknownDevice'))}
                {session.current && (
                  <span className="ml-2 rounded-[var(--radius-sm)] bg-[var(--accent-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
                    {t('profile.thisSession')}
                  </span>
                )}
              </span>
              <span className="text-xs text-[var(--ink-muted)]">
                {t('profile.sessionSeen', {
                  when: formatRelative(session.lastSeenAt),
                  ip: session.ip ?? '–',
                })}
              </span>
            </span>
            {!session.current && (
              <Button
                size="sm"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate([session.id])}
              >
                {t('common.signOut')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {others.length > 0 && (
        <div>
          <Button
            variant="danger"
            disabled={revoke.isPending}
            onClick={() => revoke.mutate('others')}
          >
            {t('profile.signOutOthers', { count: others.length })}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Two-factor sign-in with an authenticator app and recovery codes (TL-18, E-100). */
function TwoFactor({ me }: { me: Me }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'idle' | 'setup' | 'disable' | 'regenerate'>('idle');
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: meQuery.queryKey });
  const act = useMutation({
    mutationFn: async () => {
      if (mode === 'disable') {
        await unwrap(client.POST('/api/v1/me/2fa/disable', { body: { code } }));
        return null;
      }
      return unwrap(client.POST('/api/v1/me/2fa/recovery-codes', { body: { code } }));
    },
    onSuccess: async (result) => {
      setMode('idle');
      setCode('');
      setCodes(result?.codes ?? null);
      await refresh();
    },
  });
  const status = me.twoFactor;
  if (codes) return <RecoveryCodeList codes={codes} onDone={() => setCodes(null)} />;
  if (mode === 'setup') {
    return (
      <div className="max-w-[560px]">
        <TwoFactorSetupFlow
          onDone={() => {
            setMode('idle');
            void refresh();
          }}
          onCancel={() => setMode('idle')}
        />
      </div>
    );
  }
  return (
    <div className="flex max-w-[560px] flex-col gap-3">
      <p className="m-0 text-[13.5px]">
        {status.enabled
          ? t('twoFactor.on', { count: status.recoveryCodesLeft })
          : t('twoFactor.off')}
      </p>
      {status.required && (
        <p className="m-0 text-xs text-[var(--ink-muted)]">{t('twoFactor.requiredHint')}</p>
      )}
      {mode === 'idle' ? (
        <div className="flex flex-wrap gap-2">
          {status.enabled ? (
            <>
              <Button onClick={() => setMode('regenerate')}>{t('twoFactor.regenerate')}</Button>
              {!status.required && (
                <Button variant="danger" onClick={() => setMode('disable')}>
                  {t('twoFactor.disable')}
                </Button>
              )}
            </>
          ) : (
            <Button variant="primary" onClick={() => setMode('setup')}>
              {t('twoFactor.setUp')}
            </Button>
          )}
        </div>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            act.mutate();
          }}
        >
          {act.error && <FormError message={act.error.message} />}
          <TextField
            label={t('twoFactor.confirmCode')}
            value={code}
            autoFocus
            autoComplete="one-time-code"
            onChange={(event) => setCode(event.target.value)}
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              variant={mode === 'disable' ? 'danger' : 'primary'}
              disabled={code.trim().length < 6 || act.isPending}
            >
              {mode === 'disable' ? t('twoFactor.disable') : t('twoFactor.regenerate')}
            </Button>
            <Button variant="ghost" onClick={() => setMode('idle')}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Tokens for the agents the person answers for (TL-92, E-144). */
function MyAgents({ me, agents }: { me: Me; agents: Agent[] }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <p className="m-0 max-w-[640px] text-[var(--ink-muted)]">{t('agents.mineIntro')}</p>
      {agents.map((agent) => (
        <div key={agent.id} className="flex flex-col gap-3">
          <h3 className="m-0 text-[14px] font-semibold">
            {agent.displayName}
            <span className="font-normal text-[var(--ink-muted)]">
              {' '}
              · {[agent.vendor, agent.model].filter(Boolean).join(' · ')}
            </span>
          </h3>
          <Tokens me={me} agentId={agent.id} />
        </div>
      ))}
    </div>
  );
}

/** Opens the person's private space, created on first use (TL-29, E-110). */
function PersonalSpaceButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const open = useMutation({
    mutationFn: () => unwrap(client.POST('/api/v1/me/space')),
    onSuccess: (space) => navigate({ to: '/spaces/$key', params: { key: space.key } }),
  });
  return (
    <div>
      <Button size="sm" disabled={open.isPending} onClick={() => open.mutate()}>
        {t('spaceTypes.openPersonal')}
      </Button>
    </div>
  );
}

/**
 * The person's own page (TL-4, E-78): profile, password (TL-59, E-80), appearance with the
 * shortcut switch (TL-7),
 * e-mail notifications, personal access tokens for agents and the API, and sessions.
 */
export function ProfilePage() {
  const { t } = useTranslation();
  const me = useQuery(meQuery);
  const agents = useQuery(agentsQuery);
  if (!me.data) return null;
  const myAgents = (agents.data ?? []).filter(
    (agent) => agent.owner?.id === me.data?.id && agent.status === 'active',
  );
  return (
    <>
      <TopBar crumbs={[t('profile.title')]} />
      <main className="flex max-w-[960px] flex-col gap-8 px-10 py-6">
        <header className="flex flex-col gap-1">
          <h1 className="m-0 text-[26px] leading-tight font-semibold tracking-[-0.015em]">
            {t('profile.title')}
          </h1>
          <p className="m-0 text-[var(--ink-muted)]">{t('profile.intro')}</p>
          <PersonalSpaceButton />
        </header>
        <Section id="profile" title={t('profile.profile')}>
          <ProfileForm me={me.data} />
        </Section>
        {me.data.hasPassword && (
          <Section id="password" title={t('profile.password')}>
            <PasswordForm />
          </Section>
        )}
        {me.data.hasPassword && (
          <Section id="two-factor" title={t('twoFactor.section')}>
            <TwoFactor me={me.data} />
          </Section>
        )}
        <Section id="appearance" title={t('profile.appearance')}>
          <Appearance me={me.data} />
        </Section>
        <Section id="notifications" title={t('profile.notifications')}>
          <div className="max-w-[640px]">
            <EmailSettings />
          </div>
        </Section>
        <Section id="tokens" title={t('profile.tokens')}>
          <Tokens me={me.data} />
        </Section>
        {myAgents.length > 0 && (
          <Section id="agents" title={t('agents.mine')}>
            <MyAgents me={me.data} agents={myAgents} />
          </Section>
        )}
        <Section id="connected-apps" title={t('oauth.connected')}>
          <ConnectedApps />
        </Section>
        <Section id="sessions" title={t('profile.sessions')}>
          <Sessions />
        </Section>
      </main>
    </>
  );
}
