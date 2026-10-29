import { Link } from '@tanstack/react-router';
import type { ActivityEntry } from '@tasklore/shared';
import { useTranslation } from 'react-i18next';
import { formatDateTime, formatRelative } from '../../lib/format';
import { Avatar } from '../tracking/UserPicker';

/** "Mira Kaya hat WEB-1 kommentiert" plus what changed, in the UI language. */
function useEntryText() {
  const { t } = useTranslation();
  return (entry: ActivityEntry) => {
    const actor = entry.actor?.displayName ?? t('notifications.someone');
    const changes = entry.items
      .map((item) =>
        item.field === 'description'
          ? t('issues.descriptionChanged')
          : `${t(`issues.field.${item.field}` as never)}: ${t('issues.changedFrom', {
              from: item.from ?? t('issues.none'),
              to: item.to ?? t('issues.none'),
            })}`,
      )
      .join(' · ');
    return {
      verb: t(`activity.${entry.kind}`, { actor }),
      detail: entry.kind === 'commented' ? (entry.excerpt ?? null) : changes || null,
    };
  };
}

/** A list of activity entries (P-GEN-01); `showProject` adds the project to each line. */
export function ActivityFeed({
  entries,
  showProject = true,
}: {
  entries: ActivityEntry[];
  showProject?: boolean;
}) {
  const text = useEntryText();
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0">
      {entries.map((entry) => {
        const { verb, detail } = text(entry);
        return (
          <li key={entry.id} className="flex gap-3">
            {entry.actor ? (
              <Avatar user={entry.actor} size={28} />
            ) : (
              <span className="size-7 shrink-0" aria-hidden />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="min-w-0">
                {verb}{' '}
                <Link
                  to="/issues/$key"
                  params={{ key: entry.issue.key }}
                  className="text-[var(--ink)] no-underline hover:underline"
                >
                  <span className="tl-key">{entry.issue.key}</span> {entry.issue.summary}
                </Link>
              </span>
              {detail && <span className="line-clamp-2 text-[var(--ink-muted)]">{detail}</span>}
              <span className="text-xs text-[var(--ink-muted)]">
                <span title={formatDateTime(entry.at)}>{formatRelative(entry.at)}</span>
                {showProject && ` · ${entry.project.name}`}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
