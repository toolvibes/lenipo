import { Plus, Trash, UsersThree } from '@phosphor-icons/react';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  type PermissionGrant,
  type PermissionGrantInput,
  PROJECT_PERMISSIONS,
  PROJECT_ROLES,
  type ProjectPermission,
  type ProjectRole,
} from '@tasklore/shared';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { groupsQuery, userSearchQuery } from '../../lib/wiki';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { Avatar } from '../tracking/UserPicker';

export const permissionSchemesQuery = queryOptions({
  queryKey: ['permission-schemes'],
  queryFn: () => unwrap(client.GET('/api/v1/admin/permission-schemes')),
});

export const permissionSchemeQuery = (id: string) =>
  queryOptions({
    queryKey: ['permission-schemes', id],
    queryFn: () =>
      unwrap(client.GET('/api/v1/admin/permission-schemes/{id}', { params: { path: { id } } })),
  });

/** A column of the matrix: a project role, a group or one person. */
type Column =
  | { kind: 'role'; role: ProjectRole }
  | { kind: 'group'; id: string; name: string }
  | { kind: 'user'; id: string; name: string };

const columnKey = (column: Column) =>
  column.kind === 'role' ? `role:${column.role}` : `${column.kind}:${column.id}`;

const grantKey = (grant: PermissionGrant) =>
  grant.grantee === 'role'
    ? `role:${grant.role}`
    : grant.grantee === 'group'
      ? `group:${grant.group?.id}`
      : `user:${grant.user?.id}`;

export function columnsOf(grants: PermissionGrant[]): Column[] {
  const extra = new Map<string, Column>();
  for (const grant of grants) {
    if (grant.group) extra.set(grantKey(grant), { kind: 'group', ...grant.group });
    if (grant.user) {
      extra.set(grantKey(grant), { kind: 'user', id: grant.user.id, name: grant.user.displayName });
    }
  }
  return [...PROJECT_ROLES.map((role) => ({ kind: 'role' as const, role })), ...extra.values()];
}

/**
 * Permissions down, holders across (P-PRM-02, E-82). Read-only without `onToggle`; the role
 * columns are always there, groups and people appear once they hold something.
 */
export function PermissionMatrix({
  columns,
  checked,
  onToggle,
  onRemoveColumn,
}: {
  columns: Column[];
  checked: Set<string>;
  onToggle?: (permission: ProjectPermission, column: Column) => void;
  onRemoveColumn?: (column: Column) => void;
}) {
  const { t } = useTranslation();
  const label = (column: Column) =>
    column.kind === 'role'
      ? t(`projectSettings.roles.${column.role}`)
      : column.kind === 'group' && column.name === 'users'
        ? t('wiki.settings.everyone')
        : column.name;
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)]">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-[var(--surface-2)]">
            <th className="tl-label px-3 py-2 text-left text-[var(--ink-muted)]">
              {t('schemes.permission')}
            </th>
            {columns.map((column) => (
              <th
                key={columnKey(column)}
                className="px-3 py-2 text-center align-bottom font-semibold"
              >
                <span className="inline-flex items-center gap-1">
                  {column.kind === 'group' && (
                    <UsersThree size={14} aria-hidden className="text-[var(--ink-muted)]" />
                  )}
                  {label(column)}
                  {onRemoveColumn && column.kind !== 'role' && (
                    <button
                      type="button"
                      aria-label={t('schemes.removeColumn', { name: label(column) })}
                      title={t('schemes.removeColumn', { name: label(column) })}
                      onClick={() => onRemoveColumn(column)}
                      className="grid size-5 place-items-center rounded-[var(--radius-sm)] text-[var(--ink-muted)] hover:text-[var(--danger)]"
                    >
                      <Trash size={12} aria-hidden />
                    </button>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PROJECT_PERMISSIONS.map((permission) => (
            <tr key={permission} className="border-t border-[var(--border)]">
              <th scope="row" className="px-3 py-2 text-left font-normal">
                {t(`schemes.permissions.${permission}`)}
              </th>
              {columns.map((column) => {
                const on = checked.has(`${permission}|${columnKey(column)}`);
                return (
                  <td key={columnKey(column)} className="px-3 py-2 text-center">
                    {onToggle ? (
                      <input
                        type="checkbox"
                        checked={on}
                        aria-label={`${t(`schemes.permissions.${permission}`)}: ${label(column)}`}
                        onChange={() => onToggle(permission, column)}
                      />
                    ) : on ? (
                      <>
                        <span aria-hidden>✓</span>
                        <span className="sr-only">{t('common.yes')}</span>
                      </>
                    ) : (
                      <span aria-hidden className="text-[var(--ink-muted)]">
                        –
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function checkedOf(grants: PermissionGrant[]): Set<string> {
  return new Set(grants.map((grant) => `${grant.permission}|${grantKey(grant)}`));
}

/** Adds a group or a person as a column of the matrix. */
function AddColumn({ onAdd }: { onAdd: (column: Column) => void }) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<'group' | 'user'>('group');
  const [search, setSearch] = useState('');
  const groups = useQuery({ ...groupsQuery, enabled: kind === 'group' });
  const users = useQuery({
    ...userSearchQuery(search.trim()),
    enabled: kind === 'user' && search.trim().length > 0,
  });
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <strong>{t('schemes.addColumn')}</strong>
      <div className="flex flex-wrap items-end gap-2">
        <Select
          label={t('wiki.settings.who')}
          value={kind}
          options={[
            { value: 'group', label: t('wiki.settings.group') },
            { value: 'user', label: t('wiki.settings.person') },
          ]}
          onChange={(event) => setKind(event.target.value as 'group' | 'user')}
        />
        {kind === 'group' && (
          <Select
            label={t('wiki.settings.group')}
            value=""
            options={[
              { value: '', label: t('wiki.settings.chooseGroup') },
              ...(groups.data ?? []).map((group) => ({ value: group.id, label: group.name })),
            ]}
            onChange={(event) => {
              const group = groups.data?.find((entry) => entry.id === event.target.value);
              if (group) onAdd({ kind: 'group', id: group.id, name: group.name });
            }}
          />
        )}
        {kind === 'user' && (
          <TextField
            label={t('wiki.settings.findPerson')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        )}
      </div>
      {kind === 'user' &&
        users.data?.map((user) => (
          <button
            key={user.id}
            type="button"
            onClick={() => {
              onAdd({ kind: 'user', id: user.id, name: user.displayName });
              setSearch('');
            }}
            className="flex min-h-9 items-center gap-2 rounded-[var(--radius-sm)] px-1 text-left hover:bg-[var(--surface-1)]"
          >
            <Avatar user={user} />
            <span className="min-w-0 flex-1 truncate">{user.displayName}</span>
          </button>
        ))}
    </div>
  );
}

/** One scheme: name, description and the matrix, saved as a whole. */
export function PermissionSchemeEditor({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scheme = useQuery(permissionSchemeQuery(id));
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [columns, setColumns] = useState<Column[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!scheme.data) return;
    setName(scheme.data.name);
    setDescription(scheme.data.description);
    setColumns(columnsOf(scheme.data.grants));
    setChecked(checkedOf(scheme.data.grants));
  }, [scheme.data]);
  const saved = useMemo(
    () => (scheme.data ? checkedOf(scheme.data.grants) : new Set()),
    [scheme.data],
  );
  const dirty =
    !!scheme.data &&
    (name !== scheme.data.name ||
      description !== scheme.data.description ||
      checked.size !== saved.size ||
      [...checked].some((entry) => !saved.has(entry)));

  const save = useMutation({
    mutationFn: () => {
      const grants: PermissionGrantInput[] = [...checked].map((entry) => {
        const [permission, key] = entry.split('|') as [ProjectPermission, string];
        const [kind, ref] = key.split(':') as [string, string];
        return kind === 'role'
          ? { permission, role: ref as ProjectRole }
          : kind === 'group'
            ? { permission, groupId: ref }
            : { permission, userId: ref };
      });
      return unwrap(
        client.PATCH('/api/v1/admin/permission-schemes/{id}', {
          params: { path: { id } },
          body: { name: name.trim(), description, grants },
        }),
      );
    },
    onSuccess: (next) => {
      queryClient.setQueryData(permissionSchemeQuery(id).queryKey, next);
      void queryClient.invalidateQueries({ queryKey: ['permission-schemes'], exact: true });
      void queryClient.invalidateQueries({ queryKey: ['project'] });
    },
  });
  const remove = useMutation({
    mutationFn: () =>
      unwrap(client.DELETE('/api/v1/admin/permission-schemes/{id}', { params: { path: { id } } })),
    // Leave first: refetching the deleted scheme would only fail.
    onSuccess: async () => {
      await navigate({ to: '/admin/permission-schemes' });
      queryClient.removeQueries({ queryKey: permissionSchemeQuery(id).queryKey });
      await queryClient.invalidateQueries({ queryKey: ['permission-schemes'], exact: true });
    },
  });

  if (!scheme.data) return null;
  const toggle = (permission: ProjectPermission, column: Column) =>
    setChecked((current) => {
      const next = new Set(current);
      const entry = `${permission}|${columnKey(column)}`;
      if (next.has(entry)) next.delete(entry);
      else next.add(entry);
      return next;
    });

  return (
    <main className="flex max-w-[980px] flex-col gap-5 px-8 py-6">
      <Link to="/admin/permission-schemes" className="text-[13px] text-[var(--ink-muted)]">
        ← {t('schemes.title')}
      </Link>
      <h1 className="tl-heading-xl m-0">{scheme.data.name}</h1>
      {(save.error ?? remove.error) && (
        <FormError message={(save.error ?? remove.error)?.message ?? ''} />
      )}
      <div className="grid max-w-[640px] gap-3 sm:grid-cols-2">
        <TextField
          label={t('schemes.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label={t('schemes.description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <p className="m-0 text-sm text-[var(--ink-muted)]">
        {scheme.data.projects.length === 0
          ? t('schemes.unused')
          : t('schemes.usedBy', {
              projects: scheme.data.projects.map((project) => project.name).join(', '),
            })}
        {scheme.data.isDefault && ` ${t('schemes.defaultNote')}`}
      </p>
      <PermissionMatrix
        columns={columns}
        checked={checked}
        onToggle={toggle}
        onRemoveColumn={(column) => {
          setColumns((current) =>
            current.filter((entry) => columnKey(entry) !== columnKey(column)),
          );
          setChecked(
            (current) =>
              new Set([...current].filter((entry) => !entry.endsWith(`|${columnKey(column)}`))),
          );
        }}
      />
      <AddColumn
        onAdd={(column) =>
          setColumns((current) =>
            current.some((entry) => columnKey(entry) === columnKey(column))
              ? current
              : [...current, column],
          )
        }
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={!dirty || !name.trim() || save.isPending}
          onClick={() => save.mutate()}
        >
          {t('common.save')}
        </Button>
        {!scheme.data.isDefault && scheme.data.projects.length === 0 && (
          <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>
            {t('schemes.delete')}
          </Button>
        )}
      </div>
    </main>
  );
}

/** All schemes with the projects using them, and a new one as a copy (E-82). */
export function PermissionSchemesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const schemes = useQuery(permissionSchemesQuery);
  const [name, setName] = useState('');
  const [copyFrom, setCopyFrom] = useState('');
  const create = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/admin/permission-schemes', {
          body: { name: name.trim(), ...(copyFrom ? { copyFromId: copyFrom } : {}) },
        }),
      ),
    onSuccess: (scheme) =>
      void navigate({ to: '/admin/permission-schemes/$id', params: { id: scheme.id } }),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }
  return (
    <main className="flex max-w-[880px] flex-col gap-5 px-8 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="tl-heading-xl m-0">{t('schemes.title')}</h1>
        <p className="m-0 text-sm text-[var(--ink-muted)]">{t('schemes.intro')}</p>
      </header>
      <ul className="m-0 flex list-none flex-col rounded-[var(--radius-md)] border border-[var(--border)] p-0">
        {schemes.data?.map((scheme) => (
          <li
            key={scheme.id}
            className="flex flex-col gap-0.5 border-b border-[var(--border)] px-4 py-3 last:border-b-0"
          >
            <Link
              to="/admin/permission-schemes/$id"
              params={{ id: scheme.id }}
              className="font-semibold text-[var(--ink)]"
            >
              {scheme.name}
              {scheme.isDefault && (
                <span className="ml-2 rounded-[var(--radius-sm)] bg-[var(--accent-soft)] px-1.5 py-0.5 text-[11px] text-[var(--accent)]">
                  {t('schemes.default')}
                </span>
              )}
            </Link>
            {scheme.description && (
              <span className="text-[13px] text-[var(--ink-muted)]">{scheme.description}</span>
            )}
            <span className="text-xs text-[var(--ink-muted)]">
              {scheme.projects.length === 0
                ? t('schemes.unused')
                : t('schemes.usedBy', {
                    projects: scheme.projects.map((project) => project.key).join(', '),
                  })}
            </span>
          </li>
        ))}
      </ul>
      <form
        onSubmit={submit}
        className="flex flex-wrap items-end gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3"
      >
        {create.error && <FormError message={create.error.message} />}
        <TextField
          label={t('schemes.newName')}
          value={name}
          required
          onChange={(event) => setName(event.target.value)}
        />
        <Select
          label={t('schemes.copyFrom')}
          value={copyFrom}
          options={[
            { value: '', label: t('schemes.copyDefault') },
            ...(schemes.data ?? [])
              .filter((scheme) => !scheme.isDefault)
              .map((scheme) => ({ value: scheme.id, label: scheme.name })),
          ]}
          onChange={(event) => setCopyFrom(event.target.value)}
        />
        <Button type="submit" variant="primary" disabled={!name.trim() || create.isPending}>
          <Plus size={14} aria-hidden />
          {t('schemes.create')}
        </Button>
      </form>
    </main>
  );
}
