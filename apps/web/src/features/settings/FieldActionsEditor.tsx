import { Plus, Trash } from '@phosphor-icons/react';
import {
  type CustomField,
  TRANSITION_CLEARABLE,
  type TransitionFieldAction,
} from '@toolvibes/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type Action = TransitionFieldAction['action'];
export type FieldChoice = Pick<CustomField, 'id' | 'name' | 'type' | 'options'>;

const FIELD =
  'h-8 rounded-[var(--radius-md)] border border-[var(--border-control)] bg-[var(--surface-1)] px-2 text-[13px] text-[var(--ink)]';
/** Custom field types a transition can set to one fixed value. */
const SETTABLE = new Set(['text', 'textarea', 'url', 'number', 'date', 'checkbox', 'select']);

function actionsFor(field: string, custom: FieldChoice | undefined): Action[] {
  if (field === 'labels') return ['clear', 'add', 'remove'];
  if (custom && SETTABLE.has(custom.type)) return ['set', 'clear'];
  return field ? ['clear'] : [];
}

/** Field changes after a transition, in order (TL-75, E-86). */
export function FieldActionsEditor({
  actions,
  fields,
  onChange,
}: {
  actions: TransitionFieldAction[];
  fields: FieldChoice[];
  onChange: (actions: TransitionFieldAction[]) => void;
}) {
  const { t } = useTranslation();
  const [field, setField] = useState('');
  const [action, setAction] = useState<Action>('clear');
  const [value, setValue] = useState('');
  const custom = (id: string) => fields.find((entry) => entry.id === id);
  const name = (id: string) =>
    (TRANSITION_CLEARABLE as readonly string[]).includes(id)
      ? t(`workflow.fields.${id as (typeof TRANSITION_CLEARABLE)[number]}`)
      : (custom(id)?.name ?? id);
  const shown = (entry: TransitionFieldAction) => {
    const target = custom(entry.field);
    if (typeof entry.value === 'boolean') return t(entry.value ? 'workflow.yes' : 'workflow.no');
    if (target?.type === 'select') {
      return target.options.find((option) => option.id === entry.value)?.value ?? '';
    }
    return String(entry.value ?? '');
  };
  const target = custom(field);
  const allowed = actionsFor(field, target);
  const chosen = allowed.includes(action) ? action : (allowed[0] ?? 'clear');
  const needsValue = chosen === 'add' || chosen === 'remove' || chosen === 'set';
  const parsed = (): TransitionFieldAction['value'] => {
    if (target?.type === 'number') return value === '' ? undefined : Number(value);
    if (target?.type === 'checkbox') return value === 'true';
    return value.trim() || undefined;
  };
  const ready = !!field && (!needsValue || parsed() !== undefined);

  return (
    <div className="flex flex-col gap-1.5">
      {actions.length === 0 ? (
        <span className="text-[var(--ink-muted)]">{t('workflow.noFieldActions')}</span>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-1 p-0">
          {actions.map((entry, index) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: the same action may appear twice
              key={index}
              className="flex items-center gap-2"
            >
              <span className="flex-1">
                {t(`workflow.fieldAction.${entry.action}`, {
                  field: name(entry.field),
                  value: shown(entry),
                })}
              </span>
              <button
                type="button"
                aria-label={t('workflow.removeFieldAction')}
                onClick={() => onChange(actions.filter((_, position) => position !== index))}
                className="cursor-pointer rounded-[var(--radius-sm)] border-0 bg-transparent p-1 text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
              >
                <Trash size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={t('workflow.fieldActionField')}
          value={field}
          onChange={(event) => {
            setField(event.target.value);
            setValue('');
          }}
          className={FIELD}
        >
          <option value="">{t('workflow.chooseField')}</option>
          {TRANSITION_CLEARABLE.map((key) => (
            <option key={key} value={key}>
              {t(`workflow.fields.${key}`)}
            </option>
          ))}
          {fields.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
        {allowed.length > 1 && (
          <select
            aria-label={t('workflow.fieldActionKind')}
            value={chosen}
            onChange={(event) => {
              setAction(event.target.value as Action);
              setValue('');
            }}
            className={FIELD}
          >
            {allowed.map((entry) => (
              <option key={entry} value={entry}>
                {t(`workflow.fieldActionKinds.${entry}`)}
              </option>
            ))}
          </select>
        )}
        {needsValue &&
          (target?.type === 'select' ? (
            <select
              aria-label={t('workflow.fieldActionValue')}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className={FIELD}
            >
              <option value="">{t('workflow.choose')}</option>
              {target.options
                .filter((option) => !option.archived)
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.value}
                  </option>
                ))}
            </select>
          ) : target?.type === 'checkbox' ? (
            <select
              aria-label={t('workflow.fieldActionValue')}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className={FIELD}
            >
              <option value="">{t('workflow.choose')}</option>
              <option value="true">{t('workflow.yes')}</option>
              <option value="false">{t('workflow.no')}</option>
            </select>
          ) : (
            <input
              aria-label={t('workflow.fieldActionValue')}
              type={
                target?.type === 'number' ? 'number' : target?.type === 'date' ? 'date' : 'text'
              }
              value={value}
              onChange={(event) =>
                setValue(
                  field === 'labels' ? event.target.value.replace(/\s/g, '') : event.target.value,
                )
              }
              placeholder={field === 'labels' ? t('workflow.labelPlaceholder') : ''}
              className={`${FIELD} w-40`}
            />
          ))}
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            const next = parsed();
            onChange([
              ...actions,
              {
                field,
                action: chosen,
                ...(needsValue && next !== undefined ? { value: next } : {}),
              },
            ]);
            setField('');
            setValue('');
          }}
          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border-control)] bg-[var(--surface-1)] px-2.5 text-[13px] text-[var(--ink)] hover:bg-[var(--surface-2)] disabled:cursor-default disabled:opacity-50"
        >
          <Plus size={13} aria-hidden />
          {t('workflow.add')}
        </button>
      </div>
    </div>
  );
}
