import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, DotsSixVertical, Trash } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PROJECT_ROLES,
  type ProjectWorkflow,
  type PublishWorkflowRequest,
  type StatusCategory,
  TRANSITION_FIELDS,
  type TransitionRules,
  type WorkflowMode,
} from '@tasklore/shared';
import { type FormEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, client, unwrap } from '../../lib/api';
import { projectQuery, trackingMetaQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { WorkflowDiagram } from './WorkflowDiagram';

interface Row {
  /** Local identity: the status id, or a temporary one for a new status. */
  key: string;
  id: string | null;
  name: string;
  category: StatusCategory;
}

interface Draft {
  rows: Row[];
  initial: string;
  mode: WorkflowMode;
  /** Allowed moves as "fromKey>toKey". */
  pairs: Set<string>;
  /** Removed status id → row key its issues move to. */
  migrate: Record<string, string>;
  /** Rules for moving into a status, by row key (TL-11). */
  rules: Record<string, TransitionRules>;
}

const NO_RULES: TransitionRules = {
  onlyAssignee: false,
  roles: [],
  subtasksDone: false,
  requiredFields: [],
  assign: 'keep',
};
const ASSIGN = ['keep', 'caller', 'reporter', 'nobody'] as const;

/** How many rules are set, so empty ones are neither sent nor counted. */
function ruleCount(rules: TransitionRules | undefined): number {
  if (!rules) return 0;
  return (
    Number(rules.onlyAssignee) +
    Number(rules.roles.length > 0) +
    Number(rules.subtasksDone) +
    rules.requiredFields.length +
    Number(rules.assign !== 'keep')
  );
}

const DOT: Record<StatusCategory, string> = {
  todo: 'bg-[var(--border-strong)]',
  in_progress: 'bg-[var(--accent)]',
  done: 'bg-[var(--success)]',
};
const CATEGORIES: StatusCategory[] = ['todo', 'in_progress', 'done'];
const FIELD =
  'h-8 rounded-[var(--radius-md)] border border-[var(--border-control)] bg-[var(--surface-1)] px-2 text-[13px] text-[var(--ink)]';

function fromServer(workflow: ProjectWorkflow): Draft {
  return {
    rows: workflow.statuses.map((status) => ({
      key: status.id,
      id: status.id,
      name: status.name,
      category: status.category,
    })),
    initial: workflow.initialStatusId,
    mode: workflow.mode,
    pairs: new Set(workflow.transitions.map((pair) => `${pair.from}>${pair.to}`)),
    migrate: {},
    rules: workflow.rules,
  };
}

function allPairs(rows: Row[]): Set<string> {
  return new Set(
    rows.flatMap((from) => rows.filter((to) => to !== from).map((to) => `${from.key}>${to.key}`)),
  );
}

function toRequest(workflow: ProjectWorkflow, draft: Draft): PublishWorkflowRequest {
  const index = new Map(draft.rows.map((row, position) => [row.key, position]));
  return {
    baseVersionId: workflow.versionId,
    statuses: draft.rows.map(({ key, id, name, category }) => {
      const rules = draft.rules[key];
      return { id, name, category, ...(ruleCount(rules) > 0 ? { rules } : {}) };
    }),
    initial: index.get(draft.initial) ?? 0,
    mode: draft.mode,
    transitions:
      draft.mode === 'free'
        ? []
        : [...draft.pairs].flatMap((pair) => {
            const [from, to] = pair.split('>');
            const a = index.get(from ?? '');
            const b = index.get(to ?? '');
            return a === undefined || b === undefined || a === b ? [] : [{ from: a, to: b }];
          }),
    migrate: Object.fromEntries(
      Object.entries(draft.migrate).flatMap(([statusId, key]) => {
        const target = index.get(key);
        return target === undefined ? [] : [[statusId, target]];
      }),
    ),
  };
}

function StatusRow({
  row,
  position,
  last,
  initial,
  usage,
  editable,
  onMove,
  onRemove,
  onInitial,
}: {
  row: Row;
  position: number;
  last: boolean;
  initial: boolean;
  usage: number;
  editable: boolean;
  onMove: (delta: number) => void;
  onRemove: () => void;
  onInitial: () => void;
}) {
  const { t } = useTranslation();
  const sortable = useSortable({ id: row.key, disabled: !editable });
  const iconButton =
    'grid size-7 place-items-center rounded-[var(--radius-sm)] border-0 bg-transparent text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] disabled:invisible';
  return (
    <li
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      className={`grid grid-cols-[20px_10px_minmax(0,1fr)_120px_96px_auto] items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-1)] px-3.5 py-2 text-[13.5px] last:border-b-0 ${
        sortable.isDragging ? 'relative z-10 shadow-[var(--shadow-drag)]' : ''
      }`}
    >
      {editable ? (
        <button
          type="button"
          aria-label={t('workflow.drag', { name: row.name })}
          className="grid cursor-grab place-items-center border-0 bg-transparent p-0 text-[var(--ink-muted)]"
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <DotsSixVertical size={16} aria-hidden />
        </button>
      ) : (
        <span />
      )}
      <span aria-hidden className={`size-2.5 rounded-full ${DOT[row.category]}`} />
      <span className="truncate font-medium">
        {row.name}
        {!row.id && (
          <span className="ml-2 text-xs font-normal text-[var(--ink-muted)]">
            {t('workflow.newStatus')}
          </span>
        )}
      </span>
      <span className="text-[12.5px] text-[var(--ink-muted)]">
        {t(`workflow.categories.${row.category}`)}
      </span>
      <label className="flex items-center gap-1.5 text-[12.5px]" title={t('workflow.initialHint')}>
        <input
          type="radio"
          name="initial"
          aria-label={`${t('workflow.initial')}: ${row.name}`}
          checked={initial}
          disabled={!editable}
          onChange={onInitial}
        />
        {t('workflow.initial')}
      </label>
      <span className="flex items-center gap-0.5">
        <span className="mr-2 w-20 text-right text-xs text-[var(--ink-muted)]">
          {usage > 0 ? t('workflow.usage', { count: usage }) : t('workflow.unused')}
        </span>
        {editable && (
          <>
            <button
              type="button"
              aria-label={t('workflow.moveUp', { name: row.name })}
              disabled={position === 0}
              onClick={() => onMove(-1)}
              className={iconButton}
            >
              <ArrowUp size={14} aria-hidden />
            </button>
            <button
              type="button"
              aria-label={t('workflow.moveDown', { name: row.name })}
              disabled={last}
              onClick={() => onMove(1)}
              className={iconButton}
            >
              <ArrowDown size={14} aria-hidden />
            </button>
            <button
              type="button"
              aria-label={t('workflow.remove', { name: row.name })}
              disabled={initial}
              onClick={onRemove}
              className={`${iconButton} hover:!text-[var(--danger)]`}
            >
              <Trash size={14} aria-hidden />
            </button>
          </>
        )}
      </span>
    </li>
  );
}

/** Rules for moving into each status (TL-11, E-85), one folding panel per status. */
function TransitionRulesSection({
  rows,
  rules,
  fields,
  editable,
  onChange,
}: {
  rows: Row[];
  rules: Record<string, TransitionRules>;
  fields: Array<{ id: string; name: string }>;
  editable: boolean;
  onChange: (key: string, rules: TransitionRules) => void;
}) {
  const { t } = useTranslation();
  const fieldNames = [
    ...TRANSITION_FIELDS.map((field) => ({ id: field, name: t(`workflow.fields.${field}`) })),
    ...fields,
  ];
  const toggled = (list: string[], value: string) =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
  return (
    <section aria-label={t('workflow.rules')} className="flex flex-col gap-2">
      <h2 className="m-0 text-[13.5px] font-semibold">{t('workflow.rules')}</h2>
      <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('workflow.rulesHint')}</p>
      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        {rows.map((row) => {
          const current = rules[row.key] ?? NO_RULES;
          const set = (patch: Partial<TransitionRules>) =>
            onChange(row.key, { ...current, ...patch });
          const count = ruleCount(current);
          return (
            <details
              key={row.key}
              className="border-b border-[var(--border)] last:border-b-0 [&[open]>summary]:bg-[var(--surface-2)]"
            >
              <summary className="flex cursor-pointer items-center gap-3 px-3.5 py-2 text-[13.5px]">
                <span aria-hidden className={`size-2.5 rounded-full ${DOT[row.category]}`} />
                <span className="font-medium">{t('workflow.rulesInto', { name: row.name })}</span>
                <span className="text-xs text-[var(--ink-muted)]">
                  {count === 0 ? t('workflow.noRules') : t('workflow.ruleCount', { count })}
                </span>
              </summary>
              <fieldset
                disabled={!editable}
                className="m-0 grid gap-4 border-0 px-3.5 py-3 text-[13px] sm:grid-cols-3"
              >
                <div className="flex flex-col gap-1.5">
                  <strong className="text-xs text-[var(--ink-muted)]">
                    {t('workflow.conditions')}
                  </strong>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={current.onlyAssignee}
                      onChange={() => set({ onlyAssignee: !current.onlyAssignee })}
                    />
                    {t('workflow.onlyAssignee')}
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={current.subtasksDone}
                      onChange={() => set({ subtasksDone: !current.subtasksDone })}
                    />
                    {t('workflow.subtasksDone')}
                  </label>
                  <span className="mt-1 text-xs text-[var(--ink-muted)]">
                    {t('workflow.onlyRoles')}
                  </span>
                  {PROJECT_ROLES.map((role) => (
                    <label key={role} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={current.roles.includes(role)}
                        onChange={() =>
                          set({ roles: toggled(current.roles, role) as TransitionRules['roles'] })
                        }
                      />
                      {t(`projectSettings.roles.${role}`)}
                    </label>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5">
                  <strong className="text-xs text-[var(--ink-muted)]">
                    {t('workflow.required')}
                  </strong>
                  {fieldNames.map((field) => (
                    <label key={field.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={current.requiredFields.includes(field.id)}
                        onChange={() =>
                          set({ requiredFields: toggled(current.requiredFields, field.id) })
                        }
                      />
                      {field.name}
                    </label>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5">
                  <strong className="text-xs text-[var(--ink-muted)]">{t('workflow.after')}</strong>
                  {ASSIGN.map((value) => (
                    <label key={value} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`assign-${row.key}`}
                        checked={current.assign === value}
                        onChange={() => set({ assign: value })}
                      />
                      {t(`workflow.assign.${value}`)}
                    </label>
                  ))}
                </div>
              </fieldset>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function AddStatus({
  rows,
  available,
  onAdd,
}: {
  rows: Row[];
  available: ProjectWorkflow['available'];
  onAdd: (row: Row) => void;
}) {
  const { t } = useTranslation();
  const [choice, setChoice] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<StatusCategory>('in_progress');
  const [error, setError] = useState<string | null>(null);
  const unused = available.filter((status) => !rows.some((row) => row.id === status.id));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const picked =
      choice && choice !== 'new'
        ? available.find((status) => status.id === choice)
        : available.find((status) => status.name.toLowerCase() === name.trim().toLowerCase());
    const label = picked?.name ?? name.trim();
    if (!label) return;
    if (rows.some((row) => row.name.toLowerCase() === label.toLowerCase())) {
      setError(t('workflow.duplicate', { name: label }));
      return;
    }
    onAdd(
      picked
        ? { key: picked.id, id: picked.id, name: picked.name, category: picked.category }
        : { key: `new:${crypto.randomUUID()}`, id: null, name: label, category },
    );
    setChoice('');
    setName('');
    setError(null);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      {error && <FormError message={error} />}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-[var(--ink-muted)]">
          {t('workflow.addStatus')}
          <select
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            className={FIELD}
          >
            <option value="">{t('workflow.choose')}</option>
            {unused.map((status) => (
              <option key={status.id} value={status.id}>
                {status.name} · {t(`workflow.categories.${status.category}`)}
              </option>
            ))}
            <option value="new">{t('workflow.newStatus')} …</option>
          </select>
        </label>
        {choice === 'new' && (
          <>
            <label className="flex flex-col gap-1 text-xs text-[var(--ink-muted)]">
              {t('workflow.newName')}
              <input
                value={name}
                maxLength={60}
                onChange={(event) => setName(event.target.value)}
                className={`${FIELD} w-48`}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--ink-muted)]">
              {t('workflow.category')}
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as StatusCategory)}
                className={FIELD}
              >
                {CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {t(`workflow.categories.${value}`)}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <Button type="submit" disabled={!choice || (choice === 'new' && !name.trim())}>
          {t('workflow.add')}
        </Button>
      </div>
    </form>
  );
}

/** The project workflow as a list (T-WF-02 P1, E-70); publishing makes a new version. */
export function WorkflowEditor({
  projectKey,
  projectName,
  workflow,
  editable,
  onPublished,
}: {
  projectKey: string;
  projectName: string;
  /** Mount with `key={workflow.versionId}`: a new version starts a fresh draft. */
  workflow: ProjectWorkflow;
  editable: boolean;
  onPublished: (version: number) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => fromServer(workflow));
  const projectFields = useQuery(projectQuery(projectKey)).data?.customFieldIds;
  // The project's custom fields, and any a rule still requires.
  const required = new Set(Object.values(draft.rules).flatMap((rules) => rules.requiredFields));
  const fields = (useQuery(trackingMetaQuery).data?.customFields ?? [])
    .filter((field) => projectFields?.includes(field.id) || required.has(field.id))
    .map(({ id, name }) => ({ id, name }));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const request = useMemo(() => toRequest(workflow, draft), [workflow, draft]);
  const pristine = useMemo(
    () => JSON.stringify(toRequest(workflow, fromServer(workflow))),
    [workflow],
  );
  const changed = JSON.stringify(request) !== pristine;
  const removedInUse = workflow.statuses.filter(
    (status) =>
      (workflow.usage[status.id] ?? 0) > 0 && !draft.rows.some((row) => row.id === status.id),
  );
  const missingTarget = removedInUse.some((status) => !draft.migrate[status.id]);
  const diagramPairs = useMemo(
    () =>
      draft.mode === 'free'
        ? null
        : [...draft.pairs].map((pair) => pair.split('>') as [string, string]),
    [draft.mode, draft.pairs],
  );
  const ruleCounts = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(draft.rules).map(([key, rules]) => [key, ruleCount(rules)]),
      ),
    [draft.rules],
  );

  const publish = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/projects/{key}/workflow', {
          params: { path: { key: projectKey } },
          body: request,
        }),
      ),
    onSuccess: (saved) => {
      onPublished(saved.version);
      queryClient.setQueryData(['project-workflow', projectKey], saved);
      void queryClient.invalidateQueries({ queryKey: ['project', projectKey] });
      void queryClient.invalidateQueries({ queryKey: ['board'] });
    },
  });
  const conflict = publish.error instanceof ApiError && publish.error.status === 409;

  const update = (change: (current: Draft) => Draft) => setDraft(change);
  const move = (from: number, to: number) =>
    update((current) => ({ ...current, rows: arrayMove(current.rows, from, to) }));
  const onDragEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    const from = draft.rows.findIndex((row) => row.key === event.active.id);
    const to = draft.rows.findIndex((row) => row.key === event.over?.id);
    if (from >= 0 && to >= 0) move(from, to);
  };
  const toggle = (pair: string) =>
    update((current) => {
      const pairs = new Set(current.pairs);
      if (pairs.has(pair)) pairs.delete(pair);
      else pairs.add(pair);
      return { ...current, pairs };
    });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-[22px] leading-7 font-semibold tracking-[-0.015em]">
          {t('workflow.title')}
        </h1>
        <p className="m-0 text-[13.5px] text-[var(--ink-muted)]">
          {t('workflow.appliesTo', { name: projectName })}{' '}
          {workflow.ownedByProject
            ? t('workflow.own', { version: workflow.version })
            : t('workflow.shared', { name: workflow.name })}
        </p>
      </header>
      {!editable && <p className="m-0 text-[var(--ink-muted)]">{t('projectSettings.readOnly')}</p>}

      <section aria-label={t('workflow.statuses')} className="flex flex-col gap-2">
        <h2 className="m-0 text-[13.5px] font-semibold">{t('workflow.statuses')}</h2>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={draft.rows.map((row) => row.key)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="m-0 list-none overflow-hidden rounded-lg border border-[var(--border)] p-0">
              {draft.rows.map((row, position) => (
                <StatusRow
                  key={row.key}
                  row={row}
                  position={position}
                  last={position === draft.rows.length - 1}
                  initial={draft.initial === row.key}
                  usage={row.id ? (workflow.usage[row.id] ?? 0) : 0}
                  editable={editable}
                  onMove={(delta) => move(position, position + delta)}
                  onInitial={() => update((current) => ({ ...current, initial: row.key }))}
                  onRemove={() =>
                    update((current) => ({
                      ...current,
                      rows: current.rows.filter((entry) => entry.key !== row.key),
                      pairs: new Set(
                        [...current.pairs].filter((pair) => !pair.split('>').includes(row.key)),
                      ),
                      migrate: Object.fromEntries(
                        Object.entries(current.migrate).filter(([, key]) => key !== row.key),
                      ),
                    }))
                  }
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        {editable && (
          <AddStatus
            rows={draft.rows}
            available={workflow.available}
            onAdd={(row) => update((current) => ({ ...current, rows: [...current.rows, row] }))}
          />
        )}
      </section>

      <section aria-label={t('workflow.transitions')} className="flex flex-col gap-2">
        <h2 className="m-0 text-[13.5px] font-semibold">{t('workflow.transitions')}</h2>
        <fieldset
          disabled={!editable}
          className="m-0 flex w-fit overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-control)] p-0 text-[13px]"
        >
          <legend className="sr-only">{t('workflow.transitions')}</legend>
          {(['free', 'defined'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={draft.mode === mode}
              onClick={() =>
                update((current) => ({
                  ...current,
                  mode,
                  // Switching to "defined" starts from what "free" allowed.
                  pairs:
                    mode === 'defined' && current.mode === 'free'
                      ? allPairs(current.rows)
                      : current.pairs,
                }))
              }
              className="cursor-pointer border-0 bg-[var(--surface-1)] px-4 py-1.5 text-[var(--ink)] hover:bg-[var(--surface-2)] aria-pressed:bg-[var(--ink)] aria-pressed:font-medium aria-pressed:text-[var(--surface-1)]"
            >
              {t(`workflow.${mode}`)}
            </button>
          ))}
        </fieldset>
        <p className="m-0 text-[13px] text-[var(--ink-muted)]">
          {t(draft.mode === 'free' ? 'workflow.freeHint' : 'workflow.definedHint')}
        </p>
        <WorkflowDiagram
          rows={draft.rows}
          initial={draft.initial}
          pairs={diagramPairs}
          ruleCounts={ruleCounts}
        />
        {draft.mode === 'defined' && (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="border-b border-[var(--border)] px-3 py-2 text-left" />
                  {draft.rows.map((to) => (
                    <th
                      key={to.key}
                      scope="col"
                      className="border-b border-[var(--border)] px-3 py-2 text-center font-medium"
                    >
                      {to.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.rows.map((from) => (
                  <tr key={from.key}>
                    <th
                      scope="row"
                      className="border-b border-[var(--border)] px-3 py-2 text-left font-medium"
                    >
                      {from.name}
                    </th>
                    {draft.rows.map((to) => (
                      <td
                        key={to.key}
                        className="border-b border-[var(--border)] px-3 py-2 text-center"
                      >
                        {from.key !== to.key && (
                          <input
                            type="checkbox"
                            disabled={!editable}
                            aria-label={t('workflow.fromTo', { from: from.name, to: to.name })}
                            checked={draft.pairs.has(`${from.key}>${to.key}`)}
                            onChange={() => toggle(`${from.key}>${to.key}`)}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <TransitionRulesSection
        rows={draft.rows}
        rules={draft.rules}
        fields={fields}
        editable={editable}
        onChange={(key, rules) =>
          update((current) => ({ ...current, rules: { ...current.rules, [key]: rules } }))
        }
      />

      {removedInUse.length > 0 && (
        <section
          aria-label={t('workflow.migrate')}
          className="flex flex-col gap-2 rounded-lg border border-[var(--warning)] bg-[var(--warning-soft)] px-4 py-3"
        >
          <h2 className="m-0 text-[13.5px] font-semibold">{t('workflow.migrate')}</h2>
          <p className="m-0 text-[13px]">{t('workflow.migrateHint')}</p>
          {removedInUse.map((status) => (
            <label key={status.id} className="flex flex-wrap items-center gap-2 text-[13px]">
              {t('workflow.migrateTo', {
                count: workflow.usage[status.id] ?? 0,
                name: status.name,
              })}
              <select
                value={draft.migrate[status.id] ?? ''}
                onChange={(event) =>
                  update((current) => ({
                    ...current,
                    migrate: { ...current.migrate, [status.id]: event.target.value },
                  }))
                }
                className={FIELD}
              >
                <option value="">{t('workflow.choose')}</option>
                {draft.rows.map((row) => (
                  <option key={row.key} value={row.key}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </section>
      )}

      {publish.error && (
        <FormError message={conflict ? t('workflow.conflict') : publish.error.message} />
      )}
      {editable && (
        <div className="flex gap-2">
          <Button
            variant="primary"
            disabled={!changed || missingTarget || publish.isPending}
            onClick={() => publish.mutate()}
          >
            {t('workflow.publish')}
          </Button>
          {conflict ? (
            <Button
              variant="ghost"
              onClick={() => {
                publish.reset();
                void queryClient.invalidateQueries({ queryKey: ['project-workflow', projectKey] });
              }}
            >
              {t('workflow.reload')}
            </Button>
          ) : (
            <Button
              variant="ghost"
              disabled={!changed}
              onClick={() => update(() => fromServer(workflow))}
            >
              {t('workflow.discard')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
