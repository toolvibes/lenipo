import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { DevelopmentSummary, IssueSummary, Release } from '@tasklore/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { projectQuery, versionsQuery } from '../../lib/tracking';
import { spacesQuery } from '../../lib/wiki';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { TopBar } from '../../ui/TopBar';
import { IssueTypeIcon, StatusLozenge } from '../tracking/icons';

function Bar({ done, total }: { done: number; total: number }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className="h-full bg-[var(--success)]" style={{ width: `${percent}%` }} />
      </div>
      <span className="w-10 text-right font-[family-name:var(--font-mono)] text-xs">
        {percent} %
      </span>
    </div>
  );
}

/** Versions of a project with their progress (T-REL-02, TL-25, E-106). */
export function ReleasesPage({ projectKey }: { projectKey: string }) {
  const { t } = useTranslation();
  const project = useQuery(projectQuery(projectKey));
  const versions = useQuery(versionsQuery(projectKey));
  const list = (versions.data ?? []).filter((version) => !version.archived);
  return (
    <>
      <TopBar crumbs={[project.data?.name ?? projectKey, t('releases.title')]} />
      <main className="flex max-w-[960px] flex-col gap-4 px-6 py-6 lg:px-10">
        <h1 className="m-0 text-[26px] leading-tight font-semibold tracking-[-0.015em]">
          {t('releases.title')}
        </h1>
        {versions.data && list.length === 0 && (
          <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('releases.none')}</p>
        )}
        <ul className="m-0 flex list-none flex-col p-0">
          {list.map((version) => (
            <li
              key={version.id}
              className="grid grid-cols-[minmax(0,1fr)_200px] items-center gap-4 border-b border-[var(--border)] py-3 text-[13.5px]"
            >
              <span className="flex min-w-0 flex-col">
                <Link
                  to="/projects/$key/releases/$id"
                  params={{ key: projectKey, id: version.id }}
                  className="font-semibold text-[var(--ink)] no-underline hover:underline"
                >
                  {version.name}
                </Link>
                <span className="text-xs text-[var(--ink-muted)]">
                  {version.released
                    ? t('releases.releasedOn', {
                        date: version.releaseDate ? formatDate(version.releaseDate) : '–',
                      })
                    : version.releaseDate
                      ? t('releases.planned', { date: formatDate(version.releaseDate) })
                      : t('releases.noDate')}
                  {' · '}
                  {t('releases.counts', {
                    done: version.issueCount - version.openCount,
                    total: version.issueCount,
                  })}
                </span>
              </span>
              <Bar done={version.issueCount - version.openCount} total={version.issueCount} />
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}

function IssueList({
  title,
  issues,
  development,
}: {
  title: string;
  issues: IssueSummary[];
  /** Open pull requests and failing builds per issue key (TL-36, E-116). */
  development: Map<string, DevelopmentSummary>;
}) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-1">
      <h2 className="m-0 text-[14px] font-semibold">
        {title} · {issues.length}
      </h2>
      <ul className="m-0 flex list-none flex-col p-0">
        {issues.map((issue) => (
          <li
            key={issue.id}
            className="flex items-center gap-2 border-b border-[var(--border)] py-1.5 text-[13px]"
          >
            <IssueTypeIcon type={issue.issueType} />
            <Link to="/issues/$key" params={{ key: issue.key }} className="tl-key shrink-0">
              {issue.key}
            </Link>
            <span className="min-w-0 flex-1 truncate">{issue.summary}</span>
            {(development.get(issue.key)?.openPullRequests ?? 0) > 0 && (
              <span className="text-xs text-[var(--ink-muted)]">
                {t('git.openPrs', { count: development.get(issue.key)?.openPullRequests ?? 0 })}
              </span>
            )}
            {(development.get(issue.key)?.failingBuilds ?? 0) > 0 && (
              <span className="text-xs font-semibold text-[var(--danger)]">
                {t('git.failingBuilds', { count: development.get(issue.key)?.failingBuilds ?? 0 })}
              </span>
            )}
            <StatusLozenge status={issue.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function NotesDialog({
  projectKey,
  release,
  open,
  onOpenChange,
}: {
  projectKey: string;
  release: Release;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const notes = useQuery({
    queryKey: ['release', release.version.id, 'notes'],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/projects/{key}/releases/{id}/notes', {
          params: { path: { key: projectKey, id: release.version.id } },
        }),
      ),
    enabled: open,
  });
  const spaces = useQuery({ ...spacesQuery, enabled: open && !release.notesPage });
  const [title, setTitle] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [spaceKey, setSpaceKey] = useState('');
  useEffect(() => {
    if (!notes.data) return;
    setTitle(notes.data.title);
    setMarkdown(notes.data.markdown);
  }, [notes.data]);
  const publish = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/projects/{key}/releases/{id}/notes', {
          params: { path: { key: projectKey, id: release.version.id } },
          body: { title, markdown, ...(release.notesPage ? {} : { spaceKey }) },
        }),
      ),
    onSuccess: (next) => {
      queryClient.setQueryData(['release', release.version.id], next);
      onOpenChange(false);
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('releases.notesTitle')}
      description={release.notesPage ? t('releases.notesUpdate') : t('releases.notesHelp')}
      width={680}
    >
      <div className="flex flex-col gap-3">
        {(notes.error ?? publish.error) && (
          <FormError message={(notes.error ?? publish.error)?.message ?? ''} />
        )}
        <TextField
          label={t('releases.pageTitle')}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        {!release.notesPage && (
          <Select
            label={t('releases.space')}
            value={spaceKey}
            options={[
              { value: '', label: t('releases.chooseSpace') },
              ...(spaces.data ?? []).map((space) => ({ value: space.key, label: space.name })),
            ]}
            onChange={(event) => setSpaceKey(event.target.value)}
          />
        )}
        <label className="flex flex-col gap-1">
          <span className="tl-field-label">{t('releases.markdown')}</span>
          <textarea
            rows={14}
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] p-2 font-[family-name:var(--font-mono)] text-[12.5px] text-[var(--ink)]"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!title.trim() || publish.isPending || (!release.notesPage && !spaceKey)}
            onClick={() => publish.mutate()}
          >
            {t('releases.publish')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** One version: progress, issues by status, warnings and release notes (TL-25, E-106). */
export function ReleasePage({ projectKey, id }: { projectKey: string; id: string }) {
  const { t } = useTranslation();
  const project = useQuery(projectQuery(projectKey));
  const [notes, setNotes] = useState(false);
  const developmentQuery = useQuery({
    queryKey: ['release', id, 'development'],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/projects/{key}/releases/{id}/development', {
          params: { path: { key: projectKey, id } },
        }),
      ),
  });
  const development = new Map(
    (developmentQuery.data ?? []).map((entry) => [entry.issueKey, entry]),
  );
  const release = useQuery({
    queryKey: ['release', id],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/projects/{key}/releases/{id}', {
          params: { path: { key: projectKey, id } },
        }),
      ),
  });
  const data = release.data;
  return (
    <>
      <TopBar
        crumbs={[
          project.data?.name ?? projectKey,
          <Link key="releases" to="/projects/$key/releases" params={{ key: projectKey }}>
            {t('releases.title')}
          </Link>,
          data?.version.name ?? '',
        ]}
        actions={
          data?.canEdit && (
            <Button variant="primary" onClick={() => setNotes(true)}>
              {t('releases.notes')}
            </Button>
          )
        }
      />
      <main className="flex max-w-[960px] flex-col gap-5 px-6 py-6 lg:px-10">
        {release.error && <FormError message={release.error.message} />}
        {data && (
          <>
            <header className="flex flex-col gap-2">
              <h1 className="m-0 text-[26px] leading-tight font-semibold tracking-[-0.015em]">
                {data.version.name}
              </h1>
              <p className="m-0 text-[13px] text-[var(--ink-muted)]">
                {data.version.released
                  ? t('releases.releasedOn', {
                      date: data.version.releaseDate ? formatDate(data.version.releaseDate) : '–',
                    })
                  : data.version.releaseDate
                    ? t('releases.planned', { date: formatDate(data.version.releaseDate) })
                    : t('releases.noDate')}
                {data.notesPage && (
                  <>
                    {' · '}
                    <Link
                      to="/spaces/$key/pages/$id"
                      params={{ key: data.notesPage.spaceKey, id: data.notesPage.id }}
                    >
                      {t('releases.notesPage')}
                    </Link>
                  </>
                )}
              </p>
              <div className="grid max-w-[560px] gap-1 text-[13px]">
                <span>
                  {t('releases.counts', { done: data.progress.done, total: data.progress.issues })}
                  {data.progress.points > 0 &&
                    ` · ${t('releases.points', { done: data.progress.donePoints, total: data.progress.points })}`}
                </span>
                <Bar done={data.progress.done} total={data.progress.issues} />
              </div>
            </header>
            {data.warnings.length > 0 && (
              <section className="flex flex-col gap-1 rounded-lg border border-[var(--warning)] bg-[var(--warning-soft)] px-4 py-3">
                <h2 className="m-0 text-[14px] font-semibold">
                  {t('releases.warnings', { count: data.warnings.length })}
                </h2>
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-[13px]">
                  {data.warnings.map((warning) => (
                    <li key={`${warning.kind}:${warning.issueKey}:${warning.blockerKey ?? ''}`}>
                      <Link to="/issues/$key" params={{ key: warning.issueKey }} className="tl-key">
                        {warning.issueKey}
                      </Link>{' '}
                      {warning.kind === 'blocked'
                        ? t('releases.warning.blocked', { key: warning.blockerKey ?? '' })
                        : t(`releases.warning.${warning.kind}`)}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <IssueList title={t('home.todo')} issues={data.todo} development={development} />
            <IssueList
              title={t('home.inProgress')}
              issues={data.inProgress}
              development={development}
            />
            <IssueList title={t('home.done')} issues={data.done} development={development} />
            <NotesDialog
              projectKey={projectKey}
              release={data}
              open={notes}
              onOpenChange={setNotes}
            />
          </>
        )}
      </main>
    </>
  );
}
