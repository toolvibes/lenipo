import { Plus } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { Me } from '@tasklore/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { projectsQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { CreateProjectDialog } from './CreateProjectDialog';

export function ProjectsPage({ me }: { me: Me }) {
  const { t } = useTranslation();
  const projects = useQuery(projectsQuery);
  const [creating, setCreating] = useState(false);
  const canCreate =
    me.globalPermissions.includes('create-projects') ||
    me.globalPermissions.includes('system-admin');

  return (
    <main className="flex flex-col gap-5 px-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="tl-heading-xl">{t('projects.title')}</h1>
        {canCreate && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden />
            {t('projects.create')}
          </Button>
        )}
      </header>
      {projects.data?.length === 0 && (
        <p className="max-w-xl text-[var(--ink-muted)]">{t('projects.empty')}</p>
      )}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
        {projects.data?.map((project) => (
          <li key={project.id}>
            <Link
              to="/projects/$key"
              params={{ key: project.key }}
              className="flex h-full flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-4 text-[var(--ink)] no-underline hover:border-[var(--border-strong)]"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--accent)] font-bold text-[var(--on-accent)]">
                  {project.key[0]}
                </span>
                <div className="flex min-w-0 flex-col">
                  <strong className="truncate font-semibold">{project.name}</strong>
                  <span className="tl-key text-[var(--ink-muted)]">{project.key}</span>
                </div>
              </div>
              <span className="text-xs text-[var(--ink-muted)]">
                {t('projects.issues', { count: project.issueCount })}
                {project.lead ? ` · ${t('projects.lead')}: ${project.lead.displayName}` : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <CreateProjectDialog open={creating} onOpenChange={setCreating} />
    </main>
  );
}
