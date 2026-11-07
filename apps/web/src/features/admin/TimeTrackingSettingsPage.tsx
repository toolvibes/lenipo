import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { timeTrackingSettingsQuery } from '../../lib/admin';
import { client, unwrap } from '../../lib/api';
import { trackingMetaQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';

/** The length of a working day and week, which "1d" and "1w" mean (E-47). */
export function TimeTrackingSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const settings = useQuery(timeTrackingSettingsQuery);
  const [hours, setHours] = useState('');
  const [days, setDays] = useState('');
  useEffect(() => {
    if (!settings.data) return;
    setHours(String(settings.data.hoursPerDay));
    setDays(String(settings.data.daysPerWeek));
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () =>
      unwrap(
        client.PUT('/api/v1/admin/time-tracking', {
          body: { hoursPerDay: Number(hours), daysPerWeek: Number(days) },
        }),
      ),
    onSuccess: async (saved) => {
      queryClient.setQueryData(timeTrackingSettingsQuery.queryKey, saved);
      await queryClient.invalidateQueries({ queryKey: trackingMetaQuery.queryKey });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <main className="flex max-w-[960px] flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-[24px] leading-[30px] font-extrabold tracking-[-0.025em]">
          {t('time.settingsTitle')}
        </h1>
      </header>
      <p className="m-0 max-w-[720px] text-[var(--ink-muted)]">{t('time.settingsIntro')}</p>
      {settings.error && <FormError message={settings.error.message} />}
      <form
        className="flex max-w-[480px] flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-4"
        onSubmit={submit}
      >
        {save.error && <FormError message={save.error.message} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label={t('time.hoursPerDay')}
            type="number"
            min={1}
            max={24}
            step={0.5}
            required
            value={hours}
            onChange={(event) => {
              setHours(event.target.value);
              save.reset();
            }}
          />
          <TextField
            label={t('time.daysPerWeek')}
            type="number"
            min={1}
            max={7}
            step={1}
            required
            value={days}
            onChange={(event) => {
              setDays(event.target.value);
              save.reset();
            }}
          />
        </div>
        <div className="flex items-center justify-end gap-3">
          {save.isSuccess && (
            <span role="status" className="text-[var(--ink-muted)]">
              {t('time.saved')}
            </span>
          )}
          <Button type="submit" variant="primary" disabled={save.isPending || !settings.data}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </main>
  );
}
