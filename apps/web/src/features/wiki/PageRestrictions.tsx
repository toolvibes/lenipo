import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PageRestrictions, UserRef } from '@tasklore/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { groupsQuery } from '../../lib/wiki';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';

type Kind = 'view' | 'edit';
type Lists = Record<Kind, { users: UserRef[]; groups: Array<{ id: string; name: string }> }>;

const CHIP =
  'flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[12.5px]';

/** One list: who may view or edit, with people found by name and groups to pick. */
function RestrictionList({
  kind,
  spaceKey,
  lists,
  onChange,
}: {
  kind: Kind;
  spaceKey: string;
  lists: Lists;
  onChange: (lists: Lists) => void;
}) {
  const { t } = useTranslation();
  const groups = useQuery(groupsQuery);
  const [query, setQuery] = useState('');
  const people = useQuery({
    queryKey: ['space-users', spaceKey, query],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/spaces/{key}/users', {
          params: { path: { key: spaceKey }, query: { query, limit: 6 } },
        }),
      ),
    enabled: query.trim().length > 0,
  });
  const list = lists[kind];
  const set = (next: Lists[Kind]) => onChange({ ...lists, [kind]: next });
  return (
    <section className="flex flex-col gap-2">
      <h3 className="m-0 text-[13.5px] font-semibold">{t(`restrictions.${kind}`)}</h3>
      <p className="m-0 text-xs text-[var(--ink-muted)]">{t(`restrictions.${kind}Help`)}</p>
      <div className="flex flex-wrap gap-1.5">
        {list.users.length + list.groups.length === 0 && (
          <span className="text-[13px] text-[var(--ink-muted)]">{t('restrictions.open')}</span>
        )}
        {list.users.map((user) => (
          <span key={user.id} className={CHIP}>
            {user.displayName}
            <button
              type="button"
              aria-label={t('restrictions.remove', { name: user.displayName })}
              onClick={() => set({ ...list, users: list.users.filter((u) => u.id !== user.id) })}
              className="cursor-pointer border-0 bg-transparent p-0 text-[var(--ink-muted)]"
            >
              ×
            </button>
          </span>
        ))}
        {list.groups.map((group) => (
          <span key={group.id} className={CHIP}>
            {t('restrictions.group', { name: group.name })}
            <button
              type="button"
              aria-label={t('restrictions.remove', { name: group.name })}
              onClick={() => set({ ...list, groups: list.groups.filter((g) => g.id !== group.id) })}
              className="cursor-pointer border-0 bg-transparent p-0 text-[var(--ink-muted)]"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex flex-col gap-1">
          <input
            aria-label={t('restrictions.addPerson')}
            placeholder={t('restrictions.addPerson')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-8 w-52 rounded-[var(--radius-md)] border border-[var(--border-control)] bg-[var(--surface-1)] px-2 text-[13px] text-[var(--ink)]"
          />
          {query.trim() &&
            (people.data ?? [])
              .filter((person) => !list.users.some((user) => user.id === person.id))
              .map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => {
                    set({ ...list, users: [...list.users, person] });
                    setQuery('');
                  }}
                  className="cursor-pointer rounded-[var(--radius-sm)] border-0 bg-transparent px-2 py-1 text-left text-[13px] hover:bg-[var(--surface-2)]"
                >
                  {person.displayName}
                </button>
              ))}
        </div>
        <select
          aria-label={t('restrictions.addGroup')}
          value=""
          onChange={(event) => {
            const group = groups.data?.find((entry) => entry.id === event.target.value);
            if (group)
              set({ ...list, groups: [...list.groups, { id: group.id, name: group.name }] });
          }}
          className="h-8 rounded-[var(--radius-md)] border border-[var(--border-control)] bg-[var(--surface-1)] px-2 text-[13px] text-[var(--ink)]"
        >
          <option value="">{t('restrictions.addGroup')}</option>
          {(groups.data ?? [])
            .filter((group) => !list.groups.some((entry) => entry.id === group.id))
            .map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
        </select>
      </div>
    </section>
  );
}

/** Who may see and edit a page (TL-14, E-95); for people who may edit it. */
export function PageRestrictionsDialog({
  pageId,
  spaceKey,
  open,
  onOpenChange,
}: {
  pageId: string;
  spaceKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const current = useQuery({
    queryKey: ['page-restrictions', pageId],
    queryFn: () =>
      unwrap(client.GET('/api/v1/pages/{id}/restrictions', { params: { path: { id: pageId } } })),
    enabled: open,
  });
  const [lists, setLists] = useState<Lists>({
    view: { users: [], groups: [] },
    edit: { users: [], groups: [] },
  });
  useEffect(() => {
    if (current.data) setLists({ view: current.data.view, edit: current.data.edit });
  }, [current.data]);
  const save = useMutation({
    mutationFn: () => {
      const input = (kind: Kind) => ({
        userIds: lists[kind].users.map((user) => user.id),
        groupIds: lists[kind].groups.map((group) => group.id),
      });
      return unwrap(
        client.PUT('/api/v1/pages/{id}/restrictions', {
          params: { path: { id: pageId } },
          body: { view: input('view'), edit: input('edit') },
        }),
      );
    },
    onSuccess: (saved: PageRestrictions) => {
      queryClient.setQueryData(['page-restrictions', pageId], saved);
      void queryClient.invalidateQueries({ queryKey: ['page', pageId] });
      void queryClient.invalidateQueries({ queryKey: ['space-pages', spaceKey] });
      onOpenChange(false);
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('restrictions.title')}
      description={t('restrictions.intro')}
      width={560}
    >
      <div className="flex flex-col gap-5">
        {save.error && <FormError message={save.error.message} />}
        {current.data && current.data.inheritedFrom.length > 0 && (
          <p className="m-0 rounded-[var(--radius-md)] bg-[var(--surface-2)] px-3 py-2 text-[13px]">
            {t('restrictions.inherited', {
              pages: current.data.inheritedFrom.map((page) => page.title).join(', '),
            })}
          </p>
        )}
        <RestrictionList kind="view" spaceKey={spaceKey} lists={lists} onChange={setLists} />
        <RestrictionList kind="edit" spaceKey={spaceKey} lists={lists} onChange={setLists} />
        <p className="m-0 text-xs text-[var(--ink-muted)]">{t('restrictions.self')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
