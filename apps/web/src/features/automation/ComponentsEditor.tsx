import { ArrowDown, ArrowUp, Trash } from '@phosphor-icons/react';
import {
  type AutomationAction,
  type AutomationComponent,
  type AutomationCondition,
  COMPARE_OPERATORS,
  SET_FIELDS,
} from '@tasklore/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '../../ui/Select';
import { TextField } from '../../ui/TextField';

type Type = AutomationComponent['type'];

const CONDITIONS = ['tql', 'compare', 'user'] as const;
const BLOCKS = ['if', 'branch'] as const;
const ACTIONS = [
  'set-field',
  'transition',
  'assign',
  'comment',
  'create-issue',
  'clone-issue',
  'link',
  'email',
  'webhook',
  'create-page',
] as const;

/** A new component of a type with empty settings. */
export function blank(type: Type): AutomationComponent {
  switch (type) {
    case 'tql':
      return { type, query: '', mode: 'matches' };
    case 'compare':
      return { type, left: '{{issue.priority.name}}', operator: 'equals', right: '' };
    case 'user':
      return { type, who: 'assignee', check: 'empty', value: '' };
    case 'if':
      return {
        type,
        match: 'all',
        conditions: [blank('tql') as AutomationCondition],
        onTrue: [],
        onFalse: [],
      };
    case 'branch':
      return { type, over: 'subtasks', query: '', components: [] };
    case 'set-field':
      return { type, field: 'priority', value: '' };
    case 'transition':
      return { type, to: '' };
    case 'assign':
      return { type, to: 'initiator', userId: '' };
    case 'comment':
      return { type, body: '' };
    case 'create-issue':
      return {
        type,
        projectKey: '',
        issueType: 'task',
        summary: '',
        description: '',
        subtask: false,
      };
    case 'clone-issue':
      return { type, summary: '', includeSubtasks: false };
    case 'link':
      return { type, linkType: 'relates', direction: 'outward', target: '' };
    case 'email':
      return { type, to: ['assignee'], addresses: '', subject: '', body: '' };
    case 'webhook':
      return { type, url: 'https://', body: '' };
    case 'create-page':
      return {
        type,
        spaceKey: '',
        parentId: '',
        title: '{{issue.key}} {{issue.summary}}',
        content: '',
      };
  }
}

function TextArea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="tl-field-label">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] p-2 font-[family-name:var(--font-mono)] text-[13px] text-[var(--ink)]"
      />
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[13px]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

function ConditionFields({
  value,
  onChange,
}: {
  value: AutomationCondition;
  onChange: (value: AutomationCondition) => void;
}) {
  const { t } = useTranslation();
  switch (value.type) {
    case 'tql':
      return (
        <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
          <TextField
            label={t('automation.fields.query')}
            value={value.query}
            className="font-[family-name:var(--font-mono)]"
            onChange={(event) => onChange({ ...value, query: event.target.value })}
          />
          <Select
            label={t('automation.fields.mode')}
            value={value.mode}
            options={(['matches', 'some', 'none'] as const).map((mode) => ({
              value: mode,
              label: t(`automation.modes.${mode}`),
            }))}
            onChange={(event) =>
              onChange({ ...value, mode: event.target.value as typeof value.mode })
            }
          />
        </div>
      );
    case 'compare':
      return (
        <div className="grid gap-2 sm:grid-cols-[1fr_160px_1fr]">
          <TextField
            label={t('automation.fields.left')}
            value={value.left}
            onChange={(event) => onChange({ ...value, left: event.target.value })}
          />
          <Select
            label={t('automation.fields.operator')}
            value={value.operator}
            options={COMPARE_OPERATORS.map((operator) => ({
              value: operator,
              label: t(`automation.operators.${operator}`),
            }))}
            onChange={(event) =>
              onChange({ ...value, operator: event.target.value as typeof value.operator })
            }
          />
          <TextField
            label={t('automation.fields.right')}
            value={value.right}
            onChange={(event) => onChange({ ...value, right: event.target.value })}
          />
        </div>
      );
    case 'user':
      return (
        <div className="grid gap-2 sm:grid-cols-3">
          <Select
            label={t('automation.fields.who')}
            value={value.who}
            options={(['initiator', 'assignee', 'reporter'] as const).map((who) => ({
              value: who,
              label: t(`automation.people.${who}`),
            }))}
            onChange={(event) =>
              onChange({ ...value, who: event.target.value as typeof value.who })
            }
          />
          <Select
            label={t('automation.fields.check')}
            value={value.check}
            options={(
              ['is', 'is-not', 'in-group', 'not-in-group', 'empty', 'not-empty'] as const
            ).map((check) => ({ value: check, label: t(`automation.checks.${check}`) }))}
            onChange={(event) =>
              onChange({ ...value, check: event.target.value as typeof value.check })
            }
          />
          {!['empty', 'not-empty'].includes(value.check) && (
            <TextField
              label={
                value.check.includes('group')
                  ? t('automation.fields.group')
                  : t('automation.fields.userId')
              }
              value={value.value}
              onChange={(event) => onChange({ ...value, value: event.target.value })}
            />
          )}
        </div>
      );
  }
}

function ActionFields({
  value,
  onChange,
}: {
  value: AutomationAction;
  onChange: (value: AutomationAction) => void;
}) {
  const { t } = useTranslation();
  const text = (key: string, label: string, mono = false) => (
    <TextField
      label={label}
      value={String((value as Record<string, unknown>)[key] ?? '')}
      className={mono ? 'font-[family-name:var(--font-mono)]' : ''}
      onChange={(event) => onChange({ ...value, [key]: event.target.value } as AutomationAction)}
    />
  );
  const area = (key: string, label: string) => (
    <TextArea
      label={label}
      value={String((value as Record<string, unknown>)[key] ?? '')}
      onChange={(next) => onChange({ ...value, [key]: next } as AutomationAction)}
    />
  );
  switch (value.type) {
    case 'set-field':
      return (
        <div className="grid gap-2 sm:grid-cols-[200px_1fr]">
          <Select
            label={t('automation.fields.field')}
            value={value.field}
            options={SET_FIELDS.map((field) => ({
              value: field,
              label: t(`automation.setFields.${field}`),
            }))}
            onChange={(event) =>
              onChange({ ...value, field: event.target.value as typeof value.field })
            }
          />
          {text('value', t('automation.fields.value'))}
        </div>
      );
    case 'transition':
      return text('to', t('automation.fields.toStatus'));
    case 'assign':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            label={t('automation.fields.assignTo')}
            value={value.to}
            options={(['initiator', 'reporter', 'unassigned', 'user'] as const).map((to) => ({
              value: to,
              label: t(`automation.assignees.${to}`),
            }))}
            onChange={(event) => onChange({ ...value, to: event.target.value as typeof value.to })}
          />
          {value.to === 'user' && text('userId', t('automation.fields.userId'))}
        </div>
      );
    case 'comment':
      return area('body', t('automation.fields.body'));
    case 'create-issue':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {text('projectKey', t('automation.fields.projectKey'))}
          {text('issueType', t('automation.fields.issueType'))}
          <div className="sm:col-span-2">{text('summary', t('automation.fields.summary'))}</div>
          <div className="sm:col-span-2">
            {area('description', t('automation.fields.description'))}
          </div>
          <Check
            label={t('automation.fields.subtask')}
            checked={value.subtask}
            onChange={(subtask) => onChange({ ...value, subtask })}
          />
        </div>
      );
    case 'clone-issue':
      return (
        <div className="flex flex-col gap-2">
          {text('summary', t('automation.fields.cloneSummary'))}
          <Check
            label={t('automation.fields.includeSubtasks')}
            checked={value.includeSubtasks}
            onChange={(includeSubtasks) => onChange({ ...value, includeSubtasks })}
          />
        </div>
      );
    case 'link':
      return (
        <div className="grid gap-2 sm:grid-cols-3">
          {text('linkType', t('automation.fields.linkType'))}
          <Select
            label={t('automation.fields.direction')}
            value={value.direction}
            options={(['outward', 'inward'] as const).map((direction) => ({
              value: direction,
              label: t(`automation.directions.${direction}`),
            }))}
            onChange={(event) =>
              onChange({ ...value, direction: event.target.value as typeof value.direction })
            }
          />
          {text('target', t('automation.fields.target'))}
        </div>
      );
    case 'email':
      return (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-4">
            {(['assignee', 'reporter', 'watchers', 'initiator'] as const).map((who) => (
              <Check
                key={who}
                label={t(`automation.people.${who}`)}
                checked={value.to.includes(who)}
                onChange={(checked) =>
                  onChange({
                    ...value,
                    to: checked ? [...value.to, who] : value.to.filter((entry) => entry !== who),
                  })
                }
              />
            ))}
          </div>
          {text('addresses', t('automation.fields.addresses'))}
          {text('subject', t('automation.fields.subject'))}
          {area('body', t('automation.fields.body'))}
        </div>
      );
    case 'webhook':
      return (
        <div className="flex flex-col gap-2">
          {text('url', t('automation.fields.url'), true)}
          {area('body', t('automation.fields.webhookBody'))}
        </div>
      );
    case 'create-page':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {text('spaceKey', t('automation.fields.spaceKey'))}
          {text('parentId', t('automation.fields.parentId'), true)}
          <div className="sm:col-span-2">{text('title', t('automation.fields.title'))}</div>
          <div className="sm:col-span-2">{area('content', t('automation.fields.content'))}</div>
        </div>
      );
  }
}

function AddComponent({
  onAdd,
  only,
}: {
  onAdd: (component: AutomationComponent) => void;
  only?: 'conditions';
}) {
  const { t } = useTranslation();
  const groups = only
    ? [{ label: t('automation.groups.conditions'), types: CONDITIONS }]
    : [
        { label: t('automation.groups.conditions'), types: CONDITIONS },
        { label: t('automation.groups.blocks'), types: BLOCKS },
        { label: t('automation.groups.actions'), types: ACTIONS },
      ];
  return (
    <label className="flex items-center gap-2 text-[13px]">
      <span className="sr-only">{t('automation.add')}</span>
      <select
        value=""
        onChange={(event) => event.target.value && onAdd(blank(event.target.value as Type))}
        className="h-8 rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-[var(--ink-muted)]"
      >
        <option value="">+ {only ? t('automation.addCondition') : t('automation.add')}</option>
        {groups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.types.map((type) => (
              <option key={type} value={type}>
                {t(`automation.components.${type}`)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function Card({
  title,
  kind,
  children,
  onUp,
  onDown,
  onRemove,
}: {
  title: string;
  kind: 'condition' | 'block' | 'action';
  children: ReactNode;
  onUp?: () => void;
  onDown?: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const icon =
    'grid size-7 place-items-center rounded-[var(--radius-sm)] text-[var(--ink-muted)] hover:bg-[var(--selected)] disabled:opacity-30';
  const accent =
    kind === 'condition'
      ? 'border-l-[var(--warning)]'
      : kind === 'block'
        ? 'border-l-[var(--accent)]'
        : 'border-l-[var(--success)]';
  return (
    <div
      className={`flex flex-col gap-2 rounded-[var(--radius-md)] border border-l-4 border-[var(--border)] ${accent} bg-[var(--surface-1)] p-3`}
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-[13px] font-semibold">{title}</span>
        <button
          type="button"
          className={icon}
          disabled={!onUp}
          onClick={onUp}
          aria-label={t('automation.up', { title })}
        >
          <ArrowUp size={14} />
        </button>
        <button
          type="button"
          className={icon}
          disabled={!onDown}
          onClick={onDown}
          aria-label={t('automation.down', { title })}
        >
          <ArrowDown size={14} />
        </button>
        <button
          type="button"
          className={icon}
          onClick={onRemove}
          aria-label={t('automation.remove', { title })}
        >
          <Trash size={14} />
        </button>
      </div>
      {children}
    </div>
  );
}

/** The components of a rule, nested blocks included; conditions stop the list when they fail. */
export function ComponentsEditor({
  components,
  onChange,
  only,
}: {
  components: AutomationComponent[];
  onChange: (components: AutomationComponent[]) => void;
  only?: 'conditions';
}) {
  const { t } = useTranslation();
  const set = (index: number, next: AutomationComponent) =>
    onChange(components.map((entry, at) => (at === index ? next : entry)));
  const swap = (index: number, by: number) => {
    const next = [...components];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(index + by, 0, moved);
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2">
      {components.map((component, index) => {
        const kind = (CONDITIONS as readonly string[]).includes(component.type)
          ? 'condition'
          : (BLOCKS as readonly string[]).includes(component.type)
            ? 'block'
            : 'action';
        return (
          <Card
            // biome-ignore lint/suspicious/noArrayIndexKey: components have no ids; order is their identity
            key={index}
            title={t(`automation.components.${component.type}`)}
            kind={kind}
            onUp={index > 0 ? () => swap(index, -1) : undefined}
            onDown={index < components.length - 1 ? () => swap(index, 1) : undefined}
            onRemove={() => onChange(components.filter((_, at) => at !== index))}
          >
            {component.type === 'if' ? (
              <div className="flex flex-col gap-2">
                <Select
                  label={t('automation.fields.match')}
                  value={component.match}
                  options={(['all', 'any'] as const).map((match) => ({
                    value: match,
                    label: t(`automation.match.${match}`),
                  }))}
                  onChange={(event) =>
                    set(index, { ...component, match: event.target.value as 'all' | 'any' })
                  }
                />
                <ComponentsEditor
                  only="conditions"
                  components={component.conditions}
                  onChange={(conditions) =>
                    set(index, { ...component, conditions: conditions as AutomationCondition[] })
                  }
                />
                <span className="tl-label text-[var(--ink-muted)]">{t('automation.thenStep')}</span>
                <div className="border-l-2 border-[var(--border)] pl-3">
                  <ComponentsEditor
                    components={component.onTrue}
                    onChange={(onTrue) => set(index, { ...component, onTrue })}
                  />
                </div>
                <span className="tl-label text-[var(--ink-muted)]">{t('automation.elseStep')}</span>
                <div className="border-l-2 border-[var(--border)] pl-3">
                  <ComponentsEditor
                    components={component.onFalse}
                    onChange={(otherwise) => set(index, { ...component, onFalse: otherwise })}
                  />
                </div>
              </div>
            ) : component.type === 'branch' ? (
              <div className="flex flex-col gap-2">
                <div className="grid gap-2 sm:grid-cols-[200px_1fr]">
                  <Select
                    label={t('automation.fields.over')}
                    value={component.over}
                    options={(['subtasks', 'parent', 'linked', 'query'] as const).map((over) => ({
                      value: over,
                      label: t(`automation.over.${over}`),
                    }))}
                    onChange={(event) =>
                      set(index, {
                        ...component,
                        over: event.target.value as typeof component.over,
                      })
                    }
                  />
                  {component.over === 'query' && (
                    <TextField
                      label={t('automation.fields.query')}
                      value={component.query}
                      className="font-[family-name:var(--font-mono)]"
                      onChange={(event) => set(index, { ...component, query: event.target.value })}
                    />
                  )}
                </div>
                <div className="border-l-2 border-[var(--border)] pl-3">
                  <ComponentsEditor
                    components={component.components}
                    onChange={(nested) => set(index, { ...component, components: nested })}
                  />
                </div>
              </div>
            ) : kind === 'condition' ? (
              <ConditionFields
                value={component as AutomationCondition}
                onChange={(next) => set(index, next)}
              />
            ) : (
              <ActionFields
                value={component as AutomationAction}
                onChange={(next) => set(index, next)}
              />
            )}
          </Card>
        );
      })}
      <AddComponent only={only} onAdd={(component) => onChange([...components, component])} />
    </div>
  );
}
