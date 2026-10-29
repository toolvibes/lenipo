import { Timer } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Issue, UpdateIssueRequest, Worklog } from '@tasklore/shared';
import { DEFAULT_WORKING_TIME, formatDuration, parseDuration } from '@tasklore/tql';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import { trackingMetaQuery, worklogsQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';
import { Avatar } from './UserPicker';

function useWorkingTime() {
  return useQuery(trackingMetaQuery).data?.workingTime ?? DEFAULT_WORKING_TIME;
}

/** Formats seconds with the instance's working time, e.g. "1d 4h". */
export function useDuration() {
  const time = useWorkingTime();
  return (seconds: number | null) => (seconds === null ? null : formatDuration(seconds, time));
}

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** A duration field that saves on blur or Enter, with a hint when the input is not a duration. */
function DurationInput({
  label,
  value,
  disabled,
  onSave,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onSave: (value: string | null) => void;
}) {
  const { t } = useTranslation();
  const time = useWorkingTime();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const invalid = draft.trim() !== '' && parseDuration(draft, time) === undefined;
  const commit = () => {
    if (draft === value || invalid) return;
    onSave(draft.trim() ? draft.trim() : null);
  };
  return (
    <input
      aria-label={label}
      aria-invalid={invalid}
      title={invalid ? t('time.invalid') : undefined}
      value={draft}
      disabled={disabled}
      placeholder={t('time.none')}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
        if (event.key === 'Escape') setDraft(value);
      }}
      className={`h-[var(--control-sm)] w-full rounded-[var(--radius-md)] border bg-transparent px-1.5 text-[var(--ink)] hover:border-[var(--border-strong)] focus:border-[var(--accent)] disabled:hover:border-transparent ${
        invalid ? 'border-[var(--danger)]' : 'border-transparent'
      }`}
    />
  );
}

/** Estimate, remaining and logged time with a progress bar (T-TIM-01). */
export function TimeTrackingPanel({
  issue,
  canEdit,
  onUpdate,
  onLogWork,
}: {
  issue: Issue;
  canEdit: boolean;
  onUpdate: (body: UpdateIssueRequest) => void;
  onLogWork: () => void;
}) {
  const { t } = useTranslation();
  const duration = useDuration();
  const { originalEstimateSeconds, remainingEstimateSeconds, timeSpentSeconds } =
    issue.timeTracking;
  const total = timeSpentSeconds + (remainingEstimateSeconds ?? 0);
  const done = total > 0 ? Math.round((timeSpentSeconds / total) * 100) : 0;

  return (
    <section
      aria-label={t('time.title')}
      className="flex flex-col gap-2 border-t border-[var(--border)] pt-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="tl-label uppercase text-[var(--ink-muted)]">{t('time.title')}</h2>
        {canEdit && (
          <Button size="sm" variant="ghost" onClick={onLogWork}>
            <Timer size={16} aria-hidden />
            {t('time.log')}
          </Button>
        )}
      </div>
      <div
        role="img"
        aria-label={t('time.progress', {
          logged: duration(timeSpentSeconds) ?? '',
          remaining: duration(remainingEstimateSeconds ?? 0) ?? '',
        })}
        className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"
      >
        <div className="h-full bg-[var(--accent)]" style={{ width: `${done}%` }} />
      </div>
      <dl className="m-0 grid grid-cols-[minmax(0,110px)_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
        <dt className="tl-label uppercase text-[var(--ink-muted)]">{t('time.estimate')}</dt>
        <dd className="m-0">
          <DurationInput
            label={t('issues.field.originalEstimate')}
            value={duration(originalEstimateSeconds) ?? ''}
            disabled={!canEdit}
            onSave={(value) => onUpdate({ originalEstimate: value })}
          />
        </dd>
        <dt className="tl-label uppercase text-[var(--ink-muted)]">{t('time.remaining')}</dt>
        <dd className="m-0">
          <DurationInput
            label={t('issues.field.remainingEstimate')}
            value={duration(remainingEstimateSeconds) ?? ''}
            disabled={!canEdit}
            onSave={(value) => onUpdate({ remainingEstimate: value })}
          />
        </dd>
        <dt className="tl-label uppercase text-[var(--ink-muted)]">{t('time.logged')}</dt>
        <dd className="m-0 px-1.5">{duration(timeSpentSeconds)}</dd>
      </dl>
    </section>
  );
}

/** Logs new work or changes an own worklog (T-TIM-02, E-47). */
export function LogWorkDialog({
  issueKey,
  open,
  onOpenChange,
  editing,
}: {
  issueKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Worklog;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const time = useWorkingTime();
  const [spent, setSpent] = useState('');
  const [date, setDate] = useState(today());
  const [comment, setComment] = useState('');
  const [mode, setMode] = useState<'auto' | 'leave' | 'set'>('auto');
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!open) return;
    setSpent(editing ? formatDuration(editing.timeSpentSeconds, time) : '');
    setDate(editing ? editing.started.slice(0, 10) : today());
    setComment(editing?.comment ?? '');
    setMode('auto');
    setRemaining('');
  }, [open, editing, time]);

  const save = useMutation({
    mutationFn: () => {
      // Noon local time keeps the chosen day in every time zone.
      const started = new Date(`${date}T12:00:00`).toISOString();
      const path = { params: { path: { key: issueKey } } };
      if (editing) {
        return unwrap(
          client.PATCH('/api/v1/issues/{key}/worklogs/{worklogId}', {
            params: { path: { key: issueKey, worklogId: editing.id } },
            body: { timeSpent: spent, started, comment },
          }),
        );
      }
      return unwrap(
        client.POST('/api/v1/issues/{key}/worklogs', {
          ...path,
          body: {
            timeSpent: spent,
            started,
            comment,
            remaining: mode === 'set' ? { mode, value: remaining } : { mode },
          },
        }),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['issue', issueKey] });
      onOpenChange(false);
    },
  });

  const spentInvalid = spent.trim() !== '' && parseDuration(spent, time) === undefined;
  const remainingInvalid = mode === 'set' && parseDuration(remaining, time) === undefined;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (spent.trim() && !spentInvalid && !remainingInvalid) save.mutate();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t('time.edit') : t('time.log')}
      width={480}
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {save.error && <FormError message={save.error.message} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label={t('time.timeSpent')}
            value={spent}
            required
            autoFocus
            placeholder="2h 30m"
            error={spentInvalid ? t('time.invalid') : undefined}
            onChange={(event) => setSpent(event.target.value)}
          />
          <TextField
            label={t('time.started')}
            type="date"
            value={date}
            required
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <p className="m-0 text-xs text-[var(--ink-muted)]">
          {t('time.durationHelp', { hours: time.hoursPerDay, days: time.daysPerWeek })}
        </p>
        <TextField
          label={t('time.comment')}
          value={comment}
          maxLength={2000}
          onChange={(event) => setComment(event.target.value)}
        />
        {!editing && (
          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="tl-label mb-1 uppercase text-[var(--ink-muted)]">
              {t('time.adjust')}
            </legend>
            {(['auto', 'leave', 'set'] as const).map((option) => (
              <label key={option} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="remaining"
                  checked={mode === option}
                  onChange={() => setMode(option)}
                />
                {t(
                  option === 'auto'
                    ? 'time.adjustAuto'
                    : option === 'leave'
                      ? 'time.adjustLeave'
                      : 'time.adjustSet',
                )}
                {option === 'set' && (
                  <input
                    aria-label={t('time.adjustSet')}
                    aria-invalid={mode === 'set' && remainingInvalid}
                    value={remaining}
                    placeholder="4h"
                    disabled={mode !== 'set'}
                    onChange={(event) => setRemaining(event.target.value)}
                    className="h-[var(--control-sm)] w-28 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 disabled:opacity-55"
                  />
                )}
              </label>
            ))}
          </fieldset>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={save.isPending || !spent.trim() || spentInvalid || remainingInvalid}
          >
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** The work log tab of the issue activity. */
export function WorklogList({ issueKey }: { issueKey: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const duration = useDuration();
  const worklogs = useQuery(worklogsQuery(issueKey));
  const [editing, setEditing] = useState<Worklog | undefined>();
  const [confirming, setConfirming] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: (worklogId: string) =>
      unwrap(
        client.DELETE('/api/v1/issues/{key}/worklogs/{worklogId}', {
          params: { path: { key: issueKey, worklogId } },
        }),
      ),
    onSuccess: async () => {
      setConfirming(null);
      await queryClient.invalidateQueries({ queryKey: ['issue', issueKey] });
    },
  });
  const action = 'text-xs text-[var(--ink-muted)] hover:text-[var(--ink)] hover:underline';

  return (
    <div className="flex flex-col gap-3">
      {remove.error && <FormError message={remove.error.message} />}
      {worklogs.data?.length === 0 && (
        <p className="text-[var(--ink-muted)]">{t('time.noWorklogs')}</p>
      )}
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {worklogs.data?.map((worklog) => (
          <li key={worklog.id} className="flex gap-3">
            {worklog.author && <Avatar user={worklog.author} size={28} />}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <strong className="font-semibold">{worklog.author?.displayName}</strong>
                <span className="font-semibold">{duration(worklog.timeSpentSeconds)}</span>
                <span
                  className="text-xs text-[var(--ink-muted)]"
                  title={formatDateTime(worklog.started)}
                >
                  {formatDate(worklog.started.slice(0, 10))}
                </span>
                {worklog.canEdit && (
                  <button type="button" className={action} onClick={() => setEditing(worklog)}>
                    {t('time.edit')}
                  </button>
                )}
                {worklog.canDelete && (
                  <button
                    type="button"
                    className={action}
                    onClick={() => setConfirming(worklog.id)}
                  >
                    {t('time.delete')}
                  </button>
                )}
              </span>
              {worklog.comment && <span className="break-words">{worklog.comment}</span>}
              {confirming === worklog.id && (
                <div
                  role="alert"
                  className="mt-1 flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] bg-[var(--danger-soft)] px-3 py-2"
                >
                  <span className="flex-1">{t('time.deleteConfirm')}</span>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(worklog.id)}
                  >
                    {t('time.delete')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                    {t('common.cancel')}
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      <LogWorkDialog
        issueKey={issueKey}
        open={editing !== undefined}
        onOpenChange={(open) => !open && setEditing(undefined)}
        editing={editing}
      />
    </div>
  );
}
