import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SaveMailHandlerRequest } from '@toolvibes/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';

/** The project's IMAP mailbox: mails become issues, replies comments (TL-53, E-142). */
export function MailHandlerSettings({ projectKey }: { projectKey: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const params = { params: { path: { key: projectKey } } };
  const queryKey = ['project', projectKey, 'mail-handler'];
  const handler = useQuery({
    queryKey,
    queryFn: () => unwrap(client.GET('/api/v1/projects/{key}/mail-handler', params)),
  });
  const receipts = useQuery({
    queryKey: [...queryKey, 'receipts'],
    queryFn: () => unwrap(client.GET('/api/v1/projects/{key}/mail-handler/receipts', params)),
  });
  const [draft, setDraft] = useState<SaveMailHandlerRequest>({
    enabled: true,
    host: '',
    port: 993,
    secure: true,
    username: '',
    folder: 'INBOX',
    doneFolder: '',
    issueType: 'task',
  });
  const [password, setPassword] = useState('');
  useEffect(() => {
    const current = handler.data?.handler;
    if (current) {
      setDraft({
        enabled: current.enabled,
        host: current.host,
        port: current.port,
        secure: current.secure,
        username: current.username,
        folder: current.folder,
        doneFolder: current.doneFolder,
        issueType: current.issueType,
      });
    }
  }, [handler.data]);
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        client.PUT('/api/v1/projects/{key}/mail-handler', {
          ...params,
          body: { ...draft, ...(password ? { password } : {}) },
        }),
      ),
    onSuccess: () => {
      setPassword('');
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  const remove = useMutation({
    mutationFn: () => unwrap(client.DELETE('/api/v1/projects/{key}/mail-handler', params)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
  });
  const current = handler.data?.handler;
  const set = (patch: Partial<SaveMailHandlerRequest>) => setDraft({ ...draft, ...patch });
  return (
    <section className="flex max-w-[640px] flex-col gap-3 border-t border-[var(--border)] pt-5">
      <h2 className="m-0 text-[15px] font-semibold">{t('mailHandler.title')}</h2>
      <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('mailHandler.intro')}</p>
      {(handler.error ?? save.error ?? remove.error) && (
        <FormError message={(handler.error ?? save.error ?? remove.error)?.message ?? ''} />
      )}
      {current?.lastRunAt && (
        <p className="m-0 text-[13px] text-[var(--ink-muted)]">
          {t('mailHandler.lastRun', {
            when: formatRelative(current.lastRunAt),
            result: current.lastResult ?? '',
          })}
        </p>
      )}
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <TextField
          label={t('mailHandler.host')}
          value={draft.host}
          placeholder="imap.example.org"
          onChange={(event) => set({ host: event.target.value })}
        />
        <TextField
          label={t('mailHandler.port')}
          type="number"
          value={draft.port}
          onChange={(event) => set({ port: Number(event.target.value) || 993 })}
        />
        <TextField
          label={t('mailHandler.username')}
          value={draft.username}
          onChange={(event) => set({ username: event.target.value })}
        />
        <TextField
          label={t('mailHandler.password')}
          help={current?.hasPassword ? t('mailHandler.passwordKept') : undefined}
          type="password"
          autoComplete="off"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <TextField
          label={t('mailHandler.folder')}
          value={draft.folder}
          onChange={(event) => set({ folder: event.target.value })}
        />
        <TextField
          label={t('mailHandler.doneFolder')}
          help={t('mailHandler.doneFolderHelp')}
          value={draft.doneFolder}
          onChange={(event) => set({ doneFolder: event.target.value })}
        />
        <TextField
          label={t('mailHandler.issueType')}
          value={draft.issueType}
          onChange={(event) => set({ issueType: event.target.value })}
        />
        <div className="flex flex-col gap-2 text-[13px]">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.secure}
              onChange={(event) => set({ secure: event.target.checked })}
            />
            {t('mailHandler.secure')}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => set({ enabled: event.target.checked })}
            />
            {t('mailHandler.enabled')}
          </label>
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Button
            type="submit"
            variant="primary"
            disabled={!draft.host || !draft.username || save.isPending}
          >
            {t('common.save')}
          </Button>
          {current && (
            <Button type="button" variant="danger" onClick={() => remove.mutate()}>
              {t('mailHandler.remove')}
            </Button>
          )}
        </div>
      </form>
      {(receipts.data?.length ?? 0) > 0 && (
        <ul className="m-0 flex list-none flex-col p-0 text-[13px]">
          {receipts.data?.map((receipt) => (
            <li key={receipt.messageId} className="border-b border-[var(--border)] py-1">
              {formatRelative(receipt.receivedAt)} ·{' '}
              {t(`mailHandler.outcomes.${receipt.outcome}`, { defaultValue: receipt.outcome })}
              {receipt.issueKey && ` · ${receipt.issueKey}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
