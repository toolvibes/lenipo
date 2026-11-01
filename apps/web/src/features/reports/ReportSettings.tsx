import { useQuery } from '@tanstack/react-query';
import {
  REPORT_KINDS,
  type ReportConfig,
  type ReportKind,
  SERIES_FIELDS,
  type SeriesField,
  STATISTIC_FIELDS,
  type StatisticField,
  TIME_GROUPS,
  TIME_PERIODS,
} from '@toolvibes/shared';
import { useTranslation } from 'react-i18next';
import { boardsQuery } from '../../lib/boards';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';

/** A report of a kind with sensible settings, keeping the query and board already chosen. */
export function reportOf(
  kind: ReportKind,
  previous: { query?: string; boardId?: string; days?: number } = {},
): ReportConfig {
  const query = previous.query ?? '';
  const days = previous.days ?? 30;
  const boardId = previous.boardId ?? '';
  switch (kind) {
    case 'cfd':
    case 'control-chart':
    case 'average-age':
    case 'created-vs-resolved':
      return { kind, query, days };
    case 'time-tracking':
      return { kind, query, days, groupBy: 'issue', period: 'none' };
    case 'field-series':
      return { kind, query, field: 'assignee', days };
    case 'pie':
      return { kind, query, field: 'status' };
    case 'scope-progress':
      return { kind, query, boardId };
    case 'burnup':
    case 'burndown':
    case 'velocity':
    case 'sprint-report':
      return { kind, boardId };
  }
}

/** Whether a report has everything it needs to run. */
export function reportReady(config: ReportConfig): boolean {
  return 'boardId' in config ? config.boardId !== '' : true;
}

const PERIODS = [7, 14, 30, 90, 180, 365];

/** Kind and settings of a report; boards are those of a project when one is given. */
export function ReportSettings({
  config,
  onChange,
  projectKey,
  fixedKind = false,
}: {
  config: ReportConfig;
  onChange: (config: ReportConfig) => void;
  projectKey?: string;
  fixedKind?: boolean;
}) {
  const { t } = useTranslation();
  const needsBoard = 'boardId' in config;
  const boards = useQuery({ ...boardsQuery(projectKey), enabled: needsBoard });
  const keep = {
    query: 'query' in config ? config.query : undefined,
    boardId: 'boardId' in config ? config.boardId : undefined,
    days: 'days' in config ? config.days : undefined,
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {!fixedKind && (
        <Select
          label={t('analysis.kind')}
          value={config.kind}
          options={REPORT_KINDS.map((kind) => ({
            value: kind,
            label: t(`analysis.kinds.${kind}`),
          }))}
          onChange={(event) => onChange(reportOf(event.target.value as ReportKind, keep))}
        />
      )}
      {'days' in config && (
        <Select
          label={t('dashboards.config.days')}
          value={String(config.days)}
          options={PERIODS.map((days) => ({
            value: String(days),
            label: t('dashboards.config.lastDays', { count: days }),
          }))}
          onChange={(event) =>
            onChange({ ...config, days: Number(event.target.value) } as ReportConfig)
          }
        />
      )}
      {config.kind === 'field-series' && (
        <Select
          label={t('dashboards.config.field')}
          value={config.field}
          options={SERIES_FIELDS.map((field) => ({
            value: field,
            label: t(`dashboards.fields.${field}`),
          }))}
          onChange={(event) => onChange({ ...config, field: event.target.value as SeriesField })}
        />
      )}
      {config.kind === 'pie' && (
        <Select
          label={t('dashboards.config.field')}
          value={config.field}
          options={STATISTIC_FIELDS.map((field) => ({
            value: field,
            label: t(`dashboards.fields.${field}`),
          }))}
          onChange={(event) => onChange({ ...config, field: event.target.value as StatisticField })}
        />
      )}
      {config.kind === 'time-tracking' && (
        <>
          <Select
            label={t('timesheet.groupBy')}
            value={config.groupBy}
            options={TIME_GROUPS.map((value) => ({
              value,
              label: t(`timesheet.groups.${value}`),
            }))}
            onChange={(event) =>
              onChange({ ...config, groupBy: event.target.value as typeof config.groupBy })
            }
          />
          <Select
            label={t('timesheet.period')}
            value={config.period}
            options={TIME_PERIODS.map((value) => ({
              value,
              label: t(`timesheet.periods.${value}`),
            }))}
            onChange={(event) =>
              onChange({ ...config, period: event.target.value as typeof config.period })
            }
          />
        </>
      )}
      {needsBoard && (
        <Select
          label={t('dashboards.config.board')}
          value={config.boardId}
          options={[
            { value: '', label: t('dashboards.config.chooseBoard') },
            ...(boards.data ?? [])
              .filter((board) => board.type === 'scrum')
              .map((board) => ({ value: board.id, label: `${board.name} (${board.project.key})` })),
          ]}
          onChange={(event) => onChange({ ...config, boardId: event.target.value } as ReportConfig)}
        />
      )}
      {'query' in config && (
        <div className="sm:col-span-2">
          <TextField
            label={t('dashboards.config.query')}
            help={
              config.kind === 'scope-progress'
                ? t('analysis.scopeQueryHelp')
                : t('dashboards.config.queryHelp')
            }
            value={config.query}
            className="font-[family-name:var(--font-mono)]"
            onChange={(event) => onChange({ ...config, query: event.target.value } as ReportConfig)}
          />
        </div>
      )}
      <p className="m-0 text-xs text-[var(--ink-muted)] sm:col-span-2">
        {t(`analysis.help.${config.kind}`)}
      </p>
    </div>
  );
}
