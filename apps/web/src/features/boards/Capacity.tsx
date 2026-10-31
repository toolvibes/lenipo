import type { EstimationField, IssueSummary, Sprint, UserRef } from '@tasklore/shared';
import { useTranslation } from 'react-i18next';

/** What one issue adds to a sprint, in the board's unit: points, hours or one issue. */
export function loadOf(issue: IssueSummary, estimation: EstimationField): number {
  if (estimation === 'issueCount') return 1;
  if (estimation === 'originalEstimate') {
    return (issue.timeTracking.originalEstimateSeconds ?? 0) / 3600;
  }
  return issue.storyPoints ?? 0;
}

const round = (value: number) => Math.round(value * 10) / 10;

/** The capacity of a sprint: the team total, or the sum of the people's capacities. */
export function teamCapacity(sprint: Sprint): number | null {
  if (sprint.capacity.total !== null) return sprint.capacity.total;
  if (sprint.capacity.people.length === 0) return null;
  return sprint.capacity.people.reduce((sum, entry) => sum + entry.value, 0);
}

function Bar({ load, capacity }: { load: number; capacity: number }) {
  const over = load > capacity;
  const share = capacity > 0 ? Math.min(1, load / capacity) : 1;
  return (
    <span
      aria-hidden
      className="relative inline-block h-1.5 w-20 overflow-hidden rounded-full bg-[var(--border)]"
    >
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${share * 100}%`,
          backgroundColor: over ? 'var(--danger)' : 'var(--accent)',
        }}
      />
    </span>
  );
}

/**
 * Load against capacity of a sprint and per person (T-SPR-05, E-113); over capacity in the
 * danger colour, with the numbers as text so colour is never the only signal.
 */
export function CapacitySummary({
  sprint,
  issues,
  estimation,
}: {
  sprint: Sprint;
  issues: IssueSummary[];
  estimation: EstimationField;
}) {
  const { t } = useTranslation();
  const capacity = teamCapacity(sprint);
  if (capacity === null) return null;
  const unit = t(`capacity.units.${estimation}`);
  const load = issues.reduce((sum, issue) => sum + loadOf(issue, estimation), 0);
  const people = new Map<string, { user: UserRef | null; load: number; capacity: number | null }>();
  for (const entry of sprint.capacity.people) {
    people.set(entry.user.id, { user: entry.user, load: 0, capacity: entry.value });
  }
  for (const issue of issues) {
    const key = issue.assignee?.id ?? '';
    const row = people.get(key) ?? { user: issue.assignee, load: 0, capacity: null };
    row.load += loadOf(issue, estimation);
    people.set(key, row);
  }
  const rows = [...people.values()].sort((a, b) =>
    (a.user?.displayName ?? '￿').localeCompare(b.user?.displayName ?? '￿'),
  );
  const over = load > capacity;
  return (
    <details className="text-xs text-[var(--ink-muted)]">
      <summary className="flex cursor-pointer list-none items-center gap-1.5">
        <Bar load={load} capacity={capacity} />
        <span className={over ? 'font-semibold text-[var(--danger)]' : ''}>
          {t('capacity.load', { load: round(load), capacity: round(capacity), unit })}
        </span>
      </summary>
      <table className="mt-1.5 border-collapse">
        <tbody>
          {rows.map((row) => {
            const tooMuch = row.capacity !== null && row.load > row.capacity;
            return (
              <tr key={row.user?.id ?? 'unassigned'}>
                <td className="py-0.5 pr-3">{row.user?.displayName ?? t('capacity.unassigned')}</td>
                <td className="py-0.5 pr-2">
                  {row.capacity !== null && <Bar load={row.load} capacity={row.capacity} />}
                </td>
                <td className={`py-0.5 ${tooMuch ? 'font-semibold text-[var(--danger)]' : ''}`}>
                  {row.capacity !== null
                    ? t('capacity.load', {
                        load: round(row.load),
                        capacity: round(row.capacity),
                        unit,
                      })
                    : `${round(row.load)} ${unit}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </details>
  );
}

export interface CapacityDraft {
  total: string;
  people: Array<{ user: UserRef; value: string }>;
}

/** The people to plan: those with a capacity already and everyone assigned in the sprint. */
export function capacityDraft(sprint: Sprint, issues: IssueSummary[]): CapacityDraft {
  const people = sprint.capacity.people.map((entry) => ({
    user: entry.user,
    value: String(entry.value),
  }));
  for (const issue of issues) {
    if (issue.assignee && !people.some((entry) => entry.user.id === issue.assignee?.id)) {
      people.push({ user: issue.assignee, value: '' });
    }
  }
  return {
    total: sprint.capacity.total === null ? '' : String(sprint.capacity.total),
    people: people.sort((a, b) => a.user.displayName.localeCompare(b.user.displayName)),
  };
}

export function capacityRequest(draft: CapacityDraft) {
  const number = (text: string) => (text.trim() === '' ? null : Number(text.replace(',', '.')));
  return {
    total: number(draft.total),
    people: draft.people.flatMap((entry) => {
      const value = number(entry.value);
      return value === null || Number.isNaN(value) ? [] : [{ userId: entry.user.id, value }];
    }),
  };
}

/** Team total and a value per person, in the board's unit. */
export function CapacityFields({
  draft,
  onChange,
  estimation,
}: {
  draft: CapacityDraft;
  onChange: (draft: CapacityDraft) => void;
  estimation: EstimationField;
}) {
  const { t } = useTranslation();
  const unit = t(`capacity.units.${estimation}`);
  const input =
    'h-[var(--control-sm)] w-20 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-right';
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend className="tl-label mb-1 text-[var(--ink-muted)]">
        {t('capacity.title', { unit })}
      </legend>
      <label className="flex items-center gap-2">
        <span className="flex-1">{t('capacity.team')}</span>
        <input
          type="number"
          min={0}
          step="any"
          value={draft.total}
          placeholder={t('capacity.sumOfPeople')}
          onChange={(event) => onChange({ ...draft, total: event.target.value })}
          className={input}
        />
      </label>
      {draft.people.map((entry, index) => (
        <label key={entry.user.id} className="flex items-center gap-2">
          <span className="flex-1">{entry.user.displayName}</span>
          <input
            type="number"
            min={0}
            step="any"
            value={entry.value}
            onChange={(event) =>
              onChange({
                ...draft,
                people: draft.people.map((other, position) =>
                  position === index ? { ...other, value: event.target.value } : other,
                ),
              })
            }
            className={input}
          />
        </label>
      ))}
      {draft.people.length === 0 && (
        <p className="m-0 text-xs text-[var(--ink-muted)]">{t('capacity.noPeople')}</p>
      )}
    </fieldset>
  );
}
