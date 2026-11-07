import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppManifest, InstalledApp } from '@toolvibes/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';

const installedQuery = {
  queryKey: ['admin', 'apps'],
  queryFn: () => unwrap(client.GET('/api/v1/admin/apps')),
};

function Modules({ modules }: { modules: InstalledApp['modules'] | AppManifest['modules'] }) {
  const { t } = useTranslation();
  const parts = (['issuePanels', 'macros', 'gadgets'] as const).flatMap((kind) =>
    (modules[kind] ?? []).map((module) => `${t(`apps.kinds.${kind}`)}: ${module.title}`),
  );
  return <span>{parts.join(' · ') || t('apps.noModules')}</span>;
}

/** Installing apps from their manifest and managing them (TL-50, E-140). */
export function AppsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const installed = useQuery(installedQuery);
  const [manifestUrl, setManifestUrl] = useState('');
  const [approved, setApproved] = useState(false);
  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: installedQuery.queryKey });
    void queryClient.invalidateQueries({ queryKey: ['apps'] });
  };
  const preview = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/admin/apps/preview', { body: { manifestUrl: manifestUrl.trim() } }),
      ),
    onSuccess: () => setApproved(false),
  });
  const install = useMutation({
    mutationFn: (manifest: AppManifest) =>
      unwrap(
        client.POST('/api/v1/admin/apps', {
          body: { manifestUrl: manifestUrl.trim(), approvedScopes: manifest.scopes },
        }),
      ),
    onSuccess: () => {
      preview.reset();
      setManifestUrl('');
      refreshAll();
    },
  });
  const change = useMutation({
    mutationFn: async ({
      app,
      action,
    }: {
      app: InstalledApp;
      action: 'toggle' | 'refresh' | 'remove';
    }) => {
      const path = { params: { path: { id: app.id } } };
      if (action === 'toggle') {
        await unwrap(
          client.PATCH('/api/v1/admin/apps/{id}', { ...path, body: { enabled: !app.enabled } }),
        );
      } else if (action === 'refresh') {
        await unwrap(client.POST('/api/v1/admin/apps/{id}/refresh', { ...path, body: {} }));
      } else {
        await unwrap(client.DELETE('/api/v1/admin/apps/{id}', path));
      }
    },
    onSuccess: refreshAll,
  });
  const manifest = preview.data;
  const error = installed.error ?? preview.error ?? install.error ?? change.error;

  return (
    <main className="flex max-w-[820px] flex-col gap-4">
      <h1 className="m-0 text-[24px] leading-[30px] font-extrabold tracking-[-0.025em]">
        {t('apps.title')}
      </h1>
      <p className="m-0 text-[var(--ink-muted)]">{t('apps.intro')}</p>
      {error && <FormError message={error.message} />}

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          preview.mutate();
        }}
      >
        <div className="min-w-[280px] flex-1">
          <TextField
            label={t('apps.manifestUrl')}
            help={t('apps.manifestHelp')}
            type="url"
            value={manifestUrl}
            placeholder="https://app.example.org/lenipo-app.json"
            onChange={(event) => {
              setManifestUrl(event.target.value);
              preview.reset();
            }}
          />
        </div>
        <Button type="submit" disabled={!manifestUrl.trim() || preview.isPending}>
          {t('apps.check')}
        </Button>
      </form>

      {manifest && (
        <section className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] p-4">
          <h2 className="m-0 text-[15px] font-semibold">
            {manifest.name}
            {manifest.vendor && (
              <span className="font-normal text-[var(--ink-muted)]"> · {manifest.vendor}</span>
            )}
          </h2>
          {manifest.description && <p className="m-0">{manifest.description}</p>}
          <p className="m-0 text-[13px] text-[var(--ink-muted)]">
            {new URL(manifest.baseUrl).origin} · <Modules modules={manifest.modules} />
          </p>
          <p className="m-0 text-[13px]">
            {manifest.scopes.length > 0
              ? t('apps.scopes', { scopes: manifest.scopes.join(', ') })
              : t('apps.noScopes')}
          </p>
          {manifest.scopes.length > 0 && (
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={approved}
                onChange={(event) => setApproved(event.target.checked)}
              />
              {t('apps.approve')}
            </label>
          )}
          <div>
            <Button
              variant="primary"
              disabled={install.isPending || (manifest.scopes.length > 0 && !approved)}
              onClick={() => install.mutate(manifest)}
            >
              {t('apps.install')}
            </Button>
          </div>
        </section>
      )}

      {installed.data?.length === 0 && (
        <p className="m-0 text-[var(--ink-muted)]">{t('apps.none')}</p>
      )}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {installed.data?.map((app) => (
          <li
            key={app.id}
            className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-3"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-semibold">
                {app.name}
                {!app.enabled && (
                  <span className="font-normal text-[var(--ink-muted)]"> · {t('apps.off')}</span>
                )}
              </span>
              <span className="text-[13px] text-[var(--ink-muted)]">
                {app.origin} · <Modules modules={app.modules} />
                {app.scopes.length > 0 && ` · ${app.scopes.join(', ')}`}
              </span>
            </div>
            <Button size="sm" onClick={() => change.mutate({ app, action: 'refresh' })}>
              {t('apps.refresh')}
            </Button>
            <Button size="sm" onClick={() => change.mutate({ app, action: 'toggle' })}>
              {app.enabled ? t('apps.disable') : t('apps.enable')}
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                if (window.confirm(t('apps.removeConfirm', { name: app.name }))) {
                  change.mutate({ app, action: 'remove' });
                }
              }}
            >
              {t('apps.remove')}
            </Button>
          </li>
        ))}
      </ul>
    </main>
  );
}
