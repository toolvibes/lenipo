import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ImportJob } from '@tasklore/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';

function JobReport({ job }: { job: ImportJob }) {
  const { t } = useTranslation();
  return (
    <details className="text-[13px]" open={job.state !== 'done' || job.dryRun}>
      <summary className="cursor-pointer text-[var(--ink-muted)]">{t('imports.details')}</summary>
      {job.report && (
        <div className="mt-2 flex flex-col gap-2">
          <table className="border-collapse">
            <tbody>
              {Object.entries(job.report.counts).map(([what, count]) => (
                <tr key={what}>
                  <td className="py-0.5 pr-4">{what}</td>
                  <td className="py-0.5 text-right font-semibold tabular-nums">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {job.report.mappings.length > 0 && (
            <div>
              <h4 className="tl-label m-0 text-[var(--ink-muted)]">{t('imports.mappings')}</h4>
              <ul className="m-0 pl-5">
                {job.report.mappings.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
          {job.report.skipped.length > 0 && (
            <div>
              <h4 className="tl-label m-0 text-[var(--ink-muted)]">{t('imports.skipped')}</h4>
              <ul className="m-0 pl-5">
                {job.report.skipped.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {job.log.length > 0 && (
        <pre className="mt-2 max-h-48 overflow-auto rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2 text-xs whitespace-pre-wrap">
          {job.log.join('\n')}
        </pre>
      )}
    </details>
  );
}

/** Upload of a Confluence space export; a dry run first (P-ADM-11). */
function ConfluenceForm() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [spaceKey, setSpaceKey] = useState('');
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) return;
      const form = new FormData();
      form.append('file', file);
      const query = new URLSearchParams({ dryRun: 'true' });
      if (spaceKey.trim()) query.set('spaceKey', spaceKey.trim().toUpperCase());
      const response = await fetch(`/api/v1/admin/imports/confluence?${query}`, {
        method: 'POST',
        body: form,
      });
      if (!response.ok) {
        const problem = (await response.json().catch(() => ({}))) as { detail?: string };
        throw new Error(problem.detail ?? response.statusText);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'imports'] }),
  });
  return (
    <form
      className="flex flex-col gap-3 border-t border-[var(--border)] pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        upload.mutate();
      }}
    >
      <h2 className="m-0 text-base font-semibold">{t('imports.confluenceTitle')}</h2>
      <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('imports.confluenceIntro')}</p>
      <input
        type="file"
        accept=".zip,application/zip"
        aria-label={t('imports.confluenceFile')}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      <TextField
        label={t('imports.spaceKey')}
        help={t('imports.spaceKeyHelp')}
        value={spaceKey}
        maxLength={10}
        onChange={(event) => setSpaceKey(event.target.value)}
      />
      {upload.error && <FormError message={upload.error.message} />}
      <div>
        <Button type="submit" variant="primary" disabled={!file || upload.isPending}>
          {t('imports.dryRun')}
        </Button>
      </div>
    </form>
  );
}

/** Imports from Jira and Confluence Server/DC (TL-35, E-118). */
export function ImportPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const jobs = useQuery({
    queryKey: ['admin', 'imports'],
    queryFn: () => unwrap(client.GET('/api/v1/admin/imports')),
    // Running jobs report progress; look again every two seconds while one runs.
    refetchInterval: (query) =>
      query.state.data?.some((job) => job.state === 'pending' || job.state === 'running')
        ? 2000
        : false,
  });
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [keys, setKeys] = useState('');
  const start = useMutation({
    mutationFn: (dryRun: boolean) =>
      unwrap(
        client.POST('/api/v1/admin/imports/jira', {
          body: {
            url: url.trim(),
            token: token.trim(),
            projectKeys: keys
              .split(/[\s,]+/)
              .map((key) => key.trim().toUpperCase())
              .filter(Boolean),
            dryRun,
          },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'imports'] }),
  });

  const runFor = useMutation({
    mutationFn: (id: string) =>
      unwrap(client.POST('/api/v1/admin/imports/{id}/run', { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'imports'] }),
  });

  function submit(event: FormEvent, dryRun: boolean) {
    event.preventDefault();
    start.mutate(dryRun);
  }

  return (
    <div className="flex max-w-[760px] flex-col gap-5">
      <h1 className="m-0 text-xl font-semibold">{t('imports.title')}</h1>
      <p className="m-0 text-[var(--ink-muted)]">{t('imports.intro')}</p>
      <form onSubmit={(event) => submit(event, true)} className="flex flex-col gap-3">
        <TextField
          label={t('imports.url')}
          type="url"
          required
          placeholder="https://jira.example.org"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <TextField
          label={t('imports.token')}
          help={t('imports.tokenHelp')}
          type="password"
          required
          autoComplete="off"
          value={token}
          onChange={(event) => setToken(event.target.value)}
        />
        <TextField
          label={t('imports.projects')}
          help={t('imports.projectsHelp')}
          required
          placeholder="WEB, API"
          value={keys}
          onChange={(event) => setKeys(event.target.value)}
        />
        {start.error && <FormError message={start.error.message} />}
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={start.isPending}>
            {t('imports.dryRun')}
          </Button>
          <Button
            type="button"
            disabled={start.isPending || !url || !token || !keys}
            onClick={(event) => submit(event, false)}
          >
            {t('imports.run')}
          </Button>
        </div>
      </form>
      <ConfluenceForm />
      <section className="flex flex-col gap-2">
        <h2 className="m-0 text-base font-semibold">{t('imports.jobs')}</h2>
        {jobs.data?.length === 0 && (
          <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('imports.none')}</p>
        )}
        {(jobs.data ?? []).map((job) => (
          <article
            key={job.id}
            className="flex flex-col gap-1 border-b border-[var(--border)] py-2.5"
          >
            <span className="flex flex-wrap items-center gap-2 text-[13px]">
              <strong>{job.label}</strong>
              <span
                className={`rounded-[var(--radius-sm)] px-1.5 text-xs font-semibold ${
                  job.state === 'failed'
                    ? 'bg-[var(--danger-soft)] text-[var(--danger)]'
                    : job.state === 'done'
                      ? 'bg-[var(--success-soft)]'
                      : 'bg-[var(--surface-2)]'
                }`}
              >
                {t(`imports.states.${job.state}`)}
                {job.dryRun ? ` · ${t('imports.dryRunShort')}` : ''}
              </span>
              <span className="text-xs text-[var(--ink-muted)]">
                {job.progress || formatRelative(job.createdAt)}
              </span>
            </span>
            <JobReport job={job} />
            {job.source === 'confluence' && job.dryRun && job.state === 'done' && (
              <div>
                <Button size="sm" onClick={() => runFor.mutate(job.id)} disabled={runFor.isPending}>
                  {t('imports.runChecked')}
                </Button>
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
