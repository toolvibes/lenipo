import { Plus } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { ProjectWikiPages } from '@toolvibes/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { meQuery } from '../../lib/queries';
import { projectQuery } from '../../lib/tracking';
import { projectSpacesQuery, spacesQuery } from '../../lib/wiki';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { CreateSpaceDialog } from '../wiki/CreateSpaceDialog';

/** The project's own wiki space, or a way to create one linked with the project (E-60). */
function ProjectWiki({ projectKey }: { projectKey: string }) {
  const { t } = useTranslation();
  const linked = useQuery(projectSpacesQuery(projectKey));
  const project = useQuery(projectQuery(projectKey));
  const me = useQuery(meQuery);
  const [creating, setCreating] = useState(false);
  if (!linked.data || !project.data) return null;
  const canCreate = me.data?.globalPermissions.includes('create-spaces') ?? false;
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] bg-[var(--surface-2)] p-4">
      <h3 className="m-0 text-[13.5px] font-semibold">{t('projectPages.projectWiki')}</h3>
      {linked.data.length > 0 ? (
        <p className="m-0 flex flex-wrap gap-x-2 text-[13.5px]">
          <span className="text-[var(--ink-muted)]">{t('projectPages.linkedTo')}</span>
          {linked.data.map((space) => (
            <Link key={space.id} to="/spaces/$key" params={{ key: space.key }}>
              {space.name} ({space.key})
            </Link>
          ))}
        </p>
      ) : (
        <>
          <p className="m-0 text-[13.5px] text-[var(--ink-muted)]">{t('projectPages.noWiki')}</p>
          {canCreate && (
            <div>
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} aria-hidden />
                {t('sidebar.createWiki')}
              </Button>
            </div>
          )}
        </>
      )}
      {creating && (
        <CreateSpaceDialog
          open
          onOpenChange={setCreating}
          project={{ key: project.data.key, name: project.data.name }}
        />
      )}
    </div>
  );
}

/** Pages the project writes to the wiki by itself (W-INT-05, W-INT-06, TL-28, E-109). */
export function WikiPagesSettings({ projectKey }: { projectKey: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const key = ['project', projectKey, 'wiki-pages'];
  const current = useQuery({
    queryKey: key,
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/projects/{key}/wiki-pages', { params: { path: { key: projectKey } } }),
      ),
  });
  const spaces = useQuery(spacesQuery);
  const [draft, setDraft] = useState<ProjectWikiPages | null>(null);
  useEffect(() => {
    if (current.data) setDraft(current.data);
  }, [current.data]);
  const save = useMutation({
    mutationFn: (body: ProjectWikiPages) =>
      unwrap(
        client.PUT('/api/v1/projects/{key}/wiki-pages', {
          params: { path: { key: projectKey } },
          body,
        }),
      ),
    onSuccess: (saved) => queryClient.setQueryData(key, saved),
  });
  if (!draft) return null;
  const toggle = (field: 'retroOnSprintEnd' | 'reportOnSprintEnd' | 'notesOnRelease') => (
    <label className="flex items-center gap-2 text-[13.5px]">
      <input
        type="checkbox"
        checked={draft[field]}
        disabled={!draft.spaceKey}
        onChange={(event) => {
          setDraft({ ...draft, [field]: event.target.checked });
          save.reset();
        }}
      />
      {t(`projectPages.${field}`)}
    </label>
  );
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="tl-heading-md m-0">{t('projectPages.title')}</h2>
        <p className="m-0 text-sm text-[var(--ink-muted)]">{t('projectPages.intro')}</p>
      </div>
      <ProjectWiki projectKey={projectKey} />
      {save.error && <FormError message={save.error.message} />}
      <div className="max-w-[360px]">
        <Select
          label={t('projectPages.space')}
          value={draft.spaceKey ?? ''}
          options={[
            { value: '', label: t('projectPages.off') },
            ...(spaces.data ?? []).map((space) => ({ value: space.key, label: space.name })),
          ]}
          onChange={(event) => {
            setDraft({ ...draft, spaceKey: event.target.value || null });
            save.reset();
          }}
        />
      </div>
      {toggle('retroOnSprintEnd')}
      {toggle('reportOnSprintEnd')}
      {toggle('notesOnRelease')}
      <div className="flex items-center gap-3">
        <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate(draft)}>
          {t('common.save')}
        </Button>
        {save.isSuccess && (
          <span role="status" className="text-[13px] text-[var(--ink-muted)]">
            {t('signIn.saved')}
          </span>
        )}
      </div>
    </section>
  );
}
