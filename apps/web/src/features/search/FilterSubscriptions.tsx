import { Trash } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type FilterSubscription,
  type SavedFilter,
  SUBSCRIPTION_SCHEDULES,
  type SubscriptionSchedule,
} from '@tasklore/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';

const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
/** 1 = Monday … 7 = Sunday. */
const dayKey = (day: number) => DAYS[(day - 1) % 7] ?? 'mon';

/** E-mail subscriptions of a saved filter (T-QRY-07, E-112). */
export function FilterSubscriptionsDialog({
  filter,
  open,
  onOpenChange,
}: {
  filter: SavedFilter;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ['filter-subscriptions', filter.id];
  const subscriptions = useQuery({
    queryKey,
    enabled: open,
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/filters/{id}/subscriptions', { params: { path: { id: filter.id } } }),
      ),
  });
  const groups = useQuery({
    queryKey: ['groups'],
    enabled: open && filter.editable,
    queryFn: () => unwrap(client.GET('/api/v1/groups')),
  });
  const [schedule, setSchedule] = useState<SubscriptionSchedule>('weekdays');
  const [weekday, setWeekday] = useState(1);
  const [hour, setHour] = useState(8);
  const [onlyWithResults, setOnlyWithResults] = useState(true);
  const [groupId, setGroupId] = useState('');

  const create = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/filters/{id}/subscriptions', {
          params: { path: { id: filter.id } },
          body: {
            schedule,
            weekday,
            hour,
            onlyWithResults,
            ...(groupId ? { groupId } : {}),
          },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      unwrap(client.DELETE('/api/v1/filter-subscriptions/{id}', { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const weekdays = [1, 2, 3, 4, 5, 6, 7].map((day) => ({
    value: String(day),
    label: t(`subscriptions.weekdays.${dayKey(day)}`),
  }));
  const describe = (entry: FilterSubscription) =>
    [
      entry.schedule === 'weekly'
        ? t('subscriptions.weeklyOn', {
            day: t(`subscriptions.weekdays.${dayKey(entry.weekday)}`),
          })
        : t(`subscriptions.schedules.${entry.schedule}`),
      hourLabel(entry.hour),
      entry.group
        ? t('subscriptions.forGroup', { name: entry.group.name })
        : entry.subscriber.displayName,
      entry.onlyWithResults ? t('subscriptions.onlyWithResults') : null,
    ]
      .filter(Boolean)
      .join(' · ');

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('subscriptions.title', { name: filter.name })}
      width={560}
    >
      <div className="flex flex-col gap-4">
        <p className="m-0 text-[var(--ink-muted)]">{t('subscriptions.intro')}</p>
        {subscriptions.data && subscriptions.data.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {subscriptions.data.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2"
              >
                <span className="flex-1">
                  {describe(entry)}
                  {entry.lastSentAt && (
                    <span className="block text-xs text-[var(--ink-muted)]">
                      {t('subscriptions.lastSent', { when: formatRelative(entry.lastSentAt) })}
                    </span>
                  )}
                </span>
                {entry.canDelete && (
                  <button
                    type="button"
                    aria-label={t('subscriptions.delete')}
                    onClick={() => remove.mutate(entry.id)}
                    className="grid size-7 place-items-center rounded-[var(--radius-sm)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
                  >
                    <Trash size={16} aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <form
          onSubmit={submit}
          className="flex flex-col gap-3 border-t border-[var(--border)] pt-4"
        >
          {create.error && <FormError message={create.error.message} />}
          <div className="grid grid-cols-3 gap-3">
            <Select
              label={t('subscriptions.schedule')}
              value={schedule}
              onChange={(event) => setSchedule(event.target.value as SubscriptionSchedule)}
              options={SUBSCRIPTION_SCHEDULES.map((value) => ({
                value,
                label: t(`subscriptions.schedules.${value}`),
              }))}
            />
            {schedule === 'weekly' ? (
              <Select
                label={t('subscriptions.weekday')}
                value={String(weekday)}
                onChange={(event) => setWeekday(Number(event.target.value))}
                options={weekdays}
              />
            ) : (
              <span />
            )}
            <Select
              label={t('subscriptions.hour')}
              value={String(hour)}
              onChange={(event) => setHour(Number(event.target.value))}
              options={Array.from({ length: 24 }, (_, value) => ({
                value: String(value),
                label: hourLabel(value),
              }))}
            />
          </div>
          {filter.editable && (
            <Select
              label={t('subscriptions.recipients')}
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
              options={[
                { value: '', label: t('subscriptions.onlyMe') },
                ...(groups.data ?? []).map((group) => ({
                  value: group.id,
                  label: t('subscriptions.forGroup', { name: group.name }),
                })),
              ]}
            />
          )}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={onlyWithResults}
              onChange={(event) => setOnlyWithResults(event.target.checked)}
            />
            {t('subscriptions.onlyWithResultsLong')}
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('subscriptions.close')}
            </Button>
            <Button type="submit" variant="primary" disabled={create.isPending}>
              {t('subscriptions.add')}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
