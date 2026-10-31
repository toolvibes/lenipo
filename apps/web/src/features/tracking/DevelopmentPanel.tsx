import { CheckCircle, GitBranch, GitCommit, GitPullRequest, XCircle } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatRelative } from '../../lib/format';

const link = 'text-[var(--ink)] no-underline hover:underline';

/** Branches, commits, pull requests and builds that name the issue (D-GIT-02/04, E-116). */
export function DevelopmentPanel({ issueKey }: { issueKey: string }) {
  const { t } = useTranslation();
  const data = useQuery({
    queryKey: ['issue', issueKey, 'development'],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/issues/{key}/development', { params: { path: { key: issueKey } } }),
      ),
  }).data;
  if (
    !data ||
    (data.branches.length === 0 &&
      data.commits.count === 0 &&
      data.pullRequests.length === 0 &&
      data.builds.length === 0)
  ) {
    return null;
  }
  const latest = data.commits.latest[0];
  return (
    <section aria-label={t('git.panel')} className="flex flex-col gap-1.5 text-[13px]">
      <h3 className="tl-label m-0 text-[var(--ink-muted)]">{t('git.panel')}</h3>
      {data.branches.length > 0 && (
        <span className="flex items-center gap-1.5">
          <GitBranch size={14} aria-hidden />
          {data.branches.length === 1 && data.branches[0]?.url ? (
            <a
              href={data.branches[0].url}
              target="_blank"
              rel="noopener noreferrer"
              className={link}
            >
              {data.branches[0].name}
            </a>
          ) : (
            t('git.branches', { count: data.branches.length })
          )}
        </span>
      )}
      {latest && (
        <span className="flex flex-col">
          <span className="flex items-center gap-1.5">
            <GitCommit size={14} aria-hidden />
            {t('git.commits', { count: data.commits.count })}
            <span className="text-xs text-[var(--ink-muted)]">· {formatRelative(latest.at)}</span>
          </span>
          {data.commits.latest
            .flatMap((commit) => commit.smart)
            .slice(0, 3)
            .map((note) => (
              <span key={note} className="pl-5 text-xs text-[var(--ink-muted)]">
                {note}
              </span>
            ))}
        </span>
      )}
      {data.pullRequests.map((pull) => (
        <span key={`${pull.repository}#${pull.number}`} className="flex items-start gap-1.5">
          <GitPullRequest size={14} aria-hidden className="mt-0.5 shrink-0" />
          <span className="min-w-0">
            {pull.url ? (
              <a href={pull.url} target="_blank" rel="noopener noreferrer" className={link}>
                {t('git.pullRequest')} #{pull.number}
              </a>
            ) : (
              `${t('git.pullRequest')} #${pull.number}`
            )}{' '}
            <span className="text-xs text-[var(--ink-muted)]">
              {t(`git.states.${pull.state}`)}
              {pull.review && ` · ${t(`git.states.${pull.review}`)}`}
            </span>
          </span>
        </span>
      ))}
      {data.builds.map((build) => {
        const Icon = build.state === 'failure' ? XCircle : CheckCircle;
        return (
          <span key={`${build.repository}:${build.name}`} className="flex items-center gap-1.5">
            <Icon
              size={14}
              aria-hidden
              className={
                build.state === 'failure'
                  ? 'text-[var(--danger)]'
                  : build.state === 'success'
                    ? 'text-[var(--success)]'
                    : 'text-[var(--ink-muted)]'
              }
            />
            {build.url ? (
              <a href={build.url} target="_blank" rel="noopener noreferrer" className={link}>
                {build.name}
              </a>
            ) : (
              build.name
            )}
            <span className="text-xs text-[var(--ink-muted)]">
              {t(`git.states.${build.state}`)}
            </span>
          </span>
        );
      })}
    </section>
  );
}
