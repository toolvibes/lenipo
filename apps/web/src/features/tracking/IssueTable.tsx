import { Link } from '@tanstack/react-router';
import type { IssueSummary } from '@tasklore/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatRelative } from '../../lib/format';
import { IssueTypeIcon, PriorityIcon, StatusLozenge } from './icons';
import { Avatar } from './UserPicker';

/**
 * Compact issue list (design: list view): key, summary, status, assignee, last update.
 * `empty` is shown for an empty list; pass null while the list is still loading.
 */
export function IssueTable({ issues, empty }: { issues: IssueSummary[]; empty: ReactNode | null }) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)]">
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr className="tl-label text-left uppercase text-[var(--ink-muted)]">
            <th className="w-28 border-b border-[var(--border)] px-3 py-2">
              {t('issues.columns.key')}
            </th>
            <th className="border-b border-[var(--border)] px-3 py-2">
              {t('issues.columns.summary')}
            </th>
            <th className="w-36 border-b border-[var(--border)] px-3 py-2">
              {t('issues.columns.status')}
            </th>
            <th className="w-44 border-b border-[var(--border)] px-3 py-2">
              {t('issues.columns.assignee')}
            </th>
            <th className="w-36 border-b border-[var(--border)] px-3 py-2">
              {t('issues.columns.updated')}
            </th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.id} className="h-[var(--row-compact)] hover:bg-[var(--surface-2)]">
              <td className="border-b border-[var(--border)] px-3">
                <span className="flex items-center gap-2">
                  <IssueTypeIcon type={issue.issueType} />
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
                  <PriorityIcon priority={issue.priority} />
                  <Link
                    to="/issues/$key"
                    params={{ key: issue.key }}
                    className="truncate text-[var(--ink)] no-underline hover:underline"
                  >
                    {issue.summary}
                  </Link>
                  {issue.storyPoints !== null && (
                    <span className="ml-auto shrink-0 rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-1.5 text-xs font-semibold">
                      {issue.storyPoints}
                    </span>
                  )}
                </span>
              </td>
              <td className="border-b border-[var(--border)] px-3">
                <StatusLozenge status={issue.status} />
              </td>
              <td className="border-b border-[var(--border)] px-3">
                {issue.assignee ? (
                  <span className="flex items-center gap-2">
                    <Avatar user={issue.assignee} size={20} />
                    <span className="truncate">{issue.assignee.displayName}</span>
                  </span>
                ) : (
                  <span className="text-[var(--ink-muted)]">{t('issues.unassigned')}</span>
                )}
              </td>
              <td className="border-b border-[var(--border)] px-3 text-[var(--ink-muted)]">
                {formatRelative(issue.updatedAt)}
              </td>
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
