import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type Announcement,
  type FeatureFlags,
  type MaintenanceMode,
  MODULES,
  type RateLimitSettings,
} from '@tasklore/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { noticeQuery } from '../../lib/instance';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';

/** Modules, maintenance mode, banner and request limits (TL-40, E-121). */
export function OperationsPage() {
  const { t } = useTranslation();
  return (
    <main className="flex max-w-[760px] flex-col gap-8">
      <h1 className="m-0 text-xl font-semibold">{t('operations.title')}</h1>
      <Modules />
      <Maintenance />
      <Banner />
      <Limits />
      <Tokens />
    </main>
  );
}

function useSaved<T>(key: string, path: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', key],
    queryFn: async () => (await client.GET(path as never)).data as T,
  });
  const save = useMutation({
    mutationFn: (body: T) => unwrap(client.PUT(path as never, { body } as never)) as Promise<T>,
    onSuccess: async (saved) => {
      queryClient.setQueryData(['admin', key], saved);
      await queryClient.invalidateQueries({ queryKey: noticeQuery.queryKey });
    },
  });
  return { query, save };
}

function Section({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-base font-semibold">{title}</h2>
      {intro && <p className="m-0 text-[13px] text-[var(--ink-muted)]">{intro}</p>}
      {children}
    </section>
  );
}

function Modules() {
  const { t } = useTranslation();
  const { query, save } = useSaved<FeatureFlags>('feature-flags', '/api/v1/admin/feature-flags');
  const flags = query.data;
  return (
    <Section title={t('operations.modules')} intro={t('operations.modulesIntro')}>
      {save.error && <FormError message={save.error.message} />}
      <div className="flex flex-col gap-1.5 text-[13px]">
        {flags &&
          MODULES.map((name) => (
            <label key={name} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={flags[name]}
                disabled={save.isPending}
                onChange={(event) => save.mutate({ ...flags, [name]: event.target.checked })}
              />
              {t(`operations.module.${name}`)}
            </label>
          ))}
      </div>
    </Section>
  );
}

function Maintenance() {
  const { t } = useTranslation();
  const { query, save } = useSaved<MaintenanceMode>(
    'maintenance-mode',
    '/api/v1/admin/maintenance-mode',
  );
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (query.data) setMessage(query.data.message);
  }, [query.data]);
  const enabled = query.data?.enabled ?? false;
  return (
    <Section title={t('operations.maintenance')} intro={t('operations.maintenanceIntro')}>
      {save.error && <FormError message={save.error.message} />}
      <TextField
        label={t('operations.maintenanceMessage')}
        value={message}
        maxLength={1000}
        onChange={(event) => setMessage(event.target.value)}
      />
      <div className="flex items-center gap-3 text-[13px]">
        <Button
          variant={enabled ? 'primary' : 'danger'}
          disabled={save.isPending || !query.data}
          onClick={() => {
            if (enabled || window.confirm(t('operations.maintenanceConfirm')))
              save.mutate({ enabled: !enabled, message });
          }}
        >
          {enabled ? t('operations.maintenanceOff') : t('operations.maintenanceOn')}
        </Button>
        {enabled && (
          <Button onClick={() => save.mutate({ enabled, message })} disabled={save.isPending}>
            {t('common.save')}
          </Button>
        )}
        <span className="text-[var(--ink-muted)]">
          {enabled ? t('operations.maintenanceActive') : ''}
        </span>
      </div>
    </Section>
  );
}

/** A local date-time input value from an ISO string, and back. */
const toLocal = (iso: string | null) => {
  if (!iso) return '';
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocal = (value: string) => (value ? new Date(value).toISOString() : null);

function Banner() {
  const { t } = useTranslation();
  const { query, save } = useSaved<Announcement>('announcement', '/api/v1/admin/announcement');
  const [form, setForm] = useState<Announcement | null>(null);
  useEffect(() => {
    if (query.data) setForm(query.data);
  }, [query.data]);
  if (!form) return null;
  return (
    <Section title={t('operations.banner')} intro={t('operations.bannerIntro')}>
      {save.error && <FormError message={save.error.message} />}
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate(form);
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="tl-label text-[var(--ink-muted)]">{t('operations.bannerText')}</span>
          <textarea
            value={form.text}
            rows={3}
            maxLength={2000}
            onChange={(event) => setForm({ ...form, text: event.target.value })}
            className="rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 py-1.5 text-[13px]"
          />
        </label>
        <div className="flex flex-wrap items-end gap-3 text-[13px]">
          <label className="flex flex-col gap-1.5">
            <span className="tl-label text-[var(--ink-muted)]">{t('operations.bannerLevel')}</span>
            <select
              value={form.level}
              onChange={(event) =>
                setForm({ ...form, level: event.target.value as Announcement['level'] })
              }
              className="rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 py-1.5"
            >
              <option value="info">{t('operations.levelInfo')}</option>
              <option value="warning">{t('operations.levelWarning')}</option>
            </select>
          </label>
          <TextField
            label={t('operations.bannerFrom')}
            type="datetime-local"
            value={toLocal(form.startsAt)}
            onChange={(event) => setForm({ ...form, startsAt: fromLocal(event.target.value) })}
          />
          <TextField
            label={t('operations.bannerUntil')}
            type="datetime-local"
            value={toLocal(form.endsAt)}
            onChange={(event) => setForm({ ...form, endsAt: fromLocal(event.target.value) })}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {t('common.save')}
          </Button>
          <Button
            type="button"
            disabled={save.isPending || !form.text}
            onClick={() => save.mutate({ text: '', level: 'info', startsAt: null, endsAt: null })}
          >
            {t('operations.bannerRemove')}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function Limits() {
  const { t } = useTranslation();
  const { query, save } = useSaved<RateLimitSettings>('rate-limits', '/api/v1/admin/rate-limits');
  const [form, setForm] = useState<Record<keyof RateLimitSettings, string> | null>(null);
  useEffect(() => {
    if (query.data)
      setForm({
        people: String(query.data.people),
        tokens: String(query.data.tokens),
        anonymous: String(query.data.anonymous),
      });
  }, [query.data]);
  if (!form) return null;
  return (
    <Section title={t('operations.limits')} intro={t('operations.limitsIntro')}>
      {save.error && <FormError message={save.error.message} />}
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate({
            people: Number(form.people),
            tokens: Number(form.tokens),
            anonymous: Number(form.anonymous),
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {(['people', 'tokens', 'anonymous'] as const).map((field) => (
            <TextField
              key={field}
              label={t(`operations.limit.${field}`)}
              type="number"
              min={1}
              value={form[field]}
              onChange={(event) => setForm({ ...form, [field]: event.target.value })}
            />
          ))}
        </div>
        <div>
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function Tokens() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const tokens = useQuery({
    queryKey: ['admin', 'tokens'],
    queryFn: () => unwrap(client.GET('/api/v1/admin/tokens')),
  });
  const save = useMutation({
    mutationFn: (input: { id: string; perMinute: string; perDay: string }) =>
      unwrap(
        client.PUT('/api/v1/admin/tokens/{id}/limits', {
          params: { path: { id: input.id } },
          body: {
            perMinute: input.perMinute ? Number(input.perMinute) : null,
            perDay: input.perDay ? Number(input.perDay) : null,
          },
        }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin', 'tokens'] }),
  });
  return (
    <Section title={t('operations.tokens')} intro={t('operations.tokensIntro')}>
      {save.error && <FormError message={save.error.message} />}
      <ul className="m-0 flex list-none flex-col p-0">
        {(tokens.data ?? []).map((token) => (
          <TokenRow
            key={token.id}
            token={token}
            busy={save.isPending}
            onSave={(perMinute, perDay) => save.mutate({ id: token.id, perMinute, perDay })}
          />
        ))}
        {tokens.data?.length === 0 && (
          <li className="py-2 text-[13px] text-[var(--ink-muted)]">{t('operations.noTokens')}</li>
        )}
      </ul>
    </Section>
  );
}

function TokenRow({
  token,
  busy,
  onSave,
}: {
  token: {
    name: string;
    prefix: string;
    owner: { displayName: string };
    limits: { perMinute: number | null; perDay: number | null };
    usedToday: number;
  };
  busy: boolean;
  onSave: (perMinute: string, perDay: string) => void;
}) {
  const { t } = useTranslation();
  const [perMinute, setPerMinute] = useState(String(token.limits.perMinute ?? ''));
  const [perDay, setPerDay] = useState(String(token.limits.perDay ?? ''));
  return (
    <li className="flex flex-wrap items-end gap-3 border-b border-[var(--border)] py-2 text-[13px]">
      <span className="flex min-w-[180px] flex-1 flex-col">
        <span className="font-semibold">{token.name}</span>
        <span className="text-xs text-[var(--ink-muted)]">
          {token.owner.displayName} · <code>{token.prefix}…</code>
          {token.limits.perDay !== null &&
            ` · ${t('operations.usedToday', { count: token.usedToday })}`}
        </span>
      </span>
      <TextField
        label={t('operations.perMinute')}
        type="number"
        min={1}
        placeholder={t('operations.default')}
        value={perMinute}
        onChange={(event) => setPerMinute(event.target.value)}
      />
      <TextField
        label={t('operations.perDay')}
        type="number"
        min={1}
        placeholder={t('operations.unlimited')}
        value={perDay}
        onChange={(event) => setPerDay(event.target.value)}
      />
      <Button size="sm" disabled={busy} onClick={() => onSave(perMinute, perDay)}>
        {t('common.save')}
      </Button>
    </li>
  );
}
