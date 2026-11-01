import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { Timesheet } from '@toolvibes/shared';
import { formatDuration, parseDuration } from '@toolvibes/tql';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { client, unwrap } from '../../lib/api';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { TopBar } from '../../ui/TopBar';
import { useWorkingTime } from '../tracking/TimeTracking';

const DAY = 86_400_000;

function shift(date: string, days: number): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

export const timesheetQuery = (user: string | undefined, week: string | undefined) => ({
  queryKey: ['timesheet', user ?? 'me', week ?? 'now'],
  queryFn: () =>
    unwrap(
      client.GET('/api/v1/timesheet', {
        params: { query: { ...(user ? { user } : {}), ...(week ? { week } : {}) } },
      }),
    ),
});

/** One editable cell; a bare number means hours here, e.g. "1,5". */
function Cell({
  value,
  disabled,
  label,
  onSave,
}: {
  value: number;
  disabled: boolean;
  label: string;
  onSave: (seconds: number) => void;
}) {
  const time = useWorkingTime();
  const shown = value ? formatDuration(value, time) : '';
  const [draft, setDraft] = useState(shown);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setDraft(shown), [shown]);
  const commit = () => {
    const text = draft.trim();
    if (text === shown) return;
    if (!text) return onSave(0);
    const hours = /^\d+([.,]\d+)?$/.test(text) ? Number(text.replace(',', '.')) * 3600 : null;
    const seconds = hours ?? parseDuration(text, time);
    if (!seconds) return setInvalid(true);
    setInvalid(false);
    onSave(Math.round(seconds));
  };
  return (
    <input
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={draft}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') setDraft(shown);
      }}
      className="h-8 w-full min-w-[56px] rounded-[var(--radius-sm)] border border-transparent bg-transparent px-1.5 text-right font-[family-name:var(--font-mono)] text-[13px] hover:border-[var(--border-control)] focus:border-[var(--accent)] disabled:hover:border-transparent aria-invalid:border-[var(--danger)]"
    />
  );
}

/** A person's week of logged work, editable in the table (T-TIM-03, TL-24, E-105). */
export function TimesheetPage({ user, week }: { user?: string; week?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const time = useWorkingTime();
  const sheet = useQuery(timesheetQuery(user, week));
  const [added, setAdded] = useState<string[]>([]);
  const [newKey, setNewKey] = useState('');
  const save = useMutation({
    mutationFn: (body: { issueKey: string; date: string; seconds: number }) =>
      unwrap(client.PUT('/api/v1/timesheet/cells', { body })),
    onSuccess: (next) => queryClient.setQueryData(timesheetQuery(user, week).queryKey, next),
    onError: () => queryClient.invalidateQueries({ queryKey: ['timesheet'] }),
  });
  const data: Timesheet | undefined = sheet.data;
  const go = (days: number) =>
    data && void navigate({ to: '/timesheet', search: { user, week: shift(data.week, days) } });
  const weekday = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
  const rows = data
    ? [
        ...data.rows,
        ...added
          .filter((key) => !data.rows.some((row) => row.issue.key === key))
          .map((key) => ({
            issue: { key, summary: '', project: { key: '', name: '' } },
            cells: data.days.map((date) => ({ date, seconds: 0, worklogIds: [] })),
            total: 0,
          })),
      ]
    : [];
  const show = (seconds: number) => (seconds ? formatDuration(seconds, time) : '–');
  return (
    <>
      <TopBar crumbs={[t('timesheet.title')]} />
      <main className="flex flex-col gap-4 px-6 py-6 lg:px-10">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-[26px] leading-tight font-semibold tracking-[-0.015em]">
              {t('timesheet.title')}
            </h1>
            <p className="m-0 text-[13px] text-[var(--ink-muted)]">
              {data &&
                (data.editable
                  ? t('timesheet.mine')
                  : t('timesheet.of', { name: data.user.displayName }))}
              {' · '}
              {t('timesheet.help')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" aria-label={t('timesheet.previous')} onClick={() => go(-7)}>
              <CaretLeft size={14} aria-hidden />
            </Button>
            <Button size="sm" onClick={() => void navigate({ to: '/timesheet', search: { user } })}>
              {t('timesheet.thisWeek')}
            </Button>
            <Button size="sm" aria-label={t('timesheet.next')} onClick={() => go(7)}>
              <CaretRight size={14} aria-hidden />
            </Button>
          </div>
        </header>
        {(sheet.error ?? save.error) && (
          <FormError message={(sheet.error ?? save.error)?.message ?? ''} />
        )}
        {data && (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface-1)]">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--ink-muted)]">
                  <th className="px-3 py-2 font-medium">{t('timesheet.issue')}</th>
                  {data.days.map((date) => (
                    <th key={date} className="px-2 py-2 text-right font-medium whitespace-nowrap">
                      {weekday.format(new Date(`${date}T12:00:00Z`))}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">{t('timesheet.total')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.issue.key} className="border-b border-[var(--border)]">
                    <th scope="row" className="max-w-[320px] px-3 py-1 text-left font-normal">
                      <Link
                        to="/issues/$key"
                        params={{ key: row.issue.key }}
                        className="block truncate text-[var(--ink)] no-underline hover:underline"
                      >
                        <span className="tl-key">{row.issue.key}</span> {row.issue.summary}
                      </Link>
                    </th>
                    {row.cells.map((cell) => (
                      <td key={cell.date} className="px-1 py-0.5">
                        <Cell
                          value={cell.seconds}
                          disabled={!data.editable || cell.worklogIds.length > 1 || save.isPending}
                          label={t('timesheet.cell', { key: row.issue.key, date: cell.date })}
                          onSave={(seconds) =>
                            save.mutate({ issueKey: row.issue.key, date: cell.date, seconds })
                          }
                        />
                      </td>
                    ))}
                    <td className="px-3 text-right font-[family-name:var(--font-mono)] font-semibold">
                      {show(row.total)}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-3 text-[var(--ink-muted)]">
                      {t('timesheet.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <th scope="row" className="px-3 py-2 text-left">
                    {t('timesheet.total')}
                  </th>
                  {data.dayTotals.map((value, index) => (
                    <td
                      key={data.days[index]}
                      className="px-2 py-2 text-right font-[family-name:var(--font-mono)]"
                    >
                      {show(value)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-[family-name:var(--font-mono)]">
                    {show(data.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {data?.editable && (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const key = newKey.trim().toUpperCase();
              if (key) setAdded((current) => [...current, key]);
              setNewKey('');
            }}
          >
            <label className="flex items-center gap-2 text-[13px]">
              {t('timesheet.addIssue')}
              <input
                value={newKey}
                placeholder="WEB-12"
                onChange={(event) => setNewKey(event.target.value)}
                className="h-8 w-28 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 font-[family-name:var(--font-mono)] text-[13px]"
              />
            </label>
            <Button size="sm" type="submit" disabled={!newKey.trim()}>
              {t('timesheet.add')}
            </Button>
          </form>
        )}
        <p className="m-0 text-xs text-[var(--ink-muted)]">{t('timesheet.several')}</p>
      </main>
    </>
  );
}
