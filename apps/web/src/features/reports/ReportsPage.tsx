import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { SprintReport, SprintReportEntry } from '@tasklore/shared';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { BoardTabs } from '../boards/BoardTabs';
import { IssueTypeIcon, StatusLozenge } from '../tracking/icons';
import { BurndownChart, Legend, useValueFormat, VelocityChart } from './charts';

export type ReportKind = 'burndown' | 'velocity' | 'sprint';

function Entries({
  title,
  entries,
  format,
}: {
  title: string;
  entries: SprintReportEntry[];
  format: (value: number) => string;
}) {
  const { t } = useTranslation();
  const total = entries.reduce((sum, entry) => sum + (entry.estimate ?? 0), 0);
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h3 className="tl-heading-md m-0">
        {title} · {entries.length} · {format(total)}
      </h3>
      {entries.length === 0 ? (
        <p className="m-0 text-[var(--ink-muted)]">{t('reports.none')}</p>
      ) : (
        <ul className="m-0 list-none overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] p-0">
          {entries.map((entry) => (
            <li
              key={entry.issue.id}
              className="flex min-h-9 items-center gap-2 border-b border-[var(--border)] px-3 last:border-b-0"
            >
              <IssueTypeIcon type={entry.issue.issueType} size={14} />
              <Link
                to="/issues/$key"
                params={{ key: entry.issue.key }}
                className="tl-key shrink-0 no-underline hover:underline"
              >
                {entry.issue.key}
              </Link>
              <span className="min-w-0 flex-1 truncate">{entry.issue.summary}</span>
              {entry.addedAfterStart && (
                <span className="rounded-[var(--radius-sm)] bg-[var(--warning-soft)] px-1.5 text-xs font-semibold">
                  {t('reports.addedLater')}
                </span>
              )}
              <StatusLozenge status={entry.issue.status} />
              <span className="w-12 text-right text-xs font-semibold tabular-nums">
                {entry.estimate === null ? '–' : format(entry.estimate)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SprintReportView({ report }: { report: SprintReport }) {
  const { t } = useTranslation();
  const format = useValueFormat(report.estimation);
  return (
    <div className="flex flex-col gap-5">
      <Entries title={t('reports.completedIssues')} entries={report.completed} format={format} />
      <Entries
        title={t('reports.notCompletedIssues')}
        entries={report.notCompleted}
        format={format}
      />
      <Entries title={t('reports.removedIssues')} entries={report.removed} format={format} />
    </div>
  );
}

/** Burndown, velocity and sprint report of a Scrum board (T-RPT-01 to -03, E-56). */
export function ReportsPage({
  id,
  report,
  sprintId,
}: {
  id: string;
  report: ReportKind;
  sprintId?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sprints = useQuery({
    queryKey: ['board', id, 'sprints', 'all'],
    queryFn: () =>
      unwrap(client.GET('/api/v1/boards/{id}/sprints', { params: { path: { id }, query: {} } })),
  });
  const started = (sprints.data ?? [])
    .filter((sprint) => sprint.startedAt)
    .sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));
  const chosen = sprintId ?? started[0]?.id;
  const burndown = useQuery({
    queryKey: ['report', 'burndown', chosen],
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/sprints/{id}/burndown', { params: { path: { id: chosen ?? '' } } }),
      ),
    enabled: report === 'burndown' && !!chosen,
  });
  const sprintReport = useQuery({
    queryKey: ['report', 'sprint', chosen],
    queryFn: () =>
      unwrap(client.GET('/api/v1/sprints/{id}/report', { params: { path: { id: chosen ?? '' } } })),
    enabled: report === 'sprint' && !!chosen,
  });
  const velocity = useQuery({
    queryKey: ['report', 'velocity', id],
    queryFn: () => unwrap(client.GET('/api/v1/boards/{id}/velocity', { params: { path: { id } } })),
    enabled: report === 'velocity',
  });
  const board = useQuery({
    queryKey: ['board', id, 'config'],
    queryFn: () => unwrap(client.GET('/api/v1/boards/{id}', { params: { path: { id } } })),
  });

  const go = (next: { report?: ReportKind; sprint?: string }) =>
    void navigate({
      to: '/boards/$id/reports',
      params: { id },
      search: { report: next.report ?? report, sprint: next.sprint ?? sprintId },
      replace: true,
    });
  const error = burndown.error ?? sprintReport.error ?? velocity.error;

  return (
    <main className="flex flex-col gap-4 px-6 py-5">
      <header className="flex flex-col gap-1">
        <span className="text-xs text-[var(--ink-muted)]">{board.data?.project.name}</span>
        <h1 className="tl-heading-xl">{board.data?.name ?? t('reports.title')}</h1>
      </header>
      {board.data && <BoardTabs id={id} type={board.data.type} current="reports" />}
      <div className="flex flex-wrap items-center gap-2">
        <div role="toolbar" aria-label={t('reports.kind')} className="flex gap-1">
          {(['burndown', 'velocity', 'sprint'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={report === kind}
              onClick={() => go({ report: kind })}
              className="h-8 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 aria-pressed:border-[var(--accent)] aria-pressed:bg-[var(--accent-soft)] aria-pressed:font-semibold aria-pressed:text-[var(--accent)]"
            >
              {t(`reports.kinds.${kind}`)}
            </button>
          ))}
        </div>
        {report !== 'velocity' && started.length > 0 && (
          <label className="ml-auto flex items-center gap-2">
            <span className="text-xs text-[var(--ink-muted)]">{t('reports.sprint')}</span>
            <select
              value={chosen}
              onChange={(event) => go({ sprint: event.target.value })}
              className="h-8 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2"
            >
              {started.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name}
                  {sprint.state === 'active' ? ` (${t('sprints.active')})` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && <p className="m-0 text-[var(--danger)]">{error.message}</p>}
      {report !== 'velocity' && sprints.data && started.length === 0 && (
        <p className="m-0 text-[var(--ink-muted)]">{t('reports.noStartedSprint')}</p>
      )}
      {report === 'burndown' && burndown.data && (
        <>
          <BurndownChart data={burndown.data} />
          <Legend
            items={[
              { color: 'var(--accent)', label: t('reports.remaining') },
              { color: 'var(--ink-muted)', label: t('reports.guideline'), dashed: true },
            ]}
          />
        </>
      )}
      {report === 'velocity' && velocity.data && (
        <>
          <VelocityChart data={velocity.data} />
          <Legend
            items={[
              { color: 'var(--border-strong)', label: t('reports.committed') },
              { color: 'var(--accent)', label: t('reports.completed') },
            ]}
          />
        </>
      )}
      {report === 'sprint' && sprintReport.data && <SprintReportView report={sprintReport.data} />}
    </main>
  );
}
