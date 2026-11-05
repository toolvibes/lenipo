import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { InactiveProject } from '@toolvibes/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { projectSpacesQuery } from '../../lib/wiki';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';

type Mode = 'archive' | 'delete' | 'restore';

/** Archived and deleted projects the caller administers (E-164). */
export const inactiveProjectsQuery = {
  queryKey: ['projects', 'inactive'],
  queryFn: () => unwrap(client.GET('/api/v1/projects/inactive')),
};

/**
 * Asks before archiving, deleting or restoring a project; the linked wiki spaces go along only
 * when the box is ticked (off at first, E-164).
 */
export function LifecycleDialog({
  mode,
  projectKey,
  projectName,
  spaces,
  open,
  onOpenChange,
  onDone,
}: {
  mode: Mode;
  projectKey: string;
  projectName: string;
  spaces: Array<{ key: string; name: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [withSpaces, setWithSpaces] = useState(false);
  useEffect(() => {
    if (open) setWithSpaces(false);
  }, [open]);
  const run = useMutation({
    mutationFn: () => {
      const options = { params: { path: { key: projectKey } }, body: { spaces: withSpaces } };
      if (mode === 'archive') return unwrap(client.POST('/api/v1/projects/{key}/archive', options));
      if (mode === 'delete') return unwrap(client.POST('/api/v1/projects/{key}/delete', options));
      return unwrap(client.POST('/api/v1/projects/{key}/restore', options));
    },
    onSuccess: () => {
      // A hidden project answers 404 now: drop what was loaded for it instead of refetching.
      if (mode !== 'restore') queryClient.removeQueries({ queryKey: ['project', projectKey] });
      onOpenChange(false);
      onDone?.();
      // Lists, the sidebar and the wiki all change with it; reload in the background.
      void queryClient.invalidateQueries();
    },
  });
  const names = spaces.map((space) => `„${space.name}“ (${space.key})`).join(', ');
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(`projectLifecycle.${mode}.title`, { name: projectName })}
    >
      <div className="flex flex-col gap-4">
        <p className="m-0">{t(`projectLifecycle.${mode}.text`, { name: projectName })}</p>
        {spaces.length > 0 && (
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={withSpaces}
              onChange={(event) => setWithSpaces(event.target.checked)}
              className="mt-1"
            />
            <span>{t(`projectLifecycle.${mode}.spaces`, { count: spaces.length, names })}</span>
          </label>
        )}
        {run.error && <FormError message={run.error.message} />}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={mode === 'delete' ? 'danger' : 'primary'}
            disabled={run.isPending}
            onClick={() => run.mutate()}
          >
            {t(`projectLifecycle.${mode}.confirm`)}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** "Archive and delete" in the project settings, for project administrators. */
export function ProjectLifecycleSection({
  projectKey,
  projectName,
}: {
  projectKey: string;
  projectName: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const linked = useQuery(projectSpacesQuery(projectKey));
  const [mode, setMode] = useState<'archive' | 'delete' | null>(null);
  const spaces = (linked.data ?? []).map((space) => ({ key: space.key, name: space.name }));
  return (
    <section className="flex max-w-[720px] flex-col gap-6">
      <h2 className="tl-heading-lg m-0">{t('projectLifecycle.title')}</h2>
      <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] bg-[var(--surface-1)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="tl-heading-md m-0">{t('projectLifecycle.archive.heading')}</h3>
        <p className="m-0 text-[var(--ink-muted)]">{t('projectLifecycle.archive.about')}</p>
        <div>
          <Button onClick={() => setMode('archive')}>
            {t('projectLifecycle.archive.confirm')}
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] bg-[var(--surface-1)] p-5 shadow-[var(--shadow-card)]">
        <h3 className="tl-heading-md m-0">{t('projectLifecycle.delete.heading')}</h3>
        <p className="m-0 text-[var(--ink-muted)]">{t('projectLifecycle.delete.about')}</p>
        <div>
          <Button variant="danger" onClick={() => setMode('delete')}>
            {t('projectLifecycle.delete.confirm')}
          </Button>
        </div>
      </div>
      {mode && (
        <LifecycleDialog
          mode={mode}
          projectKey={projectKey}
          projectName={projectName}
          spaces={spaces}
          open
          onOpenChange={(open) => !open && setMode(null)}
          onDone={() => navigate({ to: '/projects', search: { tab: 'inactive' } })}
        />
      )}
    </section>
  );
}

/** The archived and deleted projects on the projects page, each with "restore". */
export function InactiveProjects({ entries }: { entries: InactiveProject[] }) {
  const { t, i18n } = useTranslation();
  const [restoring, setRestoring] = useState<InactiveProject | null>(null);
  const date = (value: string) =>
    new Date(value).toLocaleDateString(i18n.language, { dateStyle: 'medium' });
  return (
    <>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {entries.map((entry) => (
          <li
            key={entry.key}
            className="flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--surface-1)] px-5 py-4 shadow-[var(--shadow-card)]"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] font-bold">{entry.name}</span>
              <span className="text-[12.5px] text-[var(--ink-muted)]">
                <span className="tl-key">{entry.key}</span> ·{' '}
                {entry.deletedAt
                  ? entry.purgeAt
                    ? t('projectLifecycle.deletedUntil', { date: date(entry.purgeAt) })
                    : t('projectLifecycle.deletedKept')
                  : t('projectLifecycle.archivedSince', { date: date(entry.archivedAt) })}
              </span>
            </div>
            <Button size="sm" onClick={() => setRestoring(entry)}>
              {t('projectLifecycle.restore.confirm')}
            </Button>
          </li>
        ))}
      </ul>
      {restoring && (
        <LifecycleDialog
          mode="restore"
          projectKey={restoring.key}
          projectName={restoring.name}
          spaces={restoring.spaces.filter((space) => space.inactive)}
          open
          onOpenChange={(open) => !open && setRestoring(null)}
        />
      )}
    </>
  );
}
