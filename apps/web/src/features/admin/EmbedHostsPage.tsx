import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';

const embedHostsQuery = {
  queryKey: ['wiki', 'embed-hosts'],
  queryFn: () => unwrap(client.GET('/api/v1/wiki/embed-hosts')),
};

/** Hosts whose pages wiki pages may embed (W-MAC-16, TL-26, E-107). */
export function EmbedHostsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const hosts = useQuery(embedHostsQuery);
  const [text, setText] = useState('');
  useEffect(() => {
    if (hosts.data) setText(hosts.data.hosts.join('\n'));
  }, [hosts.data]);
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        client.PUT('/api/v1/admin/embed-hosts', {
          body: {
            hosts: text
              .split(/\s+/)
              .map((host) => host.trim())
              .filter(Boolean),
          },
        }),
      ),
    onSuccess: (saved) => queryClient.setQueryData(embedHostsQuery.queryKey, saved),
  });
  return (
    <main className="flex max-w-[720px] flex-col gap-4">
      <h1 className="m-0 text-[24px] leading-[30px] font-extrabold tracking-[-0.025em]">
        {t('wikiMacros.embedTitle')}
      </h1>
      <p className="m-0 text-[var(--ink-muted)]">{t('wikiMacros.embedIntro')}</p>
      {(hosts.error ?? save.error) && (
        <FormError message={(hosts.error ?? save.error)?.message ?? ''} />
      )}
      <label className="flex flex-col gap-1">
        <span className="tl-field-label">{t('wikiMacros.embedHosts')}</span>
        <textarea
          rows={8}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            save.reset();
          }}
          className="rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] p-2 font-[family-name:var(--font-mono)] text-[13px] text-[var(--ink)]"
        />
      </label>
      <div className="flex items-center gap-3">
        <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
          {t('common.save')}
        </Button>
        {save.isSuccess && (
          <span role="status" className="text-[13px] text-[var(--ink-muted)]">
            {t('signIn.saved')}
          </span>
        )}
      </div>
      <OutdatedSetting />
    </main>
  );
}

/** After how many days verified pages count as outdated (TL-29, E-110). */
function OutdatedSetting() {
  const { t } = useTranslation();
  const settings = useQuery({
    queryKey: ['admin', 'wiki-settings'],
    queryFn: () => unwrap(client.GET('/api/v1/admin/wiki-settings')),
  });
  const [days, setDays] = useState('');
  useEffect(() => {
    if (settings.data)
      setDays(settings.data.outdatedAfterDays ? String(settings.data.outdatedAfterDays) : '');
  }, [settings.data]);
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        client.PUT('/api/v1/admin/wiki-settings', {
          body: { outdatedAfterDays: days.trim() ? Number(days) : null },
        }),
      ),
  });
  return (
    <section className="flex flex-col gap-2 border-t border-[var(--border)] pt-4">
      <h2 className="m-0 text-base font-semibold">{t('pageStatus.outdatedTitle')}</h2>
      <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('pageStatus.outdatedHelp')}</p>
      {save.error && <FormError message={save.error.message} />}
      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="tl-field-label">{t('pageStatus.outdatedDays')}</span>
          <input
            type="number"
            min={1}
            value={days}
            placeholder={t('pageStatus.never')}
            onChange={(event) => {
              setDays(event.target.value);
              save.reset();
            }}
            className="h-8 w-32 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2"
          />
        </label>
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {t('common.save')}
        </Button>
        {save.isSuccess && <span role="status">{t('signIn.saved')}</span>}
      </div>
    </section>
  );
}
