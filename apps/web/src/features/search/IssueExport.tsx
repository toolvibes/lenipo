import { Export, Printer } from '@phosphor-icons/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  ISSUE_EXPORT_LIMIT,
  type IssueExportFormat,
  type IssueSummary,
  type ListColumn,
} from '@toolvibes/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';
import { useListColumns } from '../../lib/personal';
import { trackingMetaQuery } from '../../lib/tracking';
import { Button, buttonClass } from '../../ui/Button';

const menuItem =
  'flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-[var(--ink)] no-underline outline-none data-[highlighted]:bg-[var(--surface-2)]';

function useColumnLabel() {
  const { t } = useTranslation();
  const fields = useQuery(trackingMetaQuery).data?.customFields ?? [];
  return (column: ListColumn) =>
    column.startsWith('cf[')
      ? (fields.find((field) => `cf[${field.number}]` === column)?.name ?? column)
      : t(`issues.columns.${column as Exclude<ListColumn, `cf[${number}]`>}`);
}

async function exportIssues(body: {
  query: string;
  format: IssueExportFormat;
  columns: ListColumn[];
  headings: string[];
}): Promise<Blob> {
  const { data, response } = await client.POST('/api/v1/search/export', {
    body,
    parseAs: 'blob',
  });
  if (!response.ok || !data) throw new Error(response.statusText);
  return data as Blob;
}

/** CSV, Excel, JSON and a print view of all results of a query (T-QRY-09, E-111). */
export function IssueExportMenu({ query, total }: { query: string; total: number | undefined }) {
  const { t } = useTranslation();
  const columns = useListColumns();
  const label = useColumnLabel();
  const [failed, setFailed] = useState(false);

  async function download(format: IssueExportFormat) {
    setFailed(false);
    try {
      const blob = await exportIssues({
        query,
        format,
        columns,
        headings: [t('issues.columns.key'), t('issues.columns.summary'), ...columns.map(label)],
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vorgaenge-${new Date().toISOString().slice(0, 10)}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setFailed(true);
    }
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={`${buttonClass('ghost', 'sm')} ${failed ? 'text-[var(--danger)]' : ''}`}
        title={failed ? t('exports.failed') : undefined}
      >
        <Export size={16} aria-hidden />
        {t('exports.action')}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-48 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-1 text-sm shadow-[var(--shadow-float)]"
        >
          {(['csv', 'xlsx', 'json'] as const).map((format) => (
            <DropdownMenu.Item
              key={format}
              className={menuItem}
              onSelect={() => void download(format)}
            >
              {t(`exports.${format}`)}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Item asChild className={menuItem}>
            <Link to="/issues/print" search={{ q: query, auto: true }} target="_blank">
              {t('exports.print')}
            </Link>
          </DropdownMenu.Item>
          {total !== undefined && total > ISSUE_EXPORT_LIMIT && (
            <p className="m-0 px-2 py-1 text-xs text-[var(--ink-muted)]">
              {t('exports.limit', { count: ISSUE_EXPORT_LIMIT })}
            </p>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const hours = (seconds: number | null) =>
  seconds === null ? '' : `${Math.round((seconds / 3600) * 100) / 100} h`;

/** The text of a cell on paper. */
function cellText(
  issue: IssueSummary,
  column: ListColumn,
  fields: Array<{ id: string; number: number }>,
) {
  switch (column) {
    case 'issuetype':
      return issue.issueType.name;
    case 'status':
      return issue.status.name;
    case 'priority':
      return issue.priority.name;
    case 'assignee':
      return issue.assignee?.displayName ?? '';
    case 'reporter':
      return issue.reporter?.displayName ?? '';
    case 'created':
      return formatDateTime(issue.createdAt);
    case 'updated':
      return formatDateTime(issue.updatedAt);
    case 'due':
      return issue.dueDate ? formatDate(issue.dueDate) : '';
    case 'resolution':
      return issue.resolution?.name ?? '';
    case 'labels':
      return issue.labels.join(', ');
    case 'component':
      return issue.components.map((component) => component.name).join(', ');
    case 'fixVersion':
      return issue.fixVersions.map((version) => version.name).join(', ');
    case 'storyPoints':
      return issue.storyPoints?.toLocaleString() ?? '';
    case 'originalEstimate':
      return hours(issue.timeTracking.originalEstimateSeconds);
    case 'remainingEstimate':
      return hours(issue.timeTracking.remainingEstimateSeconds);
    case 'timeSpent':
      return issue.timeTracking.timeSpentSeconds ? hours(issue.timeTracking.timeSpentSeconds) : '';
    default: {
      const field = fields.find((entry) => `cf[${entry.number}]` === column);
      const value = field ? issue.customFields[field.id] : undefined;
      if (value === undefined || value === null) return '';
      const text = (entry: unknown): string =>
        typeof entry === 'object' && entry !== null
          ? ((entry as { value?: string; displayName?: string }).value ??
            (entry as { displayName?: string }).displayName ??
            '')
          : entry === true
            ? '✓'
            : String(entry);
      return Array.isArray(value) ? value.map(text).join(', ') : text(value);
    }
  }
}

/** Search results laid out for paper, with the caller's columns. */
export function IssuePrintPage({ query, auto }: { query: string; auto: boolean }) {
  const { t } = useTranslation();
  const columns = useListColumns();
  const label = useColumnLabel();
  const fields = useQuery(trackingMetaQuery).data?.customFields;
  const result = useQuery({
    queryKey: ['issue-print', query],
    queryFn: async () =>
      JSON.parse(
        await (await exportIssues({ query, format: 'json', columns: [], headings: [] })).text(),
      ) as { issues: IssueSummary[]; exportedAt: string },
  });
  useEffect(() => {
    document.title = t('exports.printTitle');
  }, [t]);
  useEffect(() => {
    if (!auto || !result.data || !fields) return;
    const timer = setTimeout(() => window.print(), 300);
    return () => clearTimeout(timer);
  }, [auto, result.data, fields]);

  return (
    <>
      <div className="tl-print-toolbar flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-6 py-2.5 text-[13px]">
        <Link
          to="/issues"
          search={{ q: query }}
          className="text-[var(--ink-muted)] no-underline hover:underline"
        >
          ← {t('exports.back')}
        </Link>
        <span className="flex-1" />
        <span className="text-xs text-[var(--ink-muted)]">{t('print.pdfHint')}</span>
        <Button size="sm" variant="primary" disabled={!result.data} onClick={() => window.print()}>
          <Printer size={16} aria-hidden />
          {t('print.print')}
        </Button>
      </div>
      <main className="tl-print mx-auto flex max-w-[1100px] flex-col gap-3 px-8 py-8">
        <header className="flex flex-col gap-1">
          <h1 className="m-0 text-2xl font-semibold">{t('exports.printTitle')}</h1>
          {query && (
            <code className="text-xs text-[var(--ink-muted)]">
              {t('exports.printQuery', { query })}
            </code>
          )}
          {result.data && (
            <span className="text-xs text-[var(--ink-muted)]">
              {t('exports.printCount', {
                count: result.data.issues.length,
                date: formatDateTime(result.data.exportedAt),
              })}
            </span>
          )}
        </header>
        {result.error && <p className="m-0 text-[var(--danger)]">{t('exports.failed')}</p>}
        {result.data && (
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                {[t('issues.columns.key'), t('issues.columns.summary'), ...columns.map(label)].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="border-b-2 border-[var(--border-strong)] px-1.5 py-1 text-left font-semibold"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {result.data.issues.map((issue) => (
                <tr key={issue.id} className="break-inside-avoid">
                  <td className="border-b border-[var(--border)] px-1.5 py-1 font-mono whitespace-nowrap">
                    {issue.key}
                  </td>
                  <td className="border-b border-[var(--border)] px-1.5 py-1">{issue.summary}</td>
                  {columns.map((column) => (
                    <td key={column} className="border-b border-[var(--border)] px-1.5 py-1">
                      {cellText(issue, column, fields ?? [])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}
