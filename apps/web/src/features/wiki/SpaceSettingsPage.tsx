import { UserCircle, UsersThree, X } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type AddSpaceMemberRequest,
  type Space,
  type SpaceMember,
  SpaceRole,
  type UpdateSpaceRequest,
} from '@tasklore/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { projectsQuery } from '../../lib/tracking';
import { groupsQuery, spaceMembersQuery, spaceQuery, userSearchQuery } from '../../lib/wiki';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { Avatar } from '../tracking/UserPicker';

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

function MemberLine({
  member,
  onRemove,
  disabled,
}: {
  member: SpaceMember;
  onRemove: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const name = member.user?.displayName ?? member.group?.name ?? '';
  const label = member.group?.name === 'users' ? t('wiki.settings.everyone') : name;
  return (
    <li className="flex min-h-9 items-center gap-2 border-b border-[var(--border)] last:border-b-0">
      {member.user ? (
        <Avatar user={member.user} />
      ) : (
        <UsersThree size={20} className="text-[var(--ink-muted)]" aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate">
        {label}
        {member.group && (
          <span className="ml-1.5 text-xs text-[var(--ink-muted)]">{t('wiki.settings.group')}</span>
        )}
      </span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={t('wiki.settings.removeMember', { name: label })}
        title={t('wiki.settings.removeMember', { name: label })}
        className="grid size-7 place-items-center rounded-[var(--radius-sm)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)] disabled:opacity-50"
      >
        <X size={14} aria-hidden />
      </button>
    </li>
  );
}

/** Adds a person (searched by name or email) or a group to a role. */
function AddMember({ spaceKey }: { spaceKey: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [role, setRole] = useState<SpaceRole>('editors');
  const [kind, setKind] = useState<'user' | 'group'>('user');
  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState('');
  const groups = useQuery({ ...groupsQuery, enabled: kind === 'group' });
  const users = useQuery({
    ...userSearchQuery(search.trim()),
    enabled: kind === 'user' && search.trim().length > 0,
  });
  const add = useMutation({
    mutationFn: (body: AddSpaceMemberRequest) =>
      unwrap(
        client.POST('/api/v1/spaces/{key}/members', { params: { path: { key: spaceKey } }, body }),
      ),
    onSuccess: async (members) => {
      queryClient.setQueryData(spaceMembersQuery(spaceKey).queryKey, members);
      await queryClient.invalidateQueries({ queryKey: ['space', spaceKey] });
      setSearch('');
      setGroupId('');
    },
  });

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <strong>{t('wiki.settings.addMember')}</strong>
      {add.error && <FormError message={add.error.message} />}
      <div className="flex flex-wrap items-end gap-2">
        <Select
          label={t('wiki.settings.role')}
          value={role}
          options={SpaceRole.options.map((value) => ({
            value,
            label: t(`wiki.roles.${value}`),
          }))}
          onChange={(event) => setRole(event.target.value as SpaceRole)}
        />
        <Select
          label={t('wiki.settings.who')}
          value={kind}
          options={[
            { value: 'user', label: t('wiki.settings.person') },
            { value: 'group', label: t('wiki.settings.group') },
          ]}
          onChange={(event) => setKind(event.target.value as 'user' | 'group')}
        />
        {kind === 'group' && (
          <>
            <Select
              label={t('wiki.settings.group')}
              value={groupId}
              options={[
                { value: '', label: t('wiki.settings.chooseGroup') },
                ...(groups.data ?? []).map((group) => ({
                  value: group.id,
                  label: group.name === 'users' ? t('wiki.settings.everyone') : group.name,
                })),
              ]}
              onChange={(event) => setGroupId(event.target.value)}
            />
            <Button
              variant="primary"
              disabled={!groupId || add.isPending}
              onClick={() => add.mutate({ role, groupId })}
            >
              {t('wiki.settings.add')}
            </Button>
          </>
        )}
      </div>
      {kind === 'user' && (
        <div className="flex flex-col gap-1">
          <TextField
            label={t('wiki.settings.findPerson')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {users.data && users.data.length === 0 && (
            <p className="m-0 text-sm text-[var(--ink-muted)]">{t('wiki.settings.nobodyFound')}</p>
          )}
          <ul className="m-0 flex list-none flex-col p-0">
            {users.data?.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  disabled={add.isPending}
                  onClick={() => add.mutate({ role, userId: user.id })}
                  className="flex min-h-9 w-full items-center gap-2 rounded-[var(--radius-sm)] px-1 text-left hover:bg-[var(--surface-1)]"
                >
                  <Avatar user={user} />
                  <span className="min-w-0 flex-1 truncate">
                    {user.displayName}{' '}
                    <span className="text-xs text-[var(--ink-muted)]">{user.email}</span>
                  </span>
                  <span className="text-xs text-[var(--accent)]">
                    {t('wiki.settings.addAs', { role: t(`wiki.roles.${role}`) })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Roles({ spaceKey }: { spaceKey: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const members = useQuery(spaceMembersQuery(spaceKey));
  const remove = useMutation({
    mutationFn: (id: string) =>
      unwrap(
        client.DELETE('/api/v1/spaces/{key}/members/{id}', {
          params: { path: { key: spaceKey, id } },
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['space', spaceKey] });
    },
  });
  return (
    <Section title={t('wiki.settings.roles')} help={t('wiki.settings.rolesHelp')}>
      {remove.error && <FormError message={remove.error.message} />}
      <div className="grid gap-4 sm:grid-cols-2">
        {SpaceRole.options.map((role) => {
          const holders = members.data?.filter((member) => member.role === role) ?? [];
          return (
            <div key={role} className="flex flex-col gap-1">
              <h3 className="tl-label m-0 uppercase text-[var(--ink-muted)]">
                {t(`wiki.roles.${role}`)}
              </h3>
              <p className="m-0 text-xs text-[var(--ink-muted)]">{t(`wiki.roleHelp.${role}`)}</p>
              {holders.length === 0 ? (
                <p className="m-0 flex min-h-9 items-center gap-2 text-sm text-[var(--ink-muted)]">
                  <UserCircle size={20} aria-hidden />
                  {t('wiki.settings.nobody')}
                </p>
              ) : (
                <ul className="m-0 list-none p-0">
                  {holders.map((member) => (
                    <MemberLine
                      key={member.id}
                      member={member}
                      disabled={remove.isPending}
                      onRemove={() => remove.mutate(member.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <AddMember spaceKey={spaceKey} />
    </Section>
  );
}

/** Settings of a space for its administrators (W-SPC-03, -04). */
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
    </main>
  );
}
