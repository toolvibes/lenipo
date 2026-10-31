import { Stop, Trash } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';

export const timerQuery = {
  queryKey: ['me', 'timer'],
  queryFn: () => unwrap(client.GET('/api/v1/me/timer')),
  refetchInterval: 60_000,
};

function elapsed(since: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** The running timer, on every page and device (T-TIM-04, TL-24, E-105). */
export function TimerBar() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const timer = useQuery(timerQuery).data?.timer ?? null;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!timer) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [timer]);
  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: ['me', 'timer'] });
    await queryClient.invalidateQueries({ queryKey: ['issue'] });
    await queryClient.invalidateQueries({ queryKey: ['timesheet'] });
  };
  const stop = useMutation({
    mutationFn: (comment: string) =>
      unwrap(client.POST('/api/v1/me/timer/stop', { body: { comment } })),
    onSuccess: done,
  });
  const discard = useMutation({
    mutationFn: () => unwrap(client.DELETE('/api/v1/me/timer')),
    onSuccess: done,
  });
  if (!timer) return null;
  return (
    <div
      role="status"
      className="mx-2 flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent-soft)] px-2.5 py-1.5 text-[12.5px]"
    >
      <span className="size-2 animate-pulse rounded-full bg-[var(--danger)]" aria-hidden />
      <Link
        to="/issues/$key"
        params={{ key: timer.issue.key }}
        title={timer.issue.summary}
        className="tl-key min-w-0 flex-1 truncate no-underline"
      >
        {timer.issue.key}
      </Link>
      <span className="font-[family-name:var(--font-mono)]">{elapsed(timer.startedAt, now)}</span>
      <button
        type="button"
        aria-label={t('timer.stop')}
        title={t('timer.stop')}
        disabled={stop.isPending}
        onClick={() => {
          const comment = window.prompt(t('timer.comment'), '');
          if (comment !== null) stop.mutate(comment);
        }}
        className="grid size-6 place-items-center rounded-[var(--radius-sm)] hover:bg-[var(--surface-1)]"
      >
        <Stop size={14} weight="fill" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={t('timer.discard')}
        title={t('timer.discard')}
        disabled={discard.isPending}
        onClick={() => window.confirm(t('timer.discardConfirm')) && discard.mutate()}
        className="grid size-6 place-items-center rounded-[var(--radius-sm)] hover:bg-[var(--surface-1)]"
      >
        <Trash size={14} aria-hidden />
      </button>
    </div>
  );
}

/** Starts a timer on an issue; one per person. */
export function StartTimerButton({ issueKey }: { issueKey: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const timer = useQuery(timerQuery).data?.timer ?? null;
  const start = useMutation({
    mutationFn: () =>
      unwrap(client.POST('/api/v1/issues/{key}/timer', { params: { path: { key: issueKey } } })),
    onSuccess: (state) => queryClient.setQueryData(timerQuery.queryKey, state),
  });
  if (timer?.issue.key === issueKey) {
    return <span className="text-xs text-[var(--ink-muted)]">{t('timer.running')}</span>;
  }
  return (
    <button
      type="button"
      disabled={!!timer || start.isPending}
      title={timer ? t('timer.otherRunning', { key: timer.issue.key }) : undefined}
      onClick={() => start.mutate()}
      className="h-7 rounded-[var(--radius-md)] px-2 text-[13px] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] disabled:opacity-50"
    >
      {t('timer.start')}
    </button>
  );
}
