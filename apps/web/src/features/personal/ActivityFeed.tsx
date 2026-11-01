import { Link } from '@tanstack/react-router';
import type { ActivityEntry } from '@toolvibes/shared';
import { useTranslation } from 'react-i18next';
import { formatDateTime, formatRelative } from '../../lib/format';
import { useFieldLabel } from '../tracking/fieldLabel';
import { Avatar } from '../tracking/UserPicker';

/** "Mira Kaya hat WEB-1 kommentiert" plus what changed, in the UI language. */
function useEntryText() {
  const { t } = useTranslation();
  const label = useFieldLabel();
  return (entry: ActivityEntry) => {
    const actor = entry.actor?.displayName ?? t('notifications.someone');
    const changes = entry.items
      .map((item) =>
        item.field === 'description'
          ? t('issues.descriptionChanged')
          : `${label.name(item.field)}: ${t('issues.changedFrom', {
              from: label.value(item.field, item.from),
              to: label.value(item.field, item.to),
            })}`,
      )
      .join(' · ');
    return {
      verb: t(`activity.${entry.kind}`, { actor }),
      detail: entry.kind === 'commented' ? (entry.excerpt ?? null) : changes || null,
    };
  };
}

/**
 * A list of activity entries (P-GEN-01); `showProject` adds the project to each line,
 * `compact` drops the details for narrow columns.
 */
export function ActivityFeed({
  entries,
  showProject = true,
  compact = false,
}: {
  entries: ActivityEntry[];
  showProject?: boolean;
  compact?: boolean;
}) {
  const text = useEntryText();
  return (
    <ol
      className={`m-0 flex list-none flex-col gap-3 p-0 ${compact ? 'text-[13px] leading-[1.45]' : ''}`}
    >
      {entries.map((entry) => {
        const { verb, detail } = text(entry);
        return (
          <li key={entry.id} className="flex gap-3">
            {entry.actor ? (
              <Avatar user={entry.actor} size={compact ? 24 : 28} />
            ) : (
              <span className={`${compact ? 'size-6' : 'size-7'} shrink-0`} aria-hidden />
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
              {detail && !compact && (
                <span className="line-clamp-2 text-[var(--ink-muted)]">{detail}</span>
              )}
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
