import { MagnifyingGlass, Plus } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { Me } from '@tasklore/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRecordView } from '../../lib/personal';
import { type IssueFilter, projectIssuesQuery, projectQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { FavouriteButton } from '../personal/FavouriteButton';
import { ComponentsDialog } from './ComponentsDialog';
import { CreateIssueDialog } from './CreateIssueDialog';
import { IssueTable } from './IssueTable';

type Preset = 'all' | 'mine' | 'open' | 'done';

const PRESETS: Record<Preset, IssueFilter> = {
  all: {},
  mine: { assignee: 'me', status: 'unresolved' },
  open: { status: 'unresolved' },
  done: { status: 'done' },
};

/** Issue navigator for one project (design: list view, compact density). */
export function ProjectIssuesPage({ me, projectKey }: { me: Me; projectKey: string }) {
  const { t } = useTranslation();
  const project = useQuery(projectQuery(projectKey));
  useRecordView('project', project.data?.key);
  const [preset, setPreset] = useState<Preset>('open');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(50);
  const [creating, setCreating] = useState(false);
  const [managingComponents, setManagingComponents] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const issues = useQuery(
    projectIssuesQuery(projectKey, { ...PRESETS[preset], q: query || undefined, limit }),
  );

  const chip = (value: Preset, label: string) => (
    <button
      type="button"
      aria-pressed={preset === value}
      onClick={() => setPreset(value)}
      className={`h-7 rounded-[var(--radius-md)] border px-2.5 ${
        preset === value
          ? 'border-[var(--accent)] bg-[var(--accent-soft)] font-semibold text-[var(--accent)]'
          : 'border-[var(--border-strong)] bg-[var(--surface-1)] text-[var(--ink)]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <main className="flex flex-col gap-4 px-6 py-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            to="/projects"
            className="text-xs text-[var(--ink-muted)] no-underline hover:underline"
          >
            {t('projects.title')}
          </Link>
          <h1 className="tl-heading-xl flex items-center gap-2">
            {project.data?.name ?? projectKey}
            {project.data && (
              <FavouriteButton
                kind="project"
                refId={project.data.key}
                active={project.data.favourite}
                name={project.data.name}
              />
            )}
          </h1>
          <Link
            to="/activity"
            search={{ project: projectKey }}
            className="text-xs text-[var(--ink-muted)] no-underline hover:underline"
          >
            {t('activity.ofProject')}
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {project.data?.permissions.includes('administer') && (
            <Button onClick={() => setManagingComponents(true)}>
              {t('projects.components.title')}
            </Button>
          )}
          {project.data?.permissions.includes('create-issues') && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={16} aria-hidden />
              {t('issues.create')}
            </Button>
          )}
        </div>
      </header>

      <div
        role="toolbar"
        aria-label={t('issues.search')}
        className="flex flex-wrap items-center gap-2"
      >
        <label className="flex h-7 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-[var(--ink-muted)]">
          <MagnifyingGlass size={14} aria-hidden />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('issues.search')}
            aria-label={t('issues.search')}
            className="w-48 bg-transparent text-[var(--ink)] outline-none"
          />
        </label>
        {chip('open', t('issues.filterOpen'))}
        {chip('mine', t('issues.filterMine'))}
        {chip('done', t('issues.filterDone'))}
        {chip('all', t('issues.filterAll'))}
        {issues.data && (
          <span className="ml-auto text-xs text-[var(--ink-muted)]">
            {t('issues.count', { shown: issues.data.issues.length, total: issues.data.total })}
          </span>
        )}
      </div>

      <IssueTable
        issues={issues.data?.issues ?? []}
        empty={
          !issues.data
            ? null
            : project.data?.issueCount === 0
              ? t('issues.emptyProject')
              : t('issues.empty')
        }
      />
      {issues.data && issues.data.issues.length < issues.data.total && (
        <Button
          className="self-center"
          onClick={() => setLimit((current) => Math.min(current + 50, 100))}
          disabled={limit >= 100}
        >
          {t('issues.loadMore')}
        </Button>
      )}
      <ComponentsDialog
        projectKey={projectKey}
        open={managingComponents}
        onOpenChange={setManagingComponents}
      />
      {project.data && (
        <CreateIssueDialog
          project={project.data}
          open={creating}
          onOpenChange={setCreating}
          myId={me.id}
        />
      )}
    </main>
  );
}
