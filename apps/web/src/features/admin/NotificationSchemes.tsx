import { Plus } from '@phosphor-icons/react';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  NOTIFICATION_EVENTS,
  type NotificationEvent,
  type NotificationRule,
  type NotificationRuleInput,
  PROJECT_ROLES,
  type ProjectRole,
} from '@toolvibes/shared';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';
import { AddColumn, type Column, columnKey, SchemeMatrix } from './PermissionSchemes';

export const notificationSchemesQuery = queryOptions({
  queryKey: ['notification-schemes'],
  queryFn: () => unwrap(client.GET('/api/v1/admin/notification-schemes')),
});

export const notificationSchemeQuery = (id: string) =>
  queryOptions({
    queryKey: ['notification-schemes', id],
    queryFn: () =>
      unwrap(client.GET('/api/v1/admin/notification-schemes/{id}', { params: { path: { id } } })),
  });

const SPECIAL = ['watchers', 'assignee', 'reporter'] as const;

const ruleColumn = (rule: NotificationRule): Column =>
  rule.recipient === 'role'
    ? { kind: 'role', role: rule.role ?? 'users' }
    : rule.recipient === 'group'
      ? { kind: 'group', id: rule.group?.id ?? '', name: rule.group?.name ?? '' }
      : rule.recipient === 'user'
        ? { kind: 'user', id: rule.user?.id ?? '', name: rule.user?.displayName ?? '' }
        : { kind: 'special', key: rule.recipient };

/** Watchers, assignee, reporter and the roles always; groups and people once they get something. */
export function notificationColumns(rules: NotificationRule[]): Column[] {
  const fixed: Column[] = [
    ...SPECIAL.map((key) => ({ kind: 'special' as const, key })),
    ...PROJECT_ROLES.map((role) => ({ kind: 'role' as const, role })),
  ];
  const extra = new Map<string, Column>();
  for (const rule of rules) {
    const column = ruleColumn(rule);
    if (column.kind === 'group' || column.kind === 'user') extra.set(columnKey(column), column);
  }
  return [...fixed, ...extra.values()];
}

export function notificationChecked(rules: NotificationRule[]): Set<string> {
  return new Set(rules.map((rule) => `${rule.event}|${columnKey(ruleColumn(rule))}`));
}

export function NotificationMatrix(props: {
  columns: Column[];
  checked: Set<string>;
  onToggle?: (event: string, column: Column) => void;
  onRemoveColumn?: (column: Column) => void;
}) {
  const { t } = useTranslation();
  return (
    <SchemeMatrix
      {...props}
      header={t('notificationSchemes.event')}
      rows={NOTIFICATION_EVENTS.map((event) => ({
        key: event,
        label: t(`notificationSchemes.events.${event}`),
      }))}
    />
  );
}

export function NotificationSchemeEditor({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scheme = useQuery(notificationSchemeQuery(id));
  const [name, setName] = useState('');
  const [columns, setColumns] = useState<Column[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!scheme.data) return;
    setName(scheme.data.name);
    setColumns(notificationColumns(scheme.data.rules));
    setChecked(notificationChecked(scheme.data.rules));
  }, [scheme.data]);
  const saved = useMemo(
    () => (scheme.data ? notificationChecked(scheme.data.rules) : new Set<string>()),
    [scheme.data],
  );
  const dirty =
    !!scheme.data &&
    (name !== scheme.data.name ||
      checked.size !== saved.size ||
      [...checked].some((entry) => !saved.has(entry)));
  const save = useMutation({
    mutationFn: () => {
      const rules: NotificationRuleInput[] = [...checked].map((entry) => {
        const [event, key] = entry.split('|') as [NotificationEvent, string];
        const [kind, ref] = key.split(':') as [string, string];
        return kind === 'special'
          ? { event, recipient: ref as (typeof SPECIAL)[number] }
          : kind === 'role'
            ? { event, role: ref as ProjectRole }
            : kind === 'group'
              ? { event, groupId: ref }
              : { event, userId: ref };
      });
      return unwrap(
        client.PATCH('/api/v1/admin/notification-schemes/{id}', {
          params: { path: { id } },
          body: { name: name.trim(), rules },
        }),
      );
    },
    onSuccess: (next) => {
      queryClient.setQueryData(notificationSchemeQuery(id).queryKey, next);
      void queryClient.invalidateQueries({ queryKey: ['notification-schemes'], exact: true });
      void queryClient.invalidateQueries({ queryKey: ['project'] });
    },
  });
  const remove = useMutation({
    mutationFn: () =>
      unwrap(
        client.DELETE('/api/v1/admin/notification-schemes/{id}', { params: { path: { id } } }),
      ),
    // Leave first: refetching the deleted scheme would only fail.
    onSuccess: async () => {
      await navigate({ to: '/admin/notification-schemes' });
      queryClient.removeQueries({ queryKey: notificationSchemeQuery(id).queryKey });
      await queryClient.invalidateQueries({ queryKey: ['notification-schemes'], exact: true });
    },
  });
  if (!scheme.data) return null;
  const toggle = (event: string, column: Column) =>
    setChecked((current) => {
      const next = new Set(current);
      const entry = `${event}|${columnKey(column)}`;
      if (next.has(entry)) next.delete(entry);
      else next.add(entry);
      return next;
    });
  return (
    <main className="flex max-w-[1080px] flex-col gap-5 px-8 py-6">
      <Link to="/admin/notification-schemes" className="text-[13px] text-[var(--ink-muted)]">
        ← {t('notificationSchemes.title')}
      </Link>
      <h1 className="tl-heading-xl m-0">{scheme.data.name}</h1>
      {(save.error ?? remove.error) && (
        <FormError message={(save.error ?? remove.error)?.message ?? ''} />
      )}
      <div className="max-w-[320px]">
        <TextField
          label={t('schemes.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <p className="m-0 text-sm text-[var(--ink-muted)]">
        {t('notificationSchemes.intro')}{' '}
        {scheme.data.projects.length === 0
          ? t('schemes.unused')
          : t('schemes.usedBy', {
              projects: scheme.data.projects.map((project) => project.name).join(', '),
            })}
      </p>
      <NotificationMatrix
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

/** All notification schemes with the projects using them (P-NTF-03, E-83). */
export function NotificationSchemesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const schemes = useQuery(notificationSchemesQuery);
  const [name, setName] = useState('');
  const [copyFrom, setCopyFrom] = useState('');
  const create = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/admin/notification-schemes', {
          body: { name: name.trim(), ...(copyFrom ? { copyFromId: copyFrom } : {}) },
        }),
      ),
    onSuccess: (scheme) =>
      void navigate({ to: '/admin/notification-schemes/$id', params: { id: scheme.id } }),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }
  return (
    <main className="flex max-w-[880px] flex-col gap-5 px-8 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="tl-heading-xl m-0">{t('notificationSchemes.title')}</h1>
        <p className="m-0 text-sm text-[var(--ink-muted)]">{t('notificationSchemes.intro')}</p>
      </header>
      <ul className="m-0 flex list-none flex-col rounded-[var(--radius-md)] border border-[var(--border)] p-0">
        {schemes.data?.map((scheme) => (
          <li
            key={scheme.id}
            className="flex flex-col gap-0.5 border-b border-[var(--border)] px-4 py-3 last:border-b-0"
          >
            <Link
              to="/admin/notification-schemes/$id"
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
