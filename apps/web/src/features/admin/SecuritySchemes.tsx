import { Plus, Trash } from '@phosphor-icons/react';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  PROJECT_ROLES,
  type SecurityGrantInput,
  type SecurityLevel,
  type UpdateSecuritySchemeRequest,
} from '@toolvibes/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { groupsQuery } from '../../lib/wiki';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';

export const securitySchemesQuery = queryOptions({
  queryKey: ['security-schemes'],
  queryFn: () => unwrap(client.GET('/api/v1/admin/security-schemes')),
});

export const securitySchemeQuery = (id: string) =>
  queryOptions({
    queryKey: ['security-schemes', id],
    queryFn: () =>
      unwrap(client.GET('/api/v1/admin/security-schemes/{id}', { params: { path: { id } } })),
  });

type LevelDraft = NonNullable<UpdateSecuritySchemeRequest['levels']>[number] & { key: string };

/** Grants as written to the API; people chosen elsewhere keep their entries. */
function grantInputs(level: SecurityLevel): SecurityGrantInput[] {
  return level.grants.map((grant) =>
    grant.grantee === 'role'
      ? { role: grant.role ?? 'users' }
      : grant.grantee === 'group'
        ? { groupId: grant.group?.id ?? '' }
        : grant.grantee === 'user'
          ? { userId: grant.user?.id ?? '' }
          : { grantee: grant.grantee },
  );
}

const same = (a: SecurityGrantInput, b: SecurityGrantInput) =>
  JSON.stringify(a) === JSON.stringify(b);

/** One scheme: its levels, who sees issues of each, and the default (TL-13, E-94). */
export function SecuritySchemeEditor({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scheme = useQuery(securitySchemeQuery(id));
  const groups = useQuery(groupsQuery);
  const [name, setName] = useState('');
  const [levels, setLevels] = useState<LevelDraft[]>([]);
  const [defaultKey, setDefaultKey] = useState<string | null>(null);
  useEffect(() => {
    if (!scheme.data) return;
    setName(scheme.data.name);
    setLevels(
      scheme.data.levels.map((level) => ({
        key: level.id,
        id: level.id,
        name: level.name,
        description: level.description,
        grants: grantInputs(level),
      })),
    );
    setDefaultKey(scheme.data.defaultLevelId);
  }, [scheme.data]);
  const save = useMutation({
    mutationFn: () => {
      const index = levels.findIndex((level) => level.key === defaultKey);
      return unwrap(
        client.PATCH('/api/v1/admin/security-schemes/{id}', {
          params: { path: { id } },
          body: {
            name: name.trim(),
            levels: levels.map(({ key: _key, ...level }) => level),
            defaultLevel: index >= 0 ? index : null,
          },
        }),
      );
    },
    onSuccess: (next) => {
      queryClient.setQueryData(securitySchemeQuery(id).queryKey, next);
      void queryClient.invalidateQueries({ queryKey: ['security-schemes'], exact: true });
      void queryClient.invalidateQueries({ queryKey: ['project'] });
    },
  });
  const remove = useMutation({
    mutationFn: () =>
      unwrap(client.DELETE('/api/v1/admin/security-schemes/{id}', { params: { path: { id } } })),
    onSuccess: async () => {
      await navigate({ to: '/admin/security-schemes' });
      queryClient.removeQueries({ queryKey: securitySchemeQuery(id).queryKey });
      await queryClient.invalidateQueries({ queryKey: ['security-schemes'], exact: true });
    },
  });
  if (!scheme.data) return null;
  const change = (key: string, patch: Partial<LevelDraft>) =>
    setLevels((current) =>
      current.map((level) => (level.key === key ? { ...level, ...patch } : level)),
    );
  const toggle = (level: LevelDraft, grant: SecurityGrantInput) =>
    change(level.key, {
      grants: level.grants.some((entry) => same(entry, grant))
        ? level.grants.filter((entry) => !same(entry, grant))
        : [...level.grants, grant],
    });
  const choices: Array<{ grant: SecurityGrantInput; label: string }> = [
    ...PROJECT_ROLES.map((role) => ({
      grant: { role },
      label: t(`projectSettings.roles.${role}`),
    })),
    { grant: { grantee: 'reporter' as const }, label: t('issues.reporter') },
    { grant: { grantee: 'assignee' as const }, label: t('issues.assignee') },
    ...(groups.data ?? []).map((group) => ({ grant: { groupId: group.id }, label: group.name })),
  ];
  return (
    <main className="flex max-w-[880px] flex-col gap-5 px-8 py-6">
      <Link to="/admin/security-schemes" className="text-[13px] text-[var(--ink-muted)]">
        ← {t('security.title')}
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
        {t('security.intro')}{' '}
        {scheme.data.projects.length === 0
          ? t('schemes.unused')
          : t('schemes.usedBy', {
              projects: scheme.data.projects.map((project) => project.name).join(', '),
            })}
      </p>
      {levels.map((level) => (
        <fieldset
          key={level.key}
          className="m-0 flex flex-col gap-2 rounded-lg border border-[var(--border)] p-4"
        >
          <legend className="sr-only">{level.name}</legend>
          <div className="flex flex-wrap items-end gap-3">
            <TextField
              label={t('security.levelName')}
              value={level.name}
              onChange={(event) => change(level.key, { name: event.target.value })}
            />
            <label className="flex items-center gap-2 pb-2 text-[13px]">
              <input
                type="radio"
                name="default-level"
                checked={defaultKey === level.key}
                onChange={() => setDefaultKey(level.key)}
              />
              {t('security.default')}
            </label>
            <Button
              variant="ghost"
              aria-label={t('security.removeLevel', { name: level.name })}
              onClick={() => {
                setLevels((current) => current.filter((entry) => entry.key !== level.key));
                if (defaultKey === level.key) setDefaultKey(null);
              }}
            >
              <Trash size={14} aria-hidden />
            </Button>
          </div>
          <span className="text-xs text-[var(--ink-muted)]">{t('security.sees')}</span>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            {choices.map((choice) => (
              <label key={JSON.stringify(choice.grant)} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={level.grants.some((entry) => same(entry, choice.grant))}
                  onChange={() => toggle(level, choice.grant)}
                />
                {choice.label}
              </label>
            ))}
          </div>
          {level.grants.some((grant) => 'userId' in grant) && (
            <span className="text-xs text-[var(--ink-muted)]">
              {t('security.people', {
                count: level.grants.filter((grant) => 'userId' in grant).length,
              })}
            </span>
          )}
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() =>
            setLevels((current) => [
              ...current,
              {
                key: `new:${crypto.randomUUID()}`,
                name: t('security.newLevel'),
                description: '',
                grants: [],
              },
            ])
          }
        >
          <Plus size={14} aria-hidden />
          {t('security.addLevel')}
        </Button>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="radio"
            name="default-level"
            checked={defaultKey === null}
            onChange={() => setDefaultKey(null)}
          />
          {t('security.noDefault')}
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={!name.trim() || levels.some((level) => !level.name.trim()) || save.isPending}
          onClick={() => save.mutate()}
        >
          {t('common.save')}
        </Button>
        {scheme.data.projects.length === 0 && (
          <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>
            {t('schemes.delete')}
          </Button>
        )}
      </div>
    </main>
  );
}

/** All issue security schemes with the projects using them (TL-13, E-94). */
export function SecuritySchemesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const schemes = useQuery(securitySchemesQuery);
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () =>
      unwrap(client.POST('/api/v1/admin/security-schemes', { body: { name: name.trim() } })),
    onSuccess: (scheme) =>
      void navigate({ to: '/admin/security-schemes/$id', params: { id: scheme.id } }),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate();
  }
  return (
    <main className="flex max-w-[880px] flex-col gap-5 px-8 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="tl-heading-xl m-0">{t('security.title')}</h1>
        <p className="m-0 text-sm text-[var(--ink-muted)]">{t('security.intro')}</p>
      </header>
      {schemes.data && schemes.data.length > 0 && (
        <ul className="m-0 flex list-none flex-col rounded-[var(--radius-md)] border border-[var(--border)] p-0">
          {schemes.data.map((scheme) => (
            <li
              key={scheme.id}
              className="flex flex-col gap-0.5 border-b border-[var(--border)] px-4 py-3 last:border-b-0"
            >
              <Link
                to="/admin/security-schemes/$id"
                params={{ id: scheme.id }}
                className="font-semibold text-[var(--ink)]"
              >
                {scheme.name}
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
      )}
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
        <Button type="submit" variant="primary" disabled={!name.trim() || create.isPending}>
          <Plus size={14} aria-hidden />
          {t('schemes.create')}
        </Button>
      </form>
    </main>
  );
}
