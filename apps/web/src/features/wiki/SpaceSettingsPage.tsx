import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type AddSpaceMemberRequest,
  type Space,
  SpaceRole,
  type UpdateSpaceRequest,
} from '@toolvibes/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { projectsQuery } from '../../lib/tracking';
import { spaceMembersQuery, spaceQuery } from '../../lib/wiki';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { RoleMembers } from '../settings/RoleMembers';
import { TemplateList } from './templates';

function Section({
  title,
  help,
  children,
}: {
  title: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex max-w-2xl flex-col gap-3 border-t border-[var(--border)] pt-4">
      <div className="flex flex-col gap-1">
        <h2 className="tl-heading-md">{title}</h2>
        {help && <p className="m-0 text-sm text-[var(--ink-muted)]">{help}</p>}
      </div>
      {children}
    </section>
  );
}

function useUpdateSpace(spaceKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateSpaceRequest) =>
      unwrap(client.PATCH('/api/v1/spaces/{key}', { params: { path: { key: spaceKey } }, body })),
    onSuccess: async (space) => {
      queryClient.setQueryData(spaceQuery(spaceKey).queryKey, space);
      await queryClient.invalidateQueries({ queryKey: ['spaces'] });
      await queryClient.invalidateQueries({ queryKey: ['project'] });
    },
  });
}

function General({ space }: { space: Space }) {
  const { t } = useTranslation();
  const [name, setName] = useState(space.name);
  const [description, setDescription] = useState(space.description);
  const update = useUpdateSpace(space.key);
  useEffect(() => {
    setName(space.name);
    setDescription(space.description);
  }, [space.name, space.description]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) update.mutate({ name: name.trim(), description });
  }

  return (
    <Section title={t('wiki.settings.general')}>
      <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
        {update.error && <FormError message={update.error.message} />}
        <TextField
          label={t('wiki.spaceName')}
          value={name}
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label={t('wiki.spaceDescription')}
          value={description}
          maxLength={2000}
          onChange={(event) => setDescription(event.target.value)}
        />
        <div>
          <Button
            type="submit"
            variant="primary"
            disabled={
              update.isPending ||
              !name.trim() ||
              (name === space.name && description === space.description)
            }
          >
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Section>
  );
}

/** Link with a tracking project; the server checks administer on both sides (E-60). */
function ProjectLink({ space }: { space: Space }) {
  const { t } = useTranslation();
  const projects = useQuery(projectsQuery);
  const [projectKey, setProjectKey] = useState(space.project?.key ?? '');
  const update = useUpdateSpace(space.key);
  useEffect(() => setProjectKey(space.project?.key ?? ''), [space.project?.key]);
  const options = [
    { value: '', label: t('wiki.settings.noProject') },
    ...(projects.data ?? []).map((project) => ({
      value: project.key,
      label: `${project.name} (${project.key})`,
    })),
  ];
  // A linked project the caller cannot browse still has to show up as the current value.
  if (space.project && !options.some((option) => option.value === space.project?.key)) {
    options.push({ value: space.project.key, label: space.project.name });
  }
  return (
    <Section title={t('wiki.settings.project')} help={t('wiki.settings.projectHelp')}>
      {update.error && <FormError message={update.error.message} />}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-64">
          <Select
            label={t('wiki.settings.linkedProject')}
            value={projectKey}
            options={options}
            onChange={(event) => setProjectKey(event.target.value)}
          />
        </div>
        <Button
          variant="primary"
          disabled={update.isPending || projectKey === (space.project?.key ?? '')}
          onClick={() => update.mutate({ projectKey: projectKey || null })}
        >
          {t('common.save')}
        </Button>
      </div>
    </Section>
  );
}

function Roles({ spaceKey }: { spaceKey: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const members = useQuery(spaceMembersQuery(spaceKey));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['space', spaceKey] });
  const remove = useMutation({
    mutationFn: (id: string) =>
      unwrap(
        client.DELETE('/api/v1/spaces/{key}/members/{id}', {
          params: { path: { key: spaceKey, id } },
        }),
      ),
    onSuccess: refresh,
  });
  const add = useMutation({
    mutationFn: (body: AddSpaceMemberRequest) =>
      unwrap(
        client.POST('/api/v1/spaces/{key}/members', { params: { path: { key: spaceKey } }, body }),
      ),
    onSuccess: async (list) => {
      queryClient.setQueryData(spaceMembersQuery(spaceKey).queryKey, list);
      await refresh();
    },
  });
  return (
    <Section title={t('wiki.settings.roles')} help={t('wiki.settings.rolesHelp')}>
      <RoleMembers
        roles={SpaceRole.options}
        defaultRole="editors"
        roleLabel={(role) => t(`wiki.roles.${role}`)}
        roleHelp={(role) => t(`wiki.roleHelp.${role}`)}
        members={members.data}
        error={remove.error ?? add.error}
        busy={remove.isPending || add.isPending}
        onRemove={(id) => remove.mutate(id)}
        onAdd={(grant) => add.mutateAsync(grant)}
      />
    </Section>
  );
}

/** Settings of a space for its administrators (W-SPC-03, -04). */
/** Restricted pages, which administrators may lift even where they cannot see them (E-95). */
function RestrictedPages({ spaceKey }: { spaceKey: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const restricted = useQuery({
    queryKey: ['space', spaceKey, 'restricted-pages'],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/spaces/{key}/restricted-pages', {
          params: { path: { key: spaceKey } },
        }),
      ),
  });
  const lift = useMutation({
    mutationFn: (id: string) =>
      unwrap(
        client.DELETE('/api/v1/spaces/{key}/restricted-pages/{id}', {
          params: { path: { key: spaceKey, id } },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['space', spaceKey] });
      void queryClient.invalidateQueries({ queryKey: ['page'] });
    },
  });
  return (
    <Section title={t('restrictions.spaceTitle')} help={t('restrictions.spaceHelp')}>
      {lift.error && <FormError message={lift.error.message} />}
      {restricted.data?.length === 0 ? (
        <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('restrictions.none')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {restricted.data?.map((page) => (
            <li key={page.id} className="flex flex-wrap items-center gap-3 text-[13.5px]">
              <span className="font-medium">{page.title}</span>
              <span className="text-xs text-[var(--ink-muted)]">
                {[page.view && t('restrictions.view'), page.edit && t('restrictions.edit')]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <Button
                variant="ghost"
                disabled={lift.isPending}
                onClick={() => lift.mutate(page.id)}
              >
                {t('restrictions.lift')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function SpaceSettingsPage({ spaceKey }: { spaceKey: string }) {
  const { t } = useTranslation();
  const space = useQuery(spaceQuery(spaceKey));
  if (!space.data) return null;
  if (!space.data.permissions.includes('administer')) {
    return (
      <main className="px-6 py-6">
        <p className="m-0 text-[var(--ink-muted)]">{t('wiki.settings.notAllowed')}</p>
      </main>
    );
  }
  return (
    <main className="flex flex-col gap-5 px-6 py-6">
      <h1 className="tl-heading-xl">{t('wiki.settings.title')}</h1>
      <General space={space.data} />
      <ProjectLink space={space.data} />
      <Roles spaceKey={spaceKey} />
      <RestrictedPages spaceKey={spaceKey} />
      <Section title={t('templates.title')} help={t('templates.help')}>
        <TemplateList spaceKey={spaceKey} canManage />
      </Section>
    </main>
  );
}
