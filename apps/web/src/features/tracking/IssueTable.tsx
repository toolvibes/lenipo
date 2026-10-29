import { ArrowDown, ArrowUp } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';
import { DEFAULT_ISSUE_COLUMNS, type IssueColumn, type IssueSummary } from '@tasklore/shared';
import { findField, type SortKey } from '@tasklore/tql';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatDateTime, formatRelative } from '../../lib/format';
import { IssueTypeIcon, PriorityIcon, StatusLozenge, useMetaName } from './icons';
import { useDuration } from './TimeTracking';
import { Avatar } from './UserPicker';

type Column = 'key' | 'summary' | IssueColumn;

const WIDTH: Partial<Record<Column, string>> = {
  key: 'w-28',
  issuetype: 'w-32',
  status: 'w-36',
  priority: 'w-28',
  assignee: 'w-44',
  reporter: 'w-44',
  created: 'w-32',
  updated: 'w-32',
  due: 'w-28',
  resolution: 'w-32',
  labels: 'w-40',
  component: 'w-40',
  storyPoints: 'w-24',
  originalEstimate: 'w-28',
  remainingEstimate: 'w-28',
  timeSpent: 'w-28',
};

const NUMERIC = new Set<Column>([
  'storyPoints',
  'originalEstimate',
  'remainingEstimate',
  'timeSpent',
]);

function Person({ user, none }: { user: IssueSummary['assignee']; none: string }) {
  if (!user) return <span className="text-[var(--ink-muted)]">{none}</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar user={user} size={20} />
      <span className="truncate">{user.displayName}</span>
    </span>
  );
}

function Chips({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="text-[var(--ink-muted)]">–</span>;
  return (
    <span className="flex min-w-0 gap-1 overflow-hidden" title={names.join(', ')}>
      {names.map((name) => (
        <span
          key={name}
          className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-1.5 text-xs font-semibold"
        >
          {name}
        </span>
      ))}
    </span>
  );
}

function When({ iso }: { iso: string }) {
  return (
    <span className="text-[var(--ink-muted)]" title={formatDateTime(iso)}>
      {formatRelative(iso)}
    </span>
  );
}

/** One header cell; a button sorts by its field when the list can be sorted (E-48). */
function Header({
  column,
  sort,
  onSort,
}: {
  column: Column;
  sort?: SortKey | null;
  onSort?: (field: string) => void;
}) {
  const { t } = useTranslation();
  const label = t(`issues.columns.${column}`);
  const sorted = sort?.field === column ? sort.direction : null;
  const sortable = onSort && findField(column)?.orderable;
  const Arrow = sorted === 'desc' ? ArrowDown : ArrowUp;
  return (
    <th
      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
      className={`${WIDTH[column] ?? ''} border-b border-[var(--border)] px-3 py-2 ${NUMERIC.has(column) ? 'text-right' : ''}`}
    >
      {sortable ? (
        <button
          type="button"
          onClick={() => onSort(column)}
          title={t('issues.sortBy', { column: label })}
          className={`inline-flex items-center gap-1 uppercase hover:text-[var(--ink)] ${sorted ? 'text-[var(--ink)]' : ''}`}
        >
          {label}
          {sorted && <Arrow size={12} weight="bold" aria-hidden />}
        </button>
      ) : (
        label
      )}
    </th>
  );
}

/**
 * Issue list (design: list view). Key and summary always show; `columns` adds more (T-QRY-08).
 * `empty` is shown for an empty list; pass null while the list is still loading.
 */
export function IssueTable({
  issues,
  empty,
  columns = DEFAULT_ISSUE_COLUMNS,
  sort,
  onSort,
}: {
  issues: IssueSummary[];
  empty: ReactNode | null;
  columns?: IssueColumn[];
  sort?: SortKey | null;
  onSort?: (field: string) => void;
}) {
  const { t } = useTranslation();
  const metaName = useMetaName();
  const duration = useDuration();
  const shown = new Set(columns);
  const all: Column[] = ['key', 'summary', ...columns];

  function cell(issue: IssueSummary, column: IssueColumn): ReactNode {
    switch (column) {
      case 'issuetype':
        return (
          <span className="flex items-center gap-2">
            <IssueTypeIcon type={issue.issueType} />
            <span className="truncate">{metaName('issueType', issue.issueType)}</span>
          </span>
        );
      case 'status':
        return <StatusLozenge status={issue.status} />;
      case 'priority':
        return (
          <span className="flex items-center gap-2">
            <PriorityIcon priority={issue.priority} />
            <span className="truncate">{metaName('priority', issue.priority)}</span>
          </span>
        );
      case 'assignee':
        return <Person user={issue.assignee} none={t('issues.unassigned')} />;
      case 'reporter':
        return <Person user={issue.reporter} none={t('issues.none')} />;
      case 'created':
        return <When iso={issue.createdAt} />;
      case 'updated':
        return <When iso={issue.updatedAt} />;
      case 'due':
        return issue.dueDate ? formatDate(issue.dueDate) : null;
      case 'resolution':
        return issue.resolution ? (
          metaName('resolution', issue.resolution)
        ) : (
          <span className="text-[var(--ink-muted)]">{t('issues.unresolved')}</span>
        );
      case 'labels':
        return <Chips names={issue.labels} />;
      case 'component':
        return <Chips names={issue.components.map((component) => component.name)} />;
      case 'storyPoints':
        return issue.storyPoints;
      case 'originalEstimate':
        return duration(issue.timeTracking.originalEstimateSeconds);
      case 'remainingEstimate':
        return duration(issue.timeTracking.remainingEstimateSeconds);
      case 'timeSpent':
        return issue.timeTracking.timeSpentSeconds > 0
          ? duration(issue.timeTracking.timeSpentSeconds)
          : null;
    }
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)]">
      <table
        className="w-full border-collapse"
        style={{ minWidth: `${Math.max(760, 360 + columns.length * 140)}px` }}
      >
        <thead>
          <tr className="tl-label text-left uppercase text-[var(--ink-muted)]">
            {all.map((column) => (
              <Header key={column} column={column} sort={sort} onSort={onSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.id} className="h-[var(--row-compact)] hover:bg-[var(--surface-2)]">
              <td className="border-b border-[var(--border)] px-3">
                <span className="flex items-center gap-2">
                  {!shown.has('issuetype') && <IssueTypeIcon type={issue.issueType} />}
                  <Link
                    to="/issues/$key"
                    params={{ key: issue.key }}
                    className="tl-key no-underline hover:underline"
                  >
                    {issue.key}
                  </Link>
                </span>
              </td>
              <td className="max-w-0 border-b border-[var(--border)] px-3">
                <span className="flex items-center gap-2">
                  {!shown.has('priority') && <PriorityIcon priority={issue.priority} />}
                  <Link
                    to="/issues/$key"
                    params={{ key: issue.key }}
                    className="truncate text-[var(--ink)] no-underline hover:underline"
                  >
                    {issue.summary}
                  </Link>
                  {!shown.has('storyPoints') && issue.storyPoints !== null && (
                    <span className="ml-auto shrink-0 rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-1.5 text-xs font-semibold">
                      {issue.storyPoints}
                    </span>
                  )}
                </span>
              </td>
              {columns.map((column) => (
                <td
                  key={column}
                  className={`max-w-0 border-b border-[var(--border)] px-3 ${NUMERIC.has(column) ? 'text-right tabular-nums' : ''}`}
                >
                  {cell(issue, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {issues.length === 0 && empty !== null && (
        <p className="px-3 py-8 text-center text-[var(--ink-muted)]">{empty}</p>
      )}
    </div>
  );
}
