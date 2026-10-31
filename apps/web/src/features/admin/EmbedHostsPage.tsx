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
    <main className="flex max-w-[720px] flex-col gap-4 px-10 py-7">
      <h1 className="m-0 text-[22px] leading-7 font-semibold tracking-[-0.015em]">
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
    </main>
  );
}
