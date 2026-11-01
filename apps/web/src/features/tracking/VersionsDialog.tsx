import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { Version } from '@toolvibes/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { versionsQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';

const control =
  'h-[var(--control-sm)] rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2';

/** Versions of a project with release, unrelease and archive (T-REL-01, -03; E-57). */
export function VersionsDialog({
  projectKey,
  open,
  onOpenChange,
}: {
  projectKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const versions = useQuery({ ...versionsQuery(projectKey), enabled: open });
  const [name, setName] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [releasing, setReleasing] = useState<Version | null>(null);
  const [moveTo, setMoveTo] = useState('');
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['project', projectKey, 'versions'] });
  const path = (id: string) => ({ params: { path: { key: projectKey, id } } });

  const create = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/projects/{key}/versions', {
          params: { path: { key: projectKey } },
          body: { name, releaseDate: releaseDate || null },
        }),
      ),
    onSuccess: async () => {
      setName('');
      setReleaseDate('');
      await refresh();
    },
  });
  const change = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { released?: false; archived?: boolean } }) =>
      unwrap(client.PATCH('/api/v1/projects/{key}/versions/{id}', { ...path(id), body })),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      unwrap(client.DELETE('/api/v1/projects/{key}/versions/{id}', path(id))),
    onSuccess: refresh,
  });
  const release = useMutation({
    mutationFn: (version: Version) =>
      unwrap(
        client.POST('/api/v1/projects/{key}/versions/{id}/release', {
          ...path(version.id),
          body: { moveOpenTo: moveTo || null },
        }),
      ),
    onSuccess: async () => {
      setReleasing(null);
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ['issue'] });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) create.mutate();
  }

  const error = create.error ?? change.error ?? remove.error ?? release.error;
  const others = (versions.data ?? []).filter(
    (version) => !version.released && !version.archived && version.id !== releasing?.id,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('versions.title')} width={680}>
      <div className="flex flex-col gap-4">
        {error && <FormError message={error.message} />}
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-48 flex-1 flex-col gap-1">
            <span className="tl-label text-[var(--ink-muted)]">{t('versions.name')}</span>
            <input
              value={name}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              className={control}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="tl-label text-[var(--ink-muted)]">{t('versions.releaseDate')}</span>
            <input
              type="date"
              value={releaseDate}
              onChange={(event) => setReleaseDate(event.target.value)}
              className={control}
            />
          </label>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!name.trim() || create.isPending}
          >
            {t('versions.create')}
          </Button>
        </form>

        {versions.data?.length === 0 && (
          <p className="m-0 text-[var(--ink-muted)]">{t('versions.none')}</p>
        )}
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {versions.data?.map((version) => (
            <li
              key={version.id}
              className={`flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 ${version.archived ? 'opacity-60' : ''}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/issues"
                  search={{
                    q: `project = ${projectKey} AND fixVersion = "${version.name}" ORDER BY rank`,
                  }}
                  className="font-semibold"
                >
                  {version.name}
                </Link>
                <span
                  className={`rounded-[var(--radius-sm)] px-1.5 text-xs font-semibold uppercase ${version.released ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-[var(--surface-2)] text-[var(--ink-muted)]'}`}
                >
                  {version.archived
                    ? t('versions.archived')
                    : version.released
                      ? t('versions.released')
                      : t('versions.unreleased')}
                </span>
                {version.releaseDate && (
                  <span className="text-xs text-[var(--ink-muted)]">
                    {formatDate(version.releaseDate)}
                  </span>
                )}
                <span className="text-xs text-[var(--ink-muted)]">
                  {t('versions.counts', { total: version.issueCount, open: version.openCount })}
                </span>
                <span className="ml-auto flex flex-wrap gap-1">
                  {!version.released && !version.archived && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setMoveTo('');
                        setReleasing(version);
                      }}
                    >
                      {t('versions.release')}
                    </Button>
                  )}
                  {version.released && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => change.mutate({ id: version.id, body: { released: false } })}
                    >
                      {t('versions.unrelease')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      change.mutate({ id: version.id, body: { archived: !version.archived } })
                    }
                  >
                    {version.archived ? t('versions.unarchive') : t('versions.archive')}
                  </Button>
                  {version.issueCount === 0 && (
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(version.id)}>
                      {t('versions.delete')}
                    </Button>
                  )}
                </span>
              </div>
              {releasing?.id === version.id && (
                <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] bg-[var(--surface-2)] px-3 py-2">
                  {version.openCount > 0 ? (
                    <label className="flex flex-wrap items-center gap-2">
                      {t('versions.openIssues', { count: version.openCount })}
                      <select
                        value={moveTo}
                        onChange={(event) => setMoveTo(event.target.value)}
                        className={control}
                      >
                        <option value="">{t('versions.keepOpen')}</option>
                        {others.map((other) => (
                          <option key={other.id} value={other.id}>
                            {t('versions.moveTo', { name: other.name })}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <span>{t('versions.allDone')}</span>
                  )}
                  <span className="ml-auto flex gap-1">
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={release.isPending}
                      onClick={() => release.mutate(version)}
                    >
                      {t('versions.release')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setReleasing(null)}>
                      {t('common.cancel')}
                    </Button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
