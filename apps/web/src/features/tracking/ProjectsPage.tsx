import { Plus } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import type { Me } from '@toolvibes/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { presenceColor } from '../../lib/presence';
import { projectsQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { FavouriteButton } from '../personal/FavouriteButton';
import { CreateProjectDialog } from './CreateProjectDialog';
import { InactiveProjects, inactiveProjectsQuery } from './ProjectLifecycle';

type Tab = 'all' | 'favourites' | 'inactive';

/** Project directory as cards (1a S3): all or starred projects, filtered by name or key. */
export function ProjectsPage({ me }: { me: Me }) {
  const { t } = useTranslation();
  const projects = useQuery(projectsQuery);
  const [creating, setCreating] = useState(false);
  const search = useSearch({ strict: false }) as { tab?: 'inactive' };
  const [tab, setTab] = useState<Tab>(search.tab ?? 'all');
  const inactive = useQuery(inactiveProjectsQuery);
  const [filter, setFilter] = useState('');
  const canCreate =
    me.globalPermissions.includes('create-projects') ||
    me.globalPermissions.includes('system-admin');
  const all = projects.data ?? [];
  const favourites = all.filter((project) => project.favourite);
  const needle = filter.trim().toLowerCase();
  const shown = (tab === 'all' ? all : favourites).filter(
    (project) =>
      !needle ||
      project.name.toLowerCase().includes(needle) ||
      project.key.toLowerCase().includes(needle),
  );
  const tabs: Array<[Tab, string, number]> = [
    ['all', t('projects.all'), all.length],
    ['favourites', t('projects.favourites'), favourites.length],
    // Only for administrators of an archived or deleted project (E-164).
    ...((inactive.data?.length ?? 0) > 0
      ? [['inactive', t('projects.inactive'), inactive.data?.length ?? 0] as [Tab, string, number]]
      : []),
  ];

  return (
    <main className="flex flex-col gap-5 px-9 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="m-0 text-[24px] leading-[30px] font-extrabold tracking-[-0.025em]">
          {t('projects.title')}
        </h1>
        {canCreate && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={14} weight="bold" aria-hidden />
            {t('projects.create')}
          </Button>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-x-5 border-b border-[var(--border)] text-[13.5px]">
        <div role="tablist" className="flex gap-5">
          {tabs.map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className="-mb-px cursor-pointer border-0 border-b-2 border-transparent bg-transparent px-0 pt-0 pb-2.5 text-[var(--ink-muted)] aria-selected:border-[var(--accent)] aria-selected:font-bold aria-selected:text-[var(--ink)]"
            >
              {label} · {count}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={t('projects.filter')}
          aria-label={t('projects.filter')}
          className="mb-2 h-[30px] w-60 rounded-[var(--radius-md)] border border-[var(--border-control)] bg-[var(--surface-1)] px-2.5 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-muted)]"
        />
      </div>

      {tab === 'inactive' ? (
        <InactiveProjects entries={inactive.data ?? []} />
      ) : (
        <>
          {projects.data?.length === 0 && (
            <p className="m-0 max-w-xl text-[var(--ink-muted)]">{t('projects.empty')}</p>
          )}
          {all.length > 0 && shown.length === 0 && (
            <p className="m-0 text-[var(--ink-muted)]">{t('projects.noMatch')}</p>
          )}
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 p-0">
            {shown.map((project) => (
              <li
                key={project.id}
                className="relative flex flex-col gap-3 rounded-[16px] bg-[var(--surface-1)] p-[18px] shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-hover)]"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-[7px] font-[family-name:var(--font-mono)] text-[10.5px] font-semibold text-white"
                    style={{ backgroundColor: presenceColor(project.key) }}
                    aria-hidden
                  >
                    {project.key.slice(0, 3)}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    {/* The link covers the whole card; the star sits above it. */}
                    <Link
                      to="/projects/$key"
                      params={{ key: project.key }}
                      className="truncate text-[15px] font-semibold text-[var(--ink)] no-underline after:absolute after:inset-0 after:rounded-lg"
                    >
                      {project.name}
                    </Link>
                    <span className="text-xs text-[var(--ink-muted)]">
                      <span className="tl-key">{project.key}</span> ·{' '}
                      {t(`projects.methods.${project.template}`)}
                    </span>
                  </div>
                  <span className="relative">
                    <FavouriteButton
                      kind="project"
                      refId={project.key}
                      active={project.favourite}
                      name={project.name}
                    />
                  </span>
                </div>
                <p className="m-0 line-clamp-2 min-h-[39px] text-[13px] leading-normal text-[var(--ink-muted)]">
                  {project.description || t('projects.noDescription')}
                </p>
                <div className="flex gap-4 border-t border-[var(--border)] pt-2.5 text-[12.5px] text-[var(--ink-muted)]">
                  <span>{t('projects.issues', { count: project.issueCount })}</span>
                  <span className="flex-1" />
                  {project.lead && <span className="truncate">{project.lead.displayName}</span>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {creating && <CreateProjectDialog open onOpenChange={setCreating} />}
    </main>
  );
}
