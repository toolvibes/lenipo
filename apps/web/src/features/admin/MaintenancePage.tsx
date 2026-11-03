import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BackupSettings, RetentionResult, RetentionSettings } from '@toolvibes/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatBytes, formatDateTime } from '../../lib/format';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';

/** Retention and backups (TL-39, E-120). */
export function MaintenancePage() {
  const { t } = useTranslation();
  return (
    <main className="flex max-w-[760px] flex-col gap-8">
      <h1 className="m-0 text-xl font-semibold">{t('maintenance.title')}</h1>
      <Updates />
      <Backups />
      <Retention />
    </main>
  );
}

/** The running version and the optional check for newer releases (TL-110, E-155). */
function Updates() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ['admin', 'updates'],
    queryFn: () => unwrap(client.GET('/api/v1/admin/updates')),
  });
  const toggle = useMutation({
    mutationFn: (enabled: boolean) =>
      unwrap(client.PUT('/api/v1/admin/updates', { body: { enabled } })),
    onSuccess: (data) => queryClient.setQueryData(['admin', 'updates'], data),
  });
  const data = status.data;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-base font-semibold">{t('maintenance.updates.title')}</h2>
      {(status.error ?? toggle.error) && (
        <FormError message={(status.error ?? toggle.error)?.message ?? ''} />
      )}
      {data && (
        <>
          <p className="m-0 text-[13px]">
            {t('maintenance.updates.current', { version: data.current })}
          </p>
          {data.available && data.latest && (
            <p className="m-0 rounded-[var(--radius-md)] bg-[var(--accent-soft)] px-3 py-2 text-[13px]">
              {t('maintenance.updates.available', { version: data.latest })}{' '}
              {data.url && (
                <a
                  href={data.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--accent)]"
                >
                  {t('maintenance.updates.notes')}
                </a>
              )}
            </p>
          )}
          {data.enabled && !data.available && data.latest && (
            <p className="m-0 text-[13px] text-[var(--ink-muted)]">
              {t('maintenance.updates.upToDate')}
            </p>
          )}
          {data.enabled && data.error && (
            <p className="m-0 text-[13px] text-[var(--danger)]">
              {t('maintenance.updates.failed', { error: data.error })}
            </p>
          )}
          <label className="flex items-start gap-2 text-[13px]">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={data.enabled}
              disabled={toggle.isPending}
              onChange={(event) => toggle.mutate(event.target.checked)}
            />
            <span>
              {t('maintenance.updates.check')}
              <span className="block text-xs text-[var(--ink-muted)]">
                {t('maintenance.updates.checkHelp')}
              </span>
            </span>
          </label>
        </>
      )}
    </section>
  );
}

function Retention() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ['admin', 'retention'],
    queryFn: () => unwrap(client.GET('/api/v1/admin/retention')),
  });
  const [form, setForm] = useState<Record<keyof RetentionSettings, string>>({
    trashDays: '',
    versionDays: '',
    auditDays: '',
  });
  const [result, setResult] = useState<RetentionResult | null>(null);
  useEffect(() => {
    if (!settings.data) return;
    setForm({
      trashDays: String(settings.data.trashDays),
      versionDays: String(settings.data.versionDays),
      auditDays: String(settings.data.auditDays),
    });
  }, [settings.data]);
  const save = useMutation({
    mutationFn: () =>
      unwrap(
        client.PUT('/api/v1/admin/retention', {
          body: {
            trashDays: Number(form.trashDays),
            versionDays: Number(form.versionDays),
            auditDays: Number(form.auditDays),
          },
        }),
      ),
    onSuccess: (saved) => queryClient.setQueryData(['admin', 'retention'], saved),
  });
  const run = useMutation({
    mutationFn: () => unwrap(client.POST('/api/v1/admin/retention/run')),
    onSuccess: setResult,
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-base font-semibold">{t('maintenance.retention')}</h2>
      <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('maintenance.retentionIntro')}</p>
      {(save.error ?? run.error) && (
        <FormError message={(save.error ?? run.error)?.message ?? ''} />
      )}
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-3">
          {(['trashDays', 'versionDays', 'auditDays'] as const).map((field) => (
            <TextField
              key={field}
              label={t(`maintenance.${field}`)}
              help={t(`maintenance.${field}Help`)}
              type="number"
              min={0}
              max={3650}
              value={form[field]}
              onChange={(event) => setForm({ ...form, [field]: event.target.value })}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {t('common.save')}
          </Button>
          <Button type="button" onClick={() => run.mutate()} disabled={run.isPending}>
            {t('maintenance.runNow')}
          </Button>
          {result && (
            <span className="text-[13px] text-[var(--ink-muted)]" role="status">
              {t('maintenance.result', result)}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

function Backups() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ['admin', 'backups'],
    queryFn: () => unwrap(client.GET('/api/v1/admin/backups')),
    refetchInterval: (query) =>
      query.state.data?.some((backup) => backup.state === 'running') ? 2_000 : false,
  });
  const schedule = useQuery({
    queryKey: ['admin', 'backup-settings'],
    queryFn: () => unwrap(client.GET('/api/v1/admin/backup-settings')),
  });
  const [form, setForm] = useState<BackupSettings | null>(null);
  useEffect(() => {
    if (schedule.data) setForm(schedule.data);
  }, [schedule.data]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'backups'] });
  const start = useMutation({
    mutationFn: () => unwrap(client.POST('/api/v1/admin/backups')),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      unwrap(client.DELETE('/api/v1/admin/backups/{id}', { params: { path: { id } } })),
    onSettled: refresh,
  });
  const save = useMutation({
    mutationFn: (body: BackupSettings) =>
      unwrap(client.PUT('/api/v1/admin/backup-settings', { body })),
    onSuccess: (saved) => queryClient.setQueryData(['admin', 'backup-settings'], saved),
  });
  const error = start.error ?? remove.error ?? save.error;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-base font-semibold">{t('maintenance.backups')}</h2>
      <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('maintenance.backupsIntro')}</p>
      {error && <FormError message={error.message} />}
      {form && (
        <form
          className="flex flex-wrap items-end gap-3 text-[13px]"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(form);
          }}
        >
          <label className="flex items-center gap-2 pb-2">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
            />
            {t('maintenance.daily')}
          </label>
          <TextField
            label={t('maintenance.hour')}
            type="number"
            min={0}
            max={23}
            value={String(form.hour)}
            onChange={(event) => setForm({ ...form, hour: Number(event.target.value) })}
          />
          <TextField
            label={t('maintenance.keep')}
            type="number"
            min={1}
            max={100}
            value={String(form.keep)}
            onChange={(event) => setForm({ ...form, keep: Number(event.target.value) })}
          />
          <Button type="submit" disabled={save.isPending}>
            {t('common.save')}
          </Button>
        </form>
      )}
      <div>
        <Button variant="primary" onClick={() => start.mutate()} disabled={start.isPending}>
          {t('maintenance.backupNow')}
        </Button>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {(list.data ?? []).map((backup) => (
          <li
            key={backup.id}
            className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] py-2 text-[13px]"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">{formatDateTime(backup.createdAt)}</span>
              <span className="text-xs text-[var(--ink-muted)]">
                {t(`maintenance.trigger.${backup.trigger}`)} ·{' '}
                {backup.state === 'done'
                  ? t('maintenance.contents', {
                      size: formatBytes(backup.sizeBytes ?? 0),
                      rows: backup.rows ?? 0,
                      files: backup.files ?? 0,
                    })
                  : backup.state === 'running'
                    ? t('maintenance.running')
                    : `${t('maintenance.failed')}: ${backup.error ?? ''}`}
              </span>
            </span>
            {backup.state === 'done' && (
              <a
                className="text-[var(--accent)]"
                href={`/api/v1/admin/backups/${backup.id}/download`}
                download
              >
                {t('maintenance.download')}
              </a>
            )}
            {backup.state !== 'running' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (window.confirm(t('maintenance.deleteConfirm'))) remove.mutate(backup.id);
                }}
              >
                {t('maintenance.delete')}
              </Button>
            )}
          </li>
        ))}
        {list.data?.length === 0 && (
          <li className="py-2 text-[13px] text-[var(--ink-muted)]">{t('maintenance.none')}</li>
        )}
      </ul>
    </section>
  );
}
