import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ESTIMATE_CARDS, type EstimateCard, type Estimation } from '@toolvibes/shared';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';

/** The middle of the numeric cards; "?" and coffee do not count. */
export function median(values: Array<EstimateCard | null>): number | null {
  const numbers = values
    .filter((value): value is EstimateCard => value !== null && value !== '?' && value !== 'coffee')
    .map(Number)
    .sort((a, b) => a - b);
  if (numbers.length === 0) return null;
  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2 === 1
    ? (numbers[middle] ?? null)
    : ((numbers[middle - 1] ?? 0) + (numbers[middle] ?? 0)) / 2;
}

const CARD =
  'grid h-11 min-w-9 place-items-center rounded-[var(--radius-md)] border px-1.5 text-sm font-semibold';

/**
 * Planning poker on the issue page (TL-51, E-134): cards stay face down until someone who may
 * edit the issue reveals them; the median becomes the story points with one click.
 */
export function PlanningPoker({
  issueKey,
  canEdit,
  onApply,
}: {
  issueKey: string;
  canEdit: boolean;
  onApply: (points: number) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ['issue', issueKey, 'estimation'];
  const path = { params: { path: { key: issueKey } } };
  const state = useQuery({
    queryKey,
    queryFn: () => unwrap(client.GET('/api/v1/issues/{key}/estimation', path)),
  });
  const settle = (round: Estimation | null) => queryClient.setQueryData(queryKey, { round });
  const start = useMutation({
    mutationFn: () => unwrap(client.POST('/api/v1/issues/{key}/estimation', path)),
    onSuccess: settle,
  });
  const vote = useMutation({
    mutationFn: (value: EstimateCard) =>
      unwrap(client.PUT('/api/v1/issues/{key}/estimation/vote', { ...path, body: { value } })),
    onSuccess: settle,
  });
  const reveal = useMutation({
    mutationFn: () => unwrap(client.POST('/api/v1/issues/{key}/estimation/reveal', path)),
    onSuccess: settle,
  });
  const end = useMutation({
    mutationFn: () => unwrap(client.DELETE('/api/v1/issues/{key}/estimation', path)),
    onSuccess: () => settle(null),
  });
  const error = start.error ?? vote.error ?? reveal.error ?? end.error;
  const round = state.data?.round ?? null;
  const label = (value: EstimateCard) => (value === 'coffee' ? '☕' : value);

  if (!round) {
    if (!canEdit) return null;
    return (
      <section aria-label={t('poker.title')} className="flex flex-col gap-1.5 text-[13px]">
        <h3 className="tl-label m-0 text-[var(--ink-muted)]">{t('poker.title')}</h3>
        <div>
          <Button size="sm" onClick={() => start.mutate()} disabled={start.isPending}>
            {t('poker.start')}
          </Button>
        </div>
        {error && <FormError message={error.message} />}
      </section>
    );
  }

  const result = round.revealed ? median(round.votes.map((entry) => entry.value)) : null;
  return (
    <section aria-label={t('poker.title')} className="flex flex-col gap-2 text-[13px]">
      <h3 className="tl-label m-0 text-[var(--ink-muted)]">{t('poker.title')}</h3>
      {error && <FormError message={error.message} />}
      {!round.revealed && (
        <fieldset className="m-0 flex flex-wrap gap-1.5 border-0 p-0">
          <legend className="sr-only">{t('poker.choose')}</legend>
          {ESTIMATE_CARDS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={round.mine === value}
              aria-label={value === 'coffee' ? t('poker.coffee') : value}
              onClick={() => vote.mutate(value)}
              disabled={vote.isPending}
              className={`${CARD} ${
                round.mine === value
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]'
                  : 'border-[var(--border-strong)] bg-[var(--surface-1)] text-[var(--ink)] hover:border-[var(--accent)]'
              }`}
            >
              {label(value)}
            </button>
          ))}
        </fieldset>
      )}
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {round.votes.length === 0 && (
          <li className="text-[var(--ink-muted)]">{t('poker.noVotes')}</li>
        )}
        {round.votes.map((entry) => (
          <li key={entry.user.id} className="flex justify-between gap-2">
            <span className="truncate">{entry.user.displayName}</span>
            <span className="font-semibold">
              {entry.value ? label(entry.value) : t('poker.voted')}
            </span>
          </li>
        ))}
      </ul>
      {round.revealed && (
        <p className="m-0">
          {result === null ? t('poker.noResult') : t('poker.median', { value: result })}
        </p>
      )}
      {round.canManage && (
        <div className="flex flex-wrap gap-1.5">
          {!round.revealed && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => reveal.mutate()}
              disabled={reveal.isPending || round.votes.length === 0}
            >
              {t('poker.reveal')}
            </Button>
          )}
          {round.revealed && result !== null && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                onApply(result);
                end.mutate();
              }}
            >
              {t('poker.apply', { value: result })}
            </Button>
          )}
          {round.revealed && (
            <Button size="sm" onClick={() => start.mutate()} disabled={start.isPending}>
              {t('poker.again')}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => end.mutate()} disabled={end.isPending}>
            {t('poker.end')}
          </Button>
        </div>
      )}
    </section>
  );
}
