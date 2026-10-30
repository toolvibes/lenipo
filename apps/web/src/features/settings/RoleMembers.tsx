import { UserCircle, UsersThree, X } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import type { UserRef } from '@tasklore/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { groupsQuery, userSearchQuery } from '../../lib/wiki';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { Avatar } from '../tracking/UserPicker';

export interface RoleMember<Role extends string> {
  id: string;
  role: Role;
  user: UserRef | null;
  group: { id: string; name: string } | null;
}

export type RoleGrant<Role extends string> =
  | { role: Role; userId: string }
  | { role: Role; groupId: string };

function MemberLine({
  member,
  onRemove,
  disabled,
}: {
  member: RoleMember<string>;
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

/**
 * Who holds which role, with removing and adding people (searched by name or e-mail) or
 * groups. Used by Lore spaces (E-60) and projects (TL-65).
 */
export function RoleMembers<Role extends string>({
  roles,
  defaultRole,
  roleLabel,
  roleHelp,
  members,
  error,
  busy,
  onRemove,
  onAdd,
}: {
  roles: readonly Role[];
  defaultRole: Role;
  roleLabel: (role: Role) => string;
  roleHelp: (role: Role) => string;
  members: RoleMember<Role>[] | undefined;
  error: Error | null;
  busy: boolean;
  onRemove: (id: string) => void;
  /** Resolves once the role is given, so the form can clear itself. */
  onAdd: (grant: RoleGrant<Role>) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [role, setRole] = useState<Role>(defaultRole);
  const [kind, setKind] = useState<'user' | 'group'>('user');
  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState('');
  const groups = useQuery({ ...groupsQuery, enabled: kind === 'group' });
  const users = useQuery({
    ...userSearchQuery(search.trim()),
    enabled: kind === 'user' && search.trim().length > 0,
  });
  const add = (grant: RoleGrant<Role>) =>
    void onAdd(grant).then(() => {
      setSearch('');
      setGroupId('');
    });

  return (
    <>
      {error && <FormError message={error.message} />}
      <div className="grid gap-4 sm:grid-cols-2">
        {roles.map((entry) => {
          const holders = members?.filter((member) => member.role === entry) ?? [];
          return (
            <div key={entry} className="flex flex-col gap-1">
              <h3 className="tl-label m-0 text-[var(--ink-muted)]">{roleLabel(entry)}</h3>
              <p className="m-0 text-xs text-[var(--ink-muted)]">{roleHelp(entry)}</p>
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
                      disabled={busy}
                      onRemove={() => onRemove(member.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3">
        <strong>{t('wiki.settings.addMember')}</strong>
        <div className="flex flex-wrap items-end gap-2">
          <Select
            label={t('wiki.settings.role')}
            value={role}
            options={roles.map((value) => ({ value, label: roleLabel(value) }))}
            onChange={(event) => setRole(event.target.value as Role)}
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
                disabled={!groupId || busy}
                onClick={() => add({ role, groupId })}
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
              <p className="m-0 text-sm text-[var(--ink-muted)]">
                {t('wiki.settings.nobodyFound')}
              </p>
            )}
            <ul className="m-0 flex list-none flex-col p-0">
              {users.data?.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => add({ role, userId: user.id })}
                    className="flex min-h-9 w-full items-center gap-2 rounded-[var(--radius-sm)] px-1 text-left hover:bg-[var(--surface-1)]"
                  >
                    <Avatar user={user} />
                    <span className="min-w-0 flex-1 truncate">
                      {user.displayName}{' '}
                      <span className="text-xs text-[var(--ink-muted)]">{user.email}</span>
                    </span>
                    <span className="text-xs text-[var(--accent)]">
                      {t('wiki.settings.addAs', { role: roleLabel(role) })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
