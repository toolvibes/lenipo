import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { IssueSummary, Me } from '@tasklore/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTime, formatRelative } from '../../lib/format';
import { notificationsByCategoryQuery } from '../../lib/notifications';
import { activityQuery, recentQuery } from '../../lib/personal';
import { searchQuery } from '../../lib/search';
import { ActivityFeed } from '../personal/ActivityFeed';
import { IssueTypeIcon, PriorityIcon, StatusLozenge } from '../tracking/icons';

/** The TQL behind each section, so "show all" opens exactly the same list (E-46). */
const ASSIGNED = 'assignee = currentUser() AND resolution is EMPTY ORDER BY priority, updated DESC';
const WATCHED = 'watcher = currentUser() AND resolution is EMPTY ORDER BY updated DESC';
const SHOWN = 8;

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="flex min-w-0 flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="tl-heading-md">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="m-0 text-[var(--ink-muted)]">{children}</p>;
}

/** Compact issue lines for the narrow home page columns. */
function IssueLines({ issues }: { issues: IssueSummary[] }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {issues.map((issue) => (
        <li
          key={issue.id}
          className="flex min-h-9 items-center gap-2 border-b border-[var(--border)] last:border-b-0"
        >
          <IssueTypeIcon type={issue.issueType} />
          <PriorityIcon priority={issue.priority} />
          <Link
            to="/issues/$key"
            params={{ key: issue.key }}
            className="min-w-0 flex-1 truncate text-[var(--ink)] no-underline hover:underline"
          >
            <span className="tl-key">{issue.key}</span> {issue.summary}
          </Link>
          <StatusLozenge status={issue.status} />
        </li>
      ))}
    </ul>
  );
}

function ShowAll({ query, total }: { query: string; total: number }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/issues"
      search={{ q: query }}
      className="text-xs text-[var(--ink-muted)] hover:underline"
    >
      {t('home.showAll', { count: total })}
    </Link>
  );
}

/** Personal start page (T-DSH-04): assigned, mentioned, recently viewed, watched, activity. */
export function HomePage({ me }: { me: Me }) {
  const { t } = useTranslation();
  const assigned = useQuery(searchQuery(ASSIGNED, 0));
  const watched = useQuery(searchQuery(WATCHED, 0));
  const mentions = useQuery(notificationsByCategoryQuery('mention', 5));
  const recent = useQuery(recentQuery(SHOWN));
  const activity = useInfiniteQuery(activityQuery({}, 10));
  const activityEntries = activity.data?.pages[0]?.entries ?? [];

  return (
    <main className="flex flex-col gap-4 px-6 py-5">
      <header className="flex flex-col gap-1">
        <h1 className="tl-heading-xl">{t('home.title')}</h1>
        <p className="m-0 text-[var(--ink-muted)]">
          {t('home.greeting', { name: me.displayName })}
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title={t('home.assigned')}
          action={assigned.data && <ShowAll query={ASSIGNED} total={assigned.data.total} />}
        >
          {assigned.data?.total === 0 && <Empty>{t('home.assignedEmpty')}</Empty>}
          {assigned.data && <IssueLines issues={assigned.data.issues.slice(0, SHOWN)} />}
        </Section>

        <Section title={t('home.mentioned')}>
          {mentions.data?.notifications.length === 0 && <Empty>{t('home.mentionedEmpty')}</Empty>}
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {mentions.data?.notifications.map((mention) => (
              <li key={mention.id} className="flex min-w-0 flex-col">
                {mention.page ? (
                  <Link
                    to="/spaces/$key/pages/$id"
                    params={{ key: mention.page.spaceKey, id: mention.page.id }}
                    className="truncate text-[var(--ink)] no-underline hover:underline"
                  >
                    <span className="tl-key">{mention.page.spaceKey}</span> {mention.page.title}
                  </Link>
                ) : (
                  mention.issue && (
                    <Link
                      to="/issues/$key"
                      params={{ key: mention.issue.key }}
                      className="truncate text-[var(--ink)] no-underline hover:underline"
                    >
                      <span className="tl-key">{mention.issue.key}</span> {mention.issue.summary}
                    </Link>
                  )
                )}
                <span className="truncate text-xs text-[var(--ink-muted)]">
                  {mention.actor?.displayName} ·{' '}
                  <span title={formatDateTime(mention.createdAt)}>
                    {formatRelative(mention.createdAt)}
                  </span>
                  {mention.details.excerpt && ` · ${mention.details.excerpt}`}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={t('home.recent')}>
          {recent.data?.length === 0 && <Empty>{t('home.recentEmpty')}</Empty>}
          <ul className="m-0 flex list-none flex-col p-0">
            {recent.data?.map((item) => (
              <li
                key={`${item.kind}:${item.ref}`}
                className="flex min-h-9 items-center gap-2 border-b border-[var(--border)] last:border-b-0"
              >
                {item.kind === 'issue' && item.issue ? (
                  <>
                    <IssueTypeIcon type={item.issue.issueType} />
                    <Link
                      to="/issues/$key"
                      params={{ key: item.ref }}
                      className="min-w-0 flex-1 truncate text-[var(--ink)] no-underline hover:underline"
                    >
                      <span className="tl-key">{item.ref}</span> {item.name}
                    </Link>
                    <StatusLozenge status={item.issue.status} />
                  </>
                ) : item.kind === 'project' ? (
                  <Link
                    to="/projects/$key"
                    params={{ key: item.ref }}
                    className="min-w-0 flex-1 truncate text-[var(--ink)] no-underline hover:underline"
                  >
                    {item.name}{' '}
                    <span className="text-xs text-[var(--ink-muted)]">{t('home.project')}</span>
                  </Link>
                ) : item.kind === 'space' ? (
                  <Link
                    to="/spaces/$key"
                    params={{ key: item.ref }}
                    className="min-w-0 flex-1 truncate text-[var(--ink)] no-underline hover:underline"
                  >
                    {item.name}{' '}
                    <span className="text-xs text-[var(--ink-muted)]">{t('home.space')}</span>
                  </Link>
                ) : (
                  <Link
                    to="/spaces/$key/pages/$id"
                    params={{ key: item.spaceKey ?? '', id: item.ref }}
                    className="min-w-0 flex-1 truncate text-[var(--ink)] no-underline hover:underline"
                  >
                    {item.name}{' '}
                    <span className="text-xs text-[var(--ink-muted)]">{t('home.page')}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title={t('home.watched')}
          action={watched.data && <ShowAll query={WATCHED} total={watched.data.total} />}
        >
          {watched.data?.total === 0 && <Empty>{t('home.watchedEmpty')}</Empty>}
          {watched.data && <IssueLines issues={watched.data.issues.slice(0, SHOWN)} />}
        </Section>
      </div>

      <Section
        title={t('home.activity')}
        action={
          <Link
            to="/activity"
            search={{}}
            className="text-xs text-[var(--ink-muted)] hover:underline"
          >
            {t('home.allActivity')}
          </Link>
        }
      >
        {activity.data && activityEntries.length === 0 && <Empty>{t('activity.empty')}</Empty>}
        <ActivityFeed entries={activityEntries} />
      </Section>
    </main>
  );
}
