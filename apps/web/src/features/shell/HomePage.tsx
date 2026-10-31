import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { IssueSummary, Me } from '@tasklore/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { formatDate, formatDateTime, formatRelative } from '../../lib/format';
import { notificationsByCategoryQuery } from '../../lib/notifications';
import { activityQuery, recentQuery } from '../../lib/personal';
import { searchQuery } from '../../lib/search';
import { ActivityFeed } from '../personal/ActivityFeed';
import { IssueTypeIcon, StatusLozenge } from '../tracking/icons';

/** The TQL behind each section, so "show all" opens exactly the same list (E-46). */
const ASSIGNED = 'assignee = currentUser() AND resolution is EMPTY ORDER BY priority, updated DESC';
const WATCHED = 'watcher = currentUser() AND resolution is EMPTY ORDER BY updated DESC';
const DUE = 'assignee = currentUser() AND resolution is EMPTY AND due <= endOfWeek()';
const SHOWN = 8;

const LINK = 'text-[13px] font-medium text-[var(--accent)] no-underline hover:underline';

function Card({
  title,
  action,
  flush = false,
  children,
}: {
  title: string;
  action?: ReactNode;
  /** Rows reach the card edges, the header gets its own divider (tables). */
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={`flex min-w-0 flex-col rounded-lg border border-[var(--border)] bg-[var(--surface-1)] ${
        flush ? '' : 'gap-3 px-5 py-4'
      }`}
    >
      <div
        className={`flex items-baseline justify-between gap-2 ${
          flush ? 'border-b border-[var(--border)] px-5 py-3.5' : ''
        }`}
      >
        <h2 className="m-0 text-[15px] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="m-0 px-0 text-[13px] text-[var(--ink-muted)]">{children}</p>;
}

/** Issue rows like the 1a task table: type, key, summary, status, due date. */
export function IssueTable({ issues }: { issues: IssueSummary[] }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {issues.map((issue) => (
        <li
          key={issue.id}
          className="grid grid-cols-[16px_70px_minmax(0,1fr)_auto_64px] items-center gap-2.5 border-b border-[var(--border)] px-5 py-2.5 text-[13.5px] last:border-b-0"
        >
          <IssueTypeIcon type={issue.issueType} />
          <span className="tl-key">{issue.key}</span>
          <Link
            to="/issues/$key"
            params={{ key: issue.key }}
            className="truncate text-[var(--ink)] no-underline hover:underline"
          >
            {issue.summary}
          </Link>
          <StatusLozenge status={issue.status} />
          <span className="text-right text-[12.5px] text-[var(--ink-muted)]">
            {issue.dueDate && formatDate(issue.dueDate)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ShowAll({ query, total }: { query: string; total: number }) {
  const { t } = useTranslation();
  return (
    <Link to="/issues" search={{ q: query }} className={LINK}>
      {t('home.showAll', { count: total })}
    </Link>
  );
}

/** Progress of the active sprint the user works in, by status category (1a "Sprint" card). */
function SprintCard({ issue }: { issue: IssueSummary }) {
  const { t } = useTranslation();
  const sprint = `project = ${issue.project.key} AND sprint = "${issue.sprint?.name ?? ''}"`;
  const done = useQuery(searchQuery(`${sprint} AND statusCategory = done`, 0));
  const progress = useQuery(searchQuery(`${sprint} AND statusCategory = in_progress`, 0));
  const todo = useQuery(searchQuery(`${sprint} AND statusCategory = todo`, 0));
  const parts = [
    { label: t('home.done'), count: done.data?.total, color: 'var(--success)' },
    { label: t('home.inProgress'), count: progress.data?.total, color: 'var(--accent)' },
    { label: t('home.todo'), count: todo.data?.total, color: 'var(--border-control)' },
  ];
  const total = parts.reduce((sum, part) => sum + (part.count ?? 0), 0);
  return (
    <Card
      title={`${issue.project.name} · ${issue.sprint?.name}`}
      action={
        <Link to="/issues" search={{ q: `${sprint} ORDER BY rank` }} className={LINK}>
          {t('home.sprintIssues')}
        </Link>
      }
    >
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-[3px] bg-[var(--surface-2)]">
        {total > 0 &&
          parts.map(
            (part) =>
              (part.count ?? 0) > 0 && (
                <div
                  key={part.label}
                  style={{ flexGrow: part.count, background: part.color }}
                  aria-hidden
                />
              ),
          )}
      </div>
      <div className="flex flex-wrap gap-5 text-[12.5px] text-[var(--ink-muted)]">
        {parts.map((part) => (
          <span key={part.label} className="flex items-center gap-1.5">
            <span className="size-2 rounded-[2px]" style={{ background: part.color }} aria-hidden />
            {part.label}{' '}
            <span className="font-[family-name:var(--font-mono)]">{part.count ?? '–'}</span>
          </span>
        ))}
      </div>
    </Card>
  );
}

function greetingKey(hour: number): 'home.morning' | 'home.day' | 'home.evening' {
  if (hour < 11) return 'home.morning';
  if (hour < 18) return 'home.day';
  return 'home.evening';
}

/** Personal start page (T-DSH-04) in the 1a layout: tasks and sprint left, Lore and activity right. */
export function HomePage({ me }: { me: Me }) {
  const { t } = useTranslation();
  const assigned = useQuery(searchQuery(ASSIGNED, 0));
  const due = useQuery(searchQuery(DUE, 0));
  const watched = useQuery(searchQuery(WATCHED, 0));
  const mentions = useQuery(notificationsByCategoryQuery('mention', 5));
  const recent = useQuery(recentQuery(20));
  const activity = useInfiniteQuery(activityQuery({}, 6));
  const activityEntries = activity.data?.pages[0]?.entries ?? [];
  const pages = recent.data?.filter((item) => item.kind === 'page').slice(0, 4);
  const inSprint = assigned.data?.issues.find((issue) => issue.sprint?.state === 'active');
  const now = new Date();
  const today = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now);

  return (
    <main className="flex flex-col gap-6 px-9 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-[24px] leading-8 font-semibold tracking-[-0.02em]">
          {t(greetingKey(now.getHours()), { name: me.displayName.split(' ')[0] ?? me.displayName })}
        </h1>
        <p className="m-0 text-sm text-[var(--ink-muted)]">
          {today}
          {due.data &&
            ` · ${due.data.total > 0 ? t('home.dueThisWeek', { count: due.data.total }) : t('home.nothingDue')}`}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          {inSprint && <SprintCard issue={inSprint} />}

          <Card
            title={t('home.assigned')}
            flush
            action={assigned.data && <ShowAll query={ASSIGNED} total={assigned.data.total} />}
          >
            {assigned.data?.total === 0 && (
              <div className="px-5 py-4">
                <Empty>{t('home.assignedEmpty')}</Empty>
              </div>
            )}
            {assigned.data && <IssueTable issues={assigned.data.issues.slice(0, SHOWN)} />}
          </Card>

          <Card
            title={t('home.watched')}
            flush
            action={watched.data && <ShowAll query={WATCHED} total={watched.data.total} />}
          >
            {watched.data?.total === 0 && (
              <div className="px-5 py-4">
                <Empty>{t('home.watchedEmpty')}</Empty>
              </div>
            )}
            {watched.data && <IssueTable issues={watched.data.issues.slice(0, 5)} />}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Card title={t('home.lore')}>
            {pages?.length === 0 && <Empty>{t('home.loreEmpty')}</Empty>}
            {pages?.map((page) => (
              <div key={page.ref} className="flex min-w-0 flex-col gap-0.5">
                <Link
                  to="/spaces/$key/pages/$id"
                  params={{ key: page.spaceKey ?? '', id: page.ref }}
                  className="truncate font-[family-name:var(--font-prose)] text-base font-medium text-[var(--ink)] no-underline hover:underline"
                >
                  {page.name}
                </Link>
                <span className="text-xs text-[var(--ink-muted)]">
                  <span className="tl-key">{page.spaceKey}</span> ·{' '}
                  <span title={formatDateTime(page.viewedAt)}>{formatRelative(page.viewedAt)}</span>
                </span>
              </div>
            ))}
          </Card>

          <Card title={t('home.mentioned')}>
            {mentions.data?.notifications.length === 0 && <Empty>{t('home.mentionedEmpty')}</Empty>}
            {mentions.data?.notifications.map((mention) => (
              <div key={mention.id} className="flex min-w-0 flex-col gap-0.5 text-[13px]">
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
              </div>
            ))}
          </Card>

          <Card
            title={t('home.activity')}
            action={
              <Link to="/activity" search={{}} className={LINK}>
                {t('home.allActivity')}
              </Link>
            }
          >
            {activity.data && activityEntries.length === 0 && <Empty>{t('activity.empty')}</Empty>}
            <ActivityFeed entries={activityEntries} compact />
          </Card>
        </div>
      </div>
    </main>
  );
}
