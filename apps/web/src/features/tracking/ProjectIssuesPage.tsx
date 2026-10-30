import { BookOpenText, GearSix, MagnifyingGlass, Plus } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { Me } from '@tasklore/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useListColumns, useRecordView } from '../../lib/personal';
import { useRealtimeRooms } from '../../lib/realtime';
import { useCurrentProject } from '../../lib/shortcuts';
import { type IssueFilter, projectIssuesQuery, projectQuery } from '../../lib/tracking';
import { projectSpacesQuery } from '../../lib/wiki';
import { Button, buttonClass } from '../../ui/Button';
import { CHIP, PageHeading, TopBar } from '../../ui/TopBar';
import { FavouriteButton } from '../personal/FavouriteButton';
import { ColumnPicker } from '../search/ColumnPicker';
import { CreateIssueDialog } from './CreateIssueDialog';
import { IssueSplit, useWideScreen } from './IssueSplit';
import { IssueTable } from './IssueTable';

type Preset = 'all' | 'mine' | 'open' | 'done';

const PRESETS: Record<Preset, IssueFilter> = {
  all: {},
  mine: { assignee: 'me', status: 'unresolved' },
  open: { status: 'unresolved' },
  done: { status: 'done' },
};

/** Issue navigator for one project (design: list view, compact density). */
export function ProjectIssuesPage({
  me,
  projectKey,
  selected,
}: {
  me: Me;
  projectKey: string;
  selected?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const wide = useWideScreen();
  const columns = useListColumns();
  const select = (key: string | undefined) =>
    void navigate({
      to: '/projects/$key',
      params: { key: projectKey },
      search: { selected: key },
      replace: true,
    });
  const project = useQuery(projectQuery(projectKey));
  const linkedSpaces = useQuery(projectSpacesQuery(projectKey));
  useRecordView('project', project.data?.key);
  const [preset, setPreset] = useState<Preset>('open');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(50);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useRealtimeRooms([`project:${projectKey}`]);
  useCurrentProject(projectKey);
  const issues = useQuery(
    projectIssuesQuery(projectKey, { ...PRESETS[preset], q: query || undefined, limit }),
  );

  const chip = (value: Preset, label: string) => (
    <button
      type="button"
      aria-pressed={preset === value}
      onClick={() => setPreset(value)}
      className={CHIP}
    >
      {label}
    </button>
  );

  return (
    <main className="flex flex-col">
      <TopBar
        crumbs={[
          <Link key="projects" to="/projects">
            {t('projects.title')}
          </Link>,
          project.data?.name ?? projectKey,
        ]}
        actions={
          <Link
            to="/projects/$key/settings"
            params={{ key: projectKey }}
            className={buttonClass('ghost', 'sm')}
          >
            <GearSix size={16} aria-hidden />
            {t('projectSettings.open')}
          </Link>
        }
      />
      <PageHeading
        title={
          <>
            {project.data?.name ?? projectKey}
            {project.data && (
              <FavouriteButton
                kind="project"
                refId={project.data.key}
                active={project.data.favourite}
                name={project.data.name}
              />
            )}
          </>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              to="/activity"
              search={{ project: projectKey }}
              className="text-[var(--ink-muted)] no-underline hover:underline"
            >
              {t('activity.ofProject')}
            </Link>
            {linkedSpaces.data?.map((space) => (
              <Link
                key={space.id}
                to="/spaces/$key"
                params={{ key: space.key }}
                className="flex items-center gap-1 text-[var(--ink-muted)] no-underline hover:underline"
              >
                <BookOpenText size={14} aria-hidden />
                {t('wiki.nav')}: {space.name}
              </Link>
            ))}
          </span>
        }
        actions={
          project.data?.permissions.includes('create-issues') && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={14} weight="bold" aria-hidden />
              {t('issues.create')}
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-3 px-6 pb-6">
        <div
          role="toolbar"
          aria-label={t('issues.search')}
          className="flex flex-wrap items-center gap-2"
        >
          <label className="flex h-[26px] items-center gap-1.5 rounded-[5px] border border-[var(--border-control)] bg-[var(--surface-1)] px-2 text-[12.5px] text-[var(--ink-muted)]">
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
          <span className="ml-auto flex items-center gap-2">
            {issues.data && (
              <span className="text-xs text-[var(--ink-muted)]">
                {t('issues.count', { shown: issues.data.issues.length, total: issues.data.total })}
              </span>
            )}
            <ColumnPicker columns={columns} />
          </span>
        </div>

        <IssueSplit me={me} selected={selected} onClose={() => select(undefined)}>
          <IssueTable
            columns={columns}
            selectedKey={selected}
            onSelect={wide ? select : undefined}
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
        </IssueSplit>
      </div>
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
