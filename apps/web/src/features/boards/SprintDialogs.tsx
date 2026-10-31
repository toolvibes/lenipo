import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { EstimationField, IssueSummary, Sprint } from '@tasklore/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';
import { useDuration } from '../tracking/TimeTracking';
import { type CapacityDraft, CapacityFields, capacityDraft, capacityRequest } from './Capacity';

function isoDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Adds up issues the way the board estimates (T-SPR-08). */
export function useEstimate(estimation: EstimationField) {
  const duration = useDuration();
  return (issues: IssueSummary[]) => {
    if (estimation === 'issueCount') return String(issues.length);
    if (estimation === 'originalEstimate') {
      const total = issues.reduce(
        (sum, issue) => sum + (issue.timeTracking.originalEstimateSeconds ?? 0),
        0,
      );
      return duration(total) ?? '0m';
    }
    const points = issues.reduce((sum, issue) => sum + (issue.storyPoints ?? 0), 0);
    return String(Math.round(points * 10) / 10);
  };
}

/** Name, goal and dates; with `starting`, the sprint starts on save (T-SPR-02). */
export function SprintDialog({
  sprint,
  issues,
  estimation,
  starting,
  open,
  onOpenChange,
  onDone,
}: {
  sprint: Sprint;
  /** The sprint's issues, to offer their assignees for capacity planning. */
  issues: IssueSummary[];
  estimation: EstimationField;
  starting: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(sprint.name);
  const [goal, setGoal] = useState(sprint.goal);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [capacity, setCapacity] = useState<CapacityDraft>(() => capacityDraft(sprint, issues));
  useEffect(() => {
    if (!open) return;
    const today = new Date();
    setName(sprint.name);
    setGoal(sprint.goal);
    setCapacity(capacityDraft(sprint, issues));
    setStart(sprint.startDate ?? (starting ? isoDay(today) : ''));
    setEnd(
      sprint.endDate ?? (starting ? isoDay(new Date(today.getTime() + 13 * 24 * 3600 * 1000)) : ''),
    );
  }, [open, sprint, starting, issues]);

  const save = useMutation({
    mutationFn: async () => {
      const path = { params: { path: { id: sprint.id } } };
      await unwrap(
        client.PATCH('/api/v1/sprints/{id}', {
          ...path,
          body: {
            name,
            goal,
            startDate: start || null,
            endDate: end || null,
            capacity: capacityRequest(capacity),
          },
        }),
      );
      if (starting) {
        await unwrap(
          client.POST('/api/v1/sprints/{id}/start', {
            ...path,
            body: { startDate: start, endDate: end },
          }),
        );
      }
    },
    onSuccess: () => {
      onDone();
      onOpenChange(false);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={starting ? t('sprints.startTitle') : t('sprints.editTitle')}
      width={480}
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {save.error && <FormError message={save.error.message} />}
        <TextField
          label={t('sprints.name')}
          value={name}
          required
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label={t('sprints.start')}
            type="date"
            value={start}
            required={starting}
            onChange={(event) => setStart(event.target.value)}
          />
          <TextField
            label={t('sprints.end')}
            type="date"
            value={end}
            required={starting}
            min={start || undefined}
            onChange={(event) => setEnd(event.target.value)}
          />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="tl-label text-[var(--ink-muted)]">{t('sprints.goal')}</span>
          <textarea
            value={goal}
            rows={2}
            maxLength={1000}
            onChange={(event) => setGoal(event.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 py-1.5"
          />
        </label>
        <CapacityFields draft={capacity} onChange={setCapacity} estimation={estimation} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {starting ? t('sprints.startAction') : t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Closes the active sprint; unfinished issues go to the backlog or a sprint (T-SPR-03). */
export function CompleteSprintDialog({
  sprint,
  issues,
  planned,
  doneStatusIds,
  open,
  onOpenChange,
}: {
  sprint: Sprint;
  issues: IssueSummary[];
  planned: Sprint[];
  doneStatusIds: Set<string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState('backlog');
  useEffect(() => {
    if (open) setTarget('backlog');
  }, [open]);
  const finished = issues.filter((issue) => doneStatusIds.has(issue.status.id)).length;
  const open_ = issues.length - finished;

  const complete = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/sprints/{id}/complete', {
          params: { path: { id: sprint.id } },
          body: { moveTo: target },
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['board', sprint.boardId] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('sprints.completeTitle', { name: sprint.name })}
      width={480}
    >
      <div className="flex flex-col gap-4">
        {complete.error && <FormError message={complete.error.message} />}
        <p className="m-0">{t('sprints.completeSummary', { done: finished, open: open_ })}</p>
        {open_ > 0 && (
          <label className="flex flex-col gap-1.5">
            <span className="tl-label text-[var(--ink-muted)]">{t('sprints.moveOpenTo')}</span>
            <select
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              className="h-[var(--control-md)] rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2"
            >
              <option value="backlog">{t('sprints.backlog')}</option>
              <option value="new">{t('sprints.newSprint')}</option>
              {planned.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={complete.isPending} onClick={() => complete.mutate()}>
            {t('sprints.complete')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
