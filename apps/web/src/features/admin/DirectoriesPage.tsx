import { ArrowDown, ArrowUp } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Directory, LdapConfig } from '@toolvibes/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';

const EMPTY: LdapConfig = {
  url: 'ldap://',
  startTls: false,
  bindDn: '',
  bindPassword: '',
  userBase: '',
  userFilter: '(objectClass=person)',
  loginAttribute: 'uid',
  emailAttribute: 'mail',
  nameAttribute: 'cn',
  groupBase: '',
  groupFilter: '(objectClass=groupOfNames)',
  groupNameAttribute: 'cn',
  groupMemberAttribute: 'member',
};

const FIELDS: Array<keyof LdapConfig> = [
  'url',
  'bindDn',
  'bindPassword',
  'userBase',
  'userFilter',
  'loginAttribute',
  'emailAttribute',
  'nameAttribute',
  'groupBase',
  'groupFilter',
  'groupNameAttribute',
  'groupMemberAttribute',
];

function DirectoryDialog({
  editing,
  open,
  onOpenChange,
}: {
  editing: Directory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState(editing?.name ?? '');
  const [config, setConfig] = useState<LdapConfig>(
    editing?.config ? { ...EMPTY, ...editing.config, bindPassword: '' } : EMPTY,
  );
  const [tested, setTested] = useState<{ ok: boolean; message: string } | null>(null);
  const save = useMutation({
    mutationFn: () =>
      editing
        ? unwrap(
            client.PUT('/api/v1/admin/directories/{id}', {
              params: { path: { id: editing.id } },
              body: { name, enabled: editing.enabled, config },
            }),
          )
        : unwrap(
            client.POST('/api/v1/admin/directories', { body: { name, enabled: true, config } }),
          ),
    onSuccess: (list) => {
      queryClient.setQueryData(['admin', 'directories'], list);
      onOpenChange(false);
    },
  });
  const test = useMutation({
    mutationFn: () => unwrap(client.POST('/api/v1/admin/directories/test', { body: config })),
    onSuccess: setTested,
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t('directories.edit') : t('directories.add')}
      width={620}
    >
      <form className="flex flex-col gap-3" onSubmit={submit}>
        {save.error && <FormError message={save.error.message} />}
        <TextField
          label={t('directories.name')}
          value={name}
          required
          onChange={(event) => setName(event.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <TextField
              key={field}
              label={t(`directories.fields.${field}`)}
              type={field === 'bindPassword' ? 'password' : 'text'}
              autoComplete="off"
              placeholder={
                field === 'bindPassword' && editing?.config?.hasPassword
                  ? t('directories.keepPassword')
                  : undefined
              }
              value={String(config[field] ?? '')}
              onChange={(event) => setConfig({ ...config, [field]: event.target.value })}
            />
          ))}
        </div>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={config.startTls}
            onChange={(event) => setConfig({ ...config, startTls: event.target.checked })}
          />
          StartTLS
        </label>
        {tested && (
          <p className={`m-0 text-[13px] ${tested.ok ? '' : 'text-[var(--danger)]'}`} role="status">
            {tested.message}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => test.mutate()}
            disabled={test.isPending}
          >
            {t('directories.test')}
          </Button>
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** User directories in sign-in order: internal plus LDAP/AD (TL-38, E-119). */
export function DirectoriesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const directories = useQuery({
    queryKey: ['admin', 'directories'],
    queryFn: () => unwrap(client.GET('/api/v1/admin/directories')),
  });
  const [dialog, setDialog] = useState<{ editing: Directory | null } | null>(null);
  const set = (list: Directory[]) => queryClient.setQueryData(['admin', 'directories'], list);
  const reorder = useMutation({
    mutationFn: (ids: string[]) =>
      unwrap(client.PUT('/api/v1/admin/directories/order', { body: { ids } })),
    onSuccess: set,
  });
  const sync = useMutation({
    mutationFn: (id: string) =>
      unwrap(client.POST('/api/v1/admin/directories/{id}/sync', { params: { path: { id } } })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin', 'directories'] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      unwrap(client.DELETE('/api/v1/admin/directories/{id}', { params: { path: { id } } })),
    onSuccess: set,
  });
  const list = directories.data ?? [];
  const move = (index: number, by: number) => {
    const ids = list.map((entry) => entry.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + by, 0, moved as string);
    reorder.mutate(ids);
  };
  const error = reorder.error ?? sync.error ?? remove.error;
  return (
    <div className="flex max-w-[760px] flex-col gap-5">
      <h1 className="m-0 text-[24px] leading-[30px] font-extrabold tracking-[-0.025em]">
        {t('directories.title')}
      </h1>
      <p className="m-0 text-[var(--ink-muted)]">{t('directories.intro')}</p>
      {error && <FormError message={error.message} />}
      <ol className="m-0 flex list-none flex-col p-0">
        {list.map((entry, index) => (
          <li
            key={entry.id}
            className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] py-2.5 text-[13px]"
          >
            <span className="flex flex-col">
              <button
                type="button"
                aria-label={t('directories.up')}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="text-[var(--ink-muted)] disabled:opacity-30"
              >
                <ArrowUp size={14} aria-hidden />
              </button>
              <button
                type="button"
                aria-label={t('directories.down')}
                disabled={index === list.length - 1}
                onClick={() => move(index, 1)}
                className="text-[var(--ink-muted)] disabled:opacity-30"
              >
                <ArrowDown size={14} aria-hidden />
              </button>
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <strong>
                {index + 1}. {entry.name}
              </strong>
              <span className="text-xs text-[var(--ink-muted)]">
                {entry.type === 'internal' ? t('directories.internal') : entry.config?.url} ·{' '}
                {t('directories.people', { count: entry.users })}
                {entry.lastSyncAt &&
                  ` · ${formatRelative(entry.lastSyncAt)}: ${entry.lastSyncResult ?? ''}`}
              </span>
            </span>
            {entry.type === 'ldap' && (
              <span className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => sync.mutate(entry.id)}
                  disabled={sync.isPending}
                >
                  {t('directories.sync')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDialog({ editing: entry })}>
                  {t('directories.edit')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(entry.id)}>
                  {t('directories.remove')}
                </Button>
              </span>
            )}
          </li>
        ))}
      </ol>
      <div>
        <Button variant="primary" onClick={() => setDialog({ editing: null })}>
          {t('directories.add')}
        </Button>
      </div>
      <SamlProviders />
      {dialog && (
        <DirectoryDialog
          editing={dialog.editing}
          open
          onOpenChange={(open) => !open && setDialog(null)}
        />
      )}
      <ScimTokens />
    </div>
  );
}

/** SAML 2.0 identity providers (P-USR-05, E-119). */
function SamlProviders() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const providers = useQuery({
    queryKey: ['admin', 'saml'],
    queryFn: () => unwrap(client.GET('/api/v1/admin/saml-providers')),
  });
  const [name, setName] = useState('');
  const [metadata, setMetadata] = useState('');
  const [groupsAttribute, setGroupsAttribute] = useState('');
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'saml'] });
  const add = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/admin/saml-providers', {
          body: {
            name: name.trim(),
            metadata,
            groupsAttribute: groupsAttribute.trim(),
            enabled: true,
            emailAttribute: 'email',
            nameAttribute: 'displayName',
            createUsers: true,
          },
        }),
      ),
    onSuccess: () => {
      setName('');
      setMetadata('');
      void refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      unwrap(client.DELETE('/api/v1/admin/saml-providers/{id}', { params: { path: { id } } })),
    onSettled: refresh,
  });
  return (
    <section className="flex flex-col gap-3 border-t border-[var(--border)] pt-5">
      <h2 className="m-0 text-base font-semibold">{t('directories.samlTitle')}</h2>
      <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('directories.samlIntro')}</p>
      {(add.error || remove.error) && (
        <FormError message={(add.error ?? remove.error)?.message ?? ''} />
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {(providers.data ?? []).map((provider) => (
          <li
            key={provider.id}
            className="flex flex-wrap items-start gap-3 border-b border-[var(--border)] py-2.5 text-[13px]"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <strong>{provider.name}</strong>
              <span className="text-xs text-[var(--ink-muted)]">{provider.idpEntityId}</span>
              <span className="text-xs break-all">
                {t('directories.spEntity')}: <code>{provider.spEntityId}</code>
              </span>
              <span className="text-xs break-all">
                ACS: <code>{provider.acsUrl}</code>
              </span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => remove.mutate(provider.id)}>
              {t('directories.remove')}
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <TextField
          label={t('directories.name')}
          value={name}
          required
          onChange={(event) => setName(event.target.value)}
        />
        <label className="flex flex-col gap-1.5">
          <span className="tl-label text-[var(--ink-muted)]">{t('directories.samlMetadata')}</span>
          <textarea
            value={metadata}
            required
            rows={4}
            onChange={(event) => setMetadata(event.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 py-1.5 font-mono text-xs"
          />
        </label>
        <TextField
          label={t('directories.samlGroups')}
          value={groupsAttribute}
          onChange={(event) => setGroupsAttribute(event.target.value)}
        />
        <div>
          <Button type="submit" variant="primary" disabled={add.isPending}>
            {t('directories.samlAdd')}
          </Button>
        </div>
      </form>
    </section>
  );
}

/** Tokens for identity providers that provision people and groups over SCIM (TL-52, E-141). */
function ScimTokens() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ['admin', 'scim-tokens'];
  const tokens = useQuery({
    queryKey,
    queryFn: () => unwrap(client.GET('/api/v1/admin/scim-tokens')),
  });
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () => unwrap(client.POST('/api/v1/admin/scim-tokens', { body: { name } })),
    onSuccess: () => {
      setName('');
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) =>
      unwrap(client.DELETE('/api/v1/admin/scim-tokens/{id}', { params: { path: { id } } })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
  });
  const error = tokens.error ?? create.error ?? revoke.error;
  return (
    <section className="flex flex-col gap-3 border-t border-[var(--border)] pt-5">
      <h2 className="m-0 text-[15px] font-semibold">{t('directories.scim.title')}</h2>
      <p className="m-0 text-[13px] text-[var(--ink-muted)]">
        {t('directories.scim.intro', { url: `${window.location.origin}/scim/v2` })}
      </p>
      {error && <FormError message={error.message} />}
      {create.data && (
        <p role="status" className="m-0 flex flex-col gap-1 text-[13px]">
          <span>{t('directories.scim.once')}</span>
          <code className="break-all font-[family-name:var(--font-mono)]">
            {create.data.secret}
          </code>
        </p>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {tokens.data?.map((token) => (
          <li
            key={token.id}
            className="flex items-center gap-3 border-b border-[var(--border)] py-2 text-[13px]"
          >
            <span className="flex-1">
              {token.name} · <code>{token.prefix}…</code> ·{' '}
              {token.lastUsedAt
                ? t('directories.scim.used', { when: formatRelative(token.lastUsedAt) })
                : t('directories.scim.unused')}
            </span>
            <Button size="sm" variant="danger" onClick={() => revoke.mutate(token.id)}>
              {t('directories.scim.revoke')}
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <div className="min-w-[240px] flex-1">
          <TextField
            label={t('directories.scim.name')}
            value={name}
            placeholder="Entra ID"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={!name.trim() || create.isPending}>
          {t('directories.scim.create')}
        </Button>
      </form>
    </section>
  );
}
