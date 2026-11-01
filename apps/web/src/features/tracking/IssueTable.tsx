import { ArrowDown, ArrowUp } from '@phosphor-icons/react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  type CustomField,
  type CustomFieldValue,
  DEFAULT_ISSUE_COLUMNS,
  type IssueColumn,
  type IssueSummary,
  type ListColumn,
  type UpdateIssueRequest,
  type UserRef,
} from '@toolvibes/shared';
import type { SortKey } from '@toolvibes/tql';
import { type KeyboardEvent, type MouseEvent, type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatDate, formatDateTime, formatRelative } from '../../lib/format';
import { meQuery } from '../../lib/queries';
import { projectQuery, trackingMetaQuery, useFieldCatalogue } from '../../lib/tracking';
import { FormError } from '../../ui/FormError';
import { ComponentsField } from './ComponentsField';
import { FieldEditor } from './CustomFields';
import { InlineInput, inputClass, StatusMenu } from './fields';
import { IssueTypeIcon, PriorityIcon, useMetaName } from './icons';
import { useDuration } from './TimeTracking';
import { type TransitionExtras, useTransitionScreen } from './TransitionDialog';
import { Avatar, UserPicker } from './UserPicker';

type Column = 'key' | 'summary' | ListColumn;

const isCustom = (column: Column): column is `cf[${number}]` => column.startsWith('cf[');

const WIDTH: Partial<Record<Column, string>> = {
  key: 'w-28',
  issuetype: 'w-32',
  status: 'w-36',
  priority: 'w-28',
  assignee: 'w-44',
  reporter: 'w-44',
  created: 'w-32',
  updated: 'w-32',
  due: 'w-28',
  resolution: 'w-32',
  labels: 'w-40',
  component: 'w-40',
  fixVersion: 'w-36',
  storyPoints: 'w-24',
  originalEstimate: 'w-28',
  remainingEstimate: 'w-28',
  timeSpent: 'w-28',
};

const NUMERIC = new Set<Column>([
  'storyPoints',
  'originalEstimate',
  'remainingEstimate',
  'timeSpent',
]);

function Person({ user, none }: { user: IssueSummary['assignee']; none: string }) {
  if (!user) return <span className="text-[var(--ink-muted)]">{none}</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar user={user} size={20} />
      <span className="truncate">{user.displayName}</span>
    </span>
  );
}

function Chips({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="text-[var(--ink-muted)]">–</span>;
  return (
    <span className="flex min-w-0 gap-1 overflow-hidden" title={names.join(', ')}>
      {names.map((name) => (
        <span
          key={name}
          className="shrink-0 rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-1.5 text-xs font-semibold"
        >
          {name}
        </span>
      ))}
    </span>
  );
}

/** Changes from list cells; every list showing the issue reloads afterwards (E-49). */
function useListEdit() {
  const queryClient = useQueryClient();
  const refresh = async (key: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['search'] }),
      queryClient.invalidateQueries({ queryKey: ['project-issues'] }),
      queryClient.invalidateQueries({ queryKey: ['issue', key] }),
    ]);
  };
  const update = useMutation({
    mutationFn: ({ key, body }: { key: string; body: UpdateIssueRequest }) =>
      unwrap(client.PATCH('/api/v1/issues/{key}', { params: { path: { key } }, body })),
    onSuccess: (issue) => refresh(issue.key),
  });
  const transition = useMutation({
    mutationFn: ({
      key,
      transitionId,
      extras,
    }: {
      key: string;
      transitionId: string;
      extras?: TransitionExtras;
    }) =>
      unwrap(
        client.POST('/api/v1/issues/{key}/transitions', {
          params: { path: { key } },
          body: { transitionId, ...extras },
        }),
      ),
    onSuccess: (issue) => refresh(issue.key),
  });
  const screen = useTransitionScreen((issue, transitionId, extras) =>
    transition.mutateAsync({ key: issue.key, transitionId, extras }),
  );
  const move = async (issue: IssueSummary, transitionId: string) => {
    if (await screen.ask(issue, (offered) => offered.find((entry) => entry.id === transitionId))) {
      return;
    }
    transition.mutate({ key: issue.key, transitionId });
  };
  return {
    update,
    move,
    screen: screen.dialog,
    error: update.error ?? (screen.dialog ? null : transition.error),
  };
}

/** A plain left click; anything else (new tab, copy link) is left to the browser. */
function plainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** A custom field's value, read-only (E-50), where the caller may not change it. */
function CustomValue({
  field,
  value,
}: {
  field: CustomField;
  value: CustomFieldValue | undefined;
}) {
  const { t } = useTranslation();
  if (value === undefined) return null;
  switch (field.type) {
    case 'select':
    case 'cascade':
      return (value as { value: string }).value;
    case 'multiselect':
      return <Chips names={(value as Array<{ value: string }>).map((option) => option.value)} />;
    case 'user':
      return <Person user={value as UserRef} none="" />;
    case 'users':
      return <Chips names={(value as UserRef[]).map((person) => person.displayName)} />;
    case 'group':
      return (value as UserRef).displayName;
    case 'version':
      return (value as { value: string }).value;
    case 'labels':
      return <Chips names={value as string[]} />;
    case 'checkbox':
      return value === true ? t('common.yes') : null;
    case 'date':
      return formatDate(value as string);
    case 'datetime':
      return formatDateTime(value as string);
    case 'number':
      return (value as number).toLocaleString();
    case 'url':
      return (
        <a
          href={value as string}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate"
          title={value as string}
        >
          {(value as string).replace(/^https?:\/\//, '')}
        </a>
      );
    default:
      return (
        <span className="block truncate" title={value as string}>
          {value as string}
        </span>
      );
  }
}

function When({ iso }: { iso: string }) {
  return (
    <span className="text-[var(--ink-muted)]" title={formatDateTime(iso)}>
      {formatRelative(iso)}
    </span>
  );
}

/** One header cell; a button sorts by its field when the list can be sorted (E-48). */
function Header({
  column,
  label,
  sortable,
  sort,
  onSort,
}: {
  column: Column;
  label: string;
  sortable: boolean;
  sort?: SortKey | null;
  onSort?: (field: string) => void;
}) {
  const { t } = useTranslation();
  const sorted = sort?.field === column ? sort.direction : null;
  const Arrow = sorted === 'desc' ? ArrowDown : ArrowUp;
  return (
    <th
      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
      className={`${WIDTH[column as IssueColumn] ?? (isCustom(column) ? 'w-40' : '')} border-b border-[var(--border)] px-3 py-2 ${NUMERIC.has(column) ? 'text-right' : ''}`}
    >
      {sortable && onSort ? (
        <button
          type="button"
          onClick={() => onSort(column)}
          title={t('issues.sortBy', { column: label })}
          className={`inline-flex items-center gap-1 uppercase hover:text-[var(--ink)] ${sorted ? 'text-[var(--ink)]' : ''}`}
        >
          {label}
          {sorted && <Arrow size={12} weight="bold" aria-hidden />}
        </button>
      ) : (
        label
      )}
    </th>
  );
}

/**
 * Issue list (design: list view). Key and summary always show; `columns` adds more (T-QRY-08).
 * `empty` is shown for an empty list; pass null while the list is still loading. With
 * `onSelect`, a plain click on key or summary selects the issue instead of opening it, and
 * the arrow keys or j/k move the selection (E-49). Cells the caller may change are editable.
 */
export function IssueTable({
  issues,
  empty,
  columns = DEFAULT_ISSUE_COLUMNS,
  sort,
  onSort,
  selectedKey,
  onSelect,
  checked,
  onCheck,
}: {
  issues: IssueSummary[];
  empty: ReactNode | null;
  columns?: ListColumn[];
  sort?: SortKey | null;
  onSort?: (field: string) => void;
  selectedKey?: string;
  onSelect?: (key: string) => void;
  /** Issues ticked for a bulk change (TL-16); without it there are no checkboxes. */
  checked?: Set<string>;
  onCheck?: (keys: string[], on: boolean) => void;
}) {
  const { t } = useTranslation();
  const metaName = useMetaName();
  const duration = useDuration();
  const me = useQuery(meQuery).data;
  const meta = useQuery(trackingMetaQuery).data;
  const { update, move: moveIssue, screen, error } = useListEdit();
  const [assigning, setAssigning] = useState<IssueSummary | null>(null);
  const body = useRef<HTMLTableSectionElement>(null);
  const catalogue = useFieldCatalogue();
  const shown = new Set<Column>(columns);
  const all: Column[] = ['key', 'summary', ...columns];
  // The custom fields each listed project uses, once any custom column is shown.
  const projectKeys = columns.some(isCustom)
    ? [...new Set(issues.map((issue) => issue.project.key))]
    : [];
  const projectDetails = useQueries({ queries: projectKeys.map((key) => projectQuery(key)) });
  const fieldsOf = new Map(
    projectDetails.flatMap((query) =>
      query.data ? [[query.data.key, new Set(query.data.customFieldIds)] as const] : [],
    ),
  );
  const customField = (column: Column) =>
    isCustom(column)
      ? meta?.customFields.find((field) => `cf[${field.number}]` === column)
      : undefined;
  const columnName = (column: Column) =>
    isCustom(column)
      ? (customField(column)?.name ?? column)
      : t(`issues.columns.${column as Exclude<Column, `cf[${number}]`>}`);
  const edit = (issue: IssueSummary, change: UpdateIssueRequest) =>
    update.mutate({ key: issue.key, body: change });
  const label = (issue: IssueSummary, column: Column) =>
    t('issues.editIn', { field: columnName(column), key: issue.key });

  const open = (issue: IssueSummary) => (event: MouseEvent) => {
    if (!onSelect || !plainClick(event)) return;
    event.preventDefault();
    onSelect(issue.key);
  };

  /** Arrow keys and j/k on a row's link move to the next or previous row. */
  function move(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (target.tagName !== 'A') return;
    const step = { ArrowDown: 1, j: 1, ArrowUp: -1, k: -1 }[event.key];
    if (!step) return;
    const row = target.closest('tr');
    const rows = [...(body.current?.querySelectorAll('tr') ?? [])];
    const next = rows[rows.indexOf(row as HTMLTableRowElement) + step];
    if (!next) return;
    event.preventDefault();
    next.querySelector<HTMLAnchorElement>('a')?.focus();
    const key = next.dataset.key;
    if (key && onSelect && selectedKey) onSelect(key);
  }

  function cell(issue: IssueSummary, column: ListColumn): ReactNode {
    if (isCustom(column)) {
      const field = customField(column);
      if (!field) return null;
      // Editable where the field is switched on for the issue's project (TL-8).
      return issue.canEdit && !field.archived && fieldsOf.get(issue.project.key)?.has(field.id) ? (
        <FieldEditor
          field={field}
          value={issue.customFields[field.id]}
          projectKey={issue.project.key}
          disabled={false}
          label={label(issue, column)}
          onChange={(value) => edit(issue, { customFields: { [field.id]: value } })}
        />
      ) : (
        <CustomValue field={field} value={issue.customFields[field.id]} />
      );
    }
    switch (column) {
      case 'issuetype':
        return (
          <span className="flex items-center gap-2">
            <IssueTypeIcon type={issue.issueType} />
            <span className="truncate">{metaName('issueType', issue.issueType)}</span>
          </span>
        );
      case 'status':
        return (
          <StatusMenu
            issue={issue}
            enabled={issue.canTransition}
            onTransition={(transitionId) => void moveIssue(issue, transitionId)}
          />
        );
      case 'priority':
        return (
          <span className="flex items-center gap-1">
            <PriorityIcon priority={issue.priority} />
            {issue.canEdit && meta ? (
              <select
                aria-label={label(issue, 'priority')}
                value={issue.priority.key}
                onChange={(event) => edit(issue, { priority: event.target.value })}
                className={inputClass}
              >
                {meta.priorities.map((priority) => (
                  <option key={priority.id} value={priority.key}>
                    {metaName('priority', priority)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="truncate">{metaName('priority', issue.priority)}</span>
            )}
          </span>
        );
      case 'assignee':
        return issue.canAssign ? (
          <button
            type="button"
            onClick={() => setAssigning(issue)}
            className={`${inputClass} flex items-center text-left`}
          >
            <span className="sr-only">{label(issue, 'assignee')}: </span>
            <Person user={issue.assignee} none={t('issues.unassigned')} />
          </button>
        ) : (
          <Person user={issue.assignee} none={t('issues.unassigned')} />
        );
      case 'reporter':
        return <Person user={issue.reporter} none={t('issues.none')} />;
      case 'created':
        return <When iso={issue.createdAt} />;
      case 'updated':
        return <When iso={issue.updatedAt} />;
      case 'due':
        return issue.canEdit ? (
          <InlineInput
            type="date"
            aria-label={label(issue, 'due')}
            value={issue.dueDate ?? ''}
            disabled={false}
            onSave={(value) => edit(issue, { dueDate: value || null })}
          />
        ) : issue.dueDate ? (
          formatDate(issue.dueDate)
        ) : null;
      case 'resolution':
        return issue.resolution ? (
          metaName('resolution', issue.resolution)
        ) : (
          <span className="text-[var(--ink-muted)]">{t('issues.unresolved')}</span>
        );
      case 'labels':
        return issue.canEdit ? (
          <InlineInput
            aria-label={label(issue, 'labels')}
            value={issue.labels.join(' ')}
            disabled={false}
            onSave={(value) => edit(issue, { labels: value.split(/\s+/).filter(Boolean) })}
          />
        ) : (
          <Chips names={issue.labels} />
        );
      case 'component':
        return issue.canEdit ? (
          <ComponentsField
            projectKey={issue.project.key}
            value={issue.components}
            disabled={false}
            onChange={(components) => edit(issue, { components })}
          />
        ) : (
          <Chips names={issue.components.map((component) => component.name)} />
        );
      case 'fixVersion':
        return <Chips names={issue.fixVersions.map((version) => version.name)} />;
      case 'storyPoints':
        return issue.canEdit ? (
          <InlineInput
            type="number"
            min={0}
            step={0.5}
            aria-label={label(issue, 'storyPoints')}
            value={issue.storyPoints?.toString() ?? ''}
            disabled={false}
            onSave={(value) => edit(issue, { storyPoints: value === '' ? null : Number(value) })}
            className="text-right"
          />
        ) : (
          issue.storyPoints
        );
      case 'originalEstimate':
        return duration(issue.timeTracking.originalEstimateSeconds);
      case 'remainingEstimate':
        return duration(issue.timeTracking.remainingEstimateSeconds);
      case 'timeSpent':
        return issue.timeTracking.timeSpentSeconds > 0
          ? duration(issue.timeTracking.timeSpentSeconds)
          : null;
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <FormError message={error.message} />}
      {screen}
      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)]">
        <table
          onKeyDown={move}
          className="w-full border-collapse"
          style={{ minWidth: `${Math.max(760, 360 + columns.length * 140)}px` }}
        >
          <thead>
            <tr className="tl-label text-left text-[var(--ink-muted)]">
              {checked && onCheck && (
                <th className="w-8 border-b border-[var(--border)] px-2">
                  <input
                    type="checkbox"
                    aria-label={t('bulk.all')}
                    checked={issues.length > 0 && issues.every((issue) => checked.has(issue.key))}
                    onChange={(event) =>
                      onCheck(
                        issues.map((issue) => issue.key),
                        event.target.checked,
                      )
                    }
                  />
                </th>
              )}
              {all.map((column) => (
                <Header
                  key={column}
                  column={column}
                  label={columnName(column)}
                  sortable={!!catalogue.find(column)?.orderable}
                  sort={sort}
                  onSort={onSort}
                />
              ))}
            </tr>
          </thead>
          <tbody ref={body}>
            {issues.map((issue) => (
              <tr
                key={issue.id}
                data-key={issue.key}
                data-selected={issue.key === selectedKey}
                className="h-[var(--row-compact)] hover:bg-[var(--surface-2)] data-[selected=true]:bg-[var(--accent-soft)]"
              >
                {checked && onCheck && (
                  <td className="border-b border-[var(--border)] px-2">
                    <input
                      type="checkbox"
                      aria-label={t('bulk.one', { key: issue.key })}
                      checked={checked.has(issue.key)}
                      onChange={(event) => onCheck([issue.key], event.target.checked)}
                    />
                  </td>
                )}
                <td className="border-b border-[var(--border)] px-3">
                  <span className="flex items-center gap-2">
                    {!shown.has('issuetype') && <IssueTypeIcon type={issue.issueType} />}
                    <Link
                      to="/issues/$key"
                      params={{ key: issue.key }}
                      onClick={open(issue)}
                      aria-current={issue.key === selectedKey ? 'true' : undefined}
                      className="tl-key no-underline hover:underline"
                    >
                      {issue.key}
                    </Link>
                  </span>
                </td>
                <td className="max-w-0 border-b border-[var(--border)] px-3">
                  <span className="flex items-center gap-2">
                    {!shown.has('priority') && <PriorityIcon priority={issue.priority} />}
                    <Link
                      to="/issues/$key"
                      params={{ key: issue.key }}
                      onClick={open(issue)}
                      className="truncate text-[var(--ink)] no-underline hover:underline"
                    >
                      {issue.summary}
                    </Link>
                    {!shown.has('storyPoints') && issue.storyPoints !== null && (
                      <span className="ml-auto shrink-0 rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-1.5 text-xs font-semibold">
                        {issue.storyPoints}
                      </span>
                    )}
                  </span>
                </td>
                {columns.map((column) => (
                  <td
                    key={column}
                    className={`max-w-0 border-b border-[var(--border)] px-3 ${NUMERIC.has(column) ? 'text-right tabular-nums' : ''}`}
                  >
                    {cell(issue, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {issues.length === 0 && empty !== null && (
          <p className="px-3 py-8 text-center text-[var(--ink-muted)]">{empty}</p>
        )}
      </div>
      {assigning && me && (
        <UserPicker
          open
          onOpenChange={(next) => !next && setAssigning(null)}
          me={{ id: me.id, displayName: me.displayName }}
          projectKey={assigning.project.key}
          onPick={(user) => edit(assigning, { assigneeId: user?.id ?? null })}
        />
      )}
    </div>
  );
}
