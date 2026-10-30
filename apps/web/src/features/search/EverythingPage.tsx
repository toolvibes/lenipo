import { ChatCircleText, MagnifyingGlass, Paperclip } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { EverythingResult, SearchMatch, Snippet } from '@tasklore/shared';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../lib/format';
import { type EverythingType, everythingQuery } from '../../lib/search';
import { projectsQuery } from '../../lib/tracking';
import { CHIP } from '../../ui/TopBar';
import { IssueTypeIcon, StatusLozenge } from '../tracking/icons';

const TYPES: EverythingType[] = ['issue', 'page', 'project', 'space'];

function Marked({ snippet }: { snippet: Snippet }) {
  return (
    <>
      {snippet.map((part, index) => {
        const Tag = part.hit ? 'mark' : 'span';
        return (
          <Tag
            // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional
            key={index}
            className={
              part.hit
                ? 'rounded-[2px] bg-[var(--warning-soft)] px-0.5 text-[var(--ink)]'
                : undefined
            }
          >
            {part.text}
          </Tag>
        );
      })}
    </>
  );
}

/** "In a comment by …" or "Attachment …" under a result found only there (TL-3). */
function MatchNote({ match }: { match: SearchMatch }) {
  const { t } = useTranslation();
  return (
    <span className="flex min-w-0 items-baseline gap-1.5 text-[12.5px] leading-normal text-[var(--ink-muted)]">
      {match.in === 'comment' ? (
        <ChatCircleText size={13} aria-hidden className="shrink-0 self-center" />
      ) : (
        <Paperclip size={13} aria-hidden className="shrink-0 self-center" />
      )}
      <span className="shrink-0 font-semibold">
        {match.in === 'comment'
          ? t('everything.inComment', { name: match.author ?? '?' })
          : t('everything.inAttachment')}
      </span>
      <span className="min-w-0 truncate">
        <Marked snippet={match.snippet} />
      </span>
    </span>
  );
}

function Group({
  title,
  count,
  shown,
  onMore,
  children,
}: {
  title: string;
  count: number;
  shown: number;
  onMore?: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  if (count === 0) return null;
  return (
    <section aria-label={title} className="flex flex-col">
      <h2 className="tl-label m-0 pb-2 text-[var(--ink-muted)]">
        {title} · {count}
      </h2>
      {children}
      {onMore && count > shown && (
        <button
          type="button"
          onClick={onMore}
          className="mt-1 cursor-pointer self-start border-0 bg-transparent px-3.5 py-2 text-[13px] font-medium text-[var(--accent)] hover:underline"
        >
          {t('everything.more', { count })}
        </button>
      )}
    </section>
  );
}

function Results({
  data,
  type,
  onType,
}: {
  data: EverythingResult;
  type?: EverythingType;
  onType: (type: EverythingType) => void;
}) {
  const { t } = useTranslation();
  const more = (value: EverythingType) => (type ? undefined : () => onType(value));
  return (
    <div className="flex flex-col gap-[22px]">
      <Group
        title={t('everything.page')}
        count={data.counts.page}
        shown={data.pages.length}
        onMore={more('page')}
      >
        {data.pages.map((page) => (
          <Link
            key={page.id}
            to="/spaces/$key/pages/$id"
            params={{ key: page.space.key, id: page.id }}
            className="flex flex-col gap-1 rounded-[var(--radius-md)] px-3.5 py-3 text-[var(--ink)] no-underline hover:bg-[var(--surface-2)]"
          >
            <span className="font-[family-name:var(--font-prose)] text-lg font-medium">
              {page.title}
            </span>
            {page.match ? (
              <MatchNote match={page.match} />
            ) : (
              page.snippet.length > 0 && (
                <span className="text-[13.5px] leading-normal text-[var(--ink-muted)]">
                  <Marked snippet={page.snippet} />
                </span>
              )
            )}
            <span className="text-xs text-[var(--ink-muted)]">
              {[
                page.space.name,
                page.parentTitle,
                page.publishedAt && formatDate(page.publishedAt.slice(0, 10)),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </Link>
        ))}
      </Group>

      <Group
        title={t('everything.issue')}
        count={data.counts.issue}
        shown={data.issues.length}
        onMore={more('issue')}
      >
        <ul className="m-0 list-none p-0">
          {data.issues.map((issue) => (
            <li
              key={issue.id}
              className="grid grid-cols-[16px_72px_minmax(0,1fr)_auto_120px] items-center gap-3 border-b border-[var(--border)] px-3.5 py-2.5 text-[13.5px] last:border-b-0"
            >
              <IssueTypeIcon type={issue.issueType} />
              <span className="tl-key">{issue.key}</span>
              <span className="flex min-w-0 flex-col">
                <Link
                  to="/issues/$key"
                  params={{ key: issue.key }}
                  className="truncate text-[var(--ink)] no-underline hover:underline"
                >
                  {issue.summary}
                </Link>
                {issue.match && <MatchNote match={issue.match} />}
              </span>
              <StatusLozenge status={issue.status} />
              <span className="truncate text-right text-[12.5px] text-[var(--ink-muted)]">
                {issue.project.name}
              </span>
            </li>
          ))}
        </ul>
      </Group>

      <Group
        title={t('everything.project')}
        count={data.counts.project}
        shown={data.projects.length}
        onMore={more('project')}
      >
        {data.projects.map((project) => (
          <Link
            key={project.key}
            to="/projects/$key"
            params={{ key: project.key }}
            className="flex items-baseline gap-2 rounded-[var(--radius-md)] px-3.5 py-2 text-[var(--ink)] no-underline hover:bg-[var(--surface-2)]"
          >
            <span className="tl-key">{project.key}</span>
            <span className="font-medium">{project.name}</span>
            <span className="truncate text-[13px] text-[var(--ink-muted)]">
              {project.description}
            </span>
          </Link>
        ))}
      </Group>

      <Group
        title={t('everything.space')}
        count={data.counts.space}
        shown={data.spaces.length}
        onMore={more('space')}
      >
        {data.spaces.map((space) => (
          <Link
            key={space.key}
            to="/spaces/$key"
            params={{ key: space.key }}
            className="flex items-baseline gap-2 rounded-[var(--radius-md)] px-3.5 py-2 text-[var(--ink)] no-underline hover:bg-[var(--surface-2)]"
          >
            <span className="tl-key">{space.key}</span>
            <span className="font-medium">{space.name}</span>
            <span className="truncate text-[13px] text-[var(--ink-muted)]">
              {space.description}
            </span>
          </Link>
        ))}
      </Group>
    </div>
  );
}

/** Search across everything the caller may see (1a S9, E-69); the URL holds the query. */
export function EverythingPage({
  q,
  type,
  project,
}: {
  q: string;
  type?: EverythingType;
  project?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(q);
  const projects = useQuery(projectsQuery);
  const results = useQuery(everythingQuery(q, type, project));

  useEffect(() => setDraft(q), [q]);
  useEffect(() => {
    if (draft.trim() === q) return;
    const timer = setTimeout(
      () =>
        void navigate({
          to: '/search',
          search: { q: draft.trim() || undefined, type, project },
          replace: true,
        }),
      250,
    );
    return () => clearTimeout(timer);
  }, [draft, q, type, project, navigate]);

  const go = (next: { type?: EverythingType; project?: string }) =>
    void navigate({ to: '/search', search: { q: q || undefined, type, project, ...next } });
  // Kept from the last query while typing, but not once the field is empty.
  const data = q ? results.data : undefined;
  const total = data
    ? data.counts.issue + data.counts.page + data.counts.project + data.counts.space
    : 0;

  return (
    <main className="flex flex-col gap-[18px] px-12 py-8">
      <label className="flex h-12 items-center gap-2.5 rounded-lg border-2 border-[var(--border-control)] bg-[var(--surface-1)] px-4 focus-within:border-[var(--accent)]">
        <MagnifyingGlass size={18} aria-hidden className="text-[var(--ink-muted)]" />
        <input
          // biome-ignore lint/a11y/noAutofocus: the page exists to type a query
          autoFocus
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('everything.placeholder')}
          aria-label={t('everything.title')}
          className="min-w-0 flex-1 border-0 bg-transparent text-[17px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)]"
        />
        {data && q && (
          <span className="shrink-0 text-[12.5px] text-[var(--ink-muted)]">
            {t('everything.hits', { count: total })}
          </span>
        )}
      </label>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-pressed={!type}
          onClick={() => go({ type: undefined })}
          className={`${CHIP} h-7 cursor-pointer text-[13px]`}
        >
          {t('everything.all')} {data ? total : ''}
        </button>
        {TYPES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={type === value}
            onClick={() => go({ type: value })}
            className={`${CHIP} h-7 cursor-pointer text-[13px]`}
          >
            {t(`everything.${value}`)} {data ? data.counts[value] : ''}
          </button>
        ))}
        <span className="flex-1" />
        <select
          value={project ?? ''}
          onChange={(event) => go({ project: event.target.value || undefined })}
          aria-label={t('everything.allProjects')}
          className={`${CHIP} h-7 cursor-pointer text-[13px]`}
        >
          <option value="">{t('everything.allProjects')}</option>
          {projects.data?.map((entry) => (
            <option key={entry.key} value={entry.key}>
              {t('everything.inProject', { name: entry.name })}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-[var(--ink-muted)]">
        <span className="font-[family-name:var(--font-mono)] whitespace-pre">
          {t('everything.tip')}
        </span>
        {q && (
          <Link
            to="/issues"
            search={{ q: `text ~ "${q.replaceAll('"', '')}"` }}
            className="text-[var(--accent)] no-underline hover:underline"
          >
            {t('everything.tql')}
          </Link>
        )}
      </div>

      {!q && <p className="m-0 max-w-xl text-[var(--ink-muted)]">{t('everything.start')}</p>}
      {q && data && total === 0 && (
        <p className="m-0 text-[var(--ink-muted)]">{t('everything.none')}</p>
      )}
      {q && data && <Results data={data} type={type} onType={(value) => go({ type: value })} />}
    </main>
  );
}
