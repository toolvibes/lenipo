import { ArrowSquareOut } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import type {
  CustomField,
  CustomFieldInput,
  CustomFieldValue,
  Issue,
  ProjectFieldConfig,
  UserRef,
} from '@toolvibes/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { meQuery } from '../../lib/queries';
import { trackingMetaQuery, versionsQuery } from '../../lib/tracking';
import { groupsQuery } from '../../lib/wiki';
import { CheckRow, Popover } from '../../ui/Popover';
import { InlineInput, inputClass } from './fields';
import { Avatar, UserPicker } from './UserPicker';

type Option = { id: string; value: string };

/** `datetime-local` works in local time without zone; values are ISO instants. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Multi-line text that saves on blur when it changed. */
function InlineTextarea({
  value,
  label,
  disabled,
  onSave,
}: {
  value: string;
  label: string;
  disabled: boolean;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <textarea
      aria-label={label}
      value={draft}
      disabled={disabled}
      rows={Math.min(6, Math.max(2, draft.split('\n').length))}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => draft !== value && onSave(draft)}
      onKeyDown={(event) => event.key === 'Escape' && setDraft(value)}
      className={`${inputClass} !h-auto resize-y py-1`}
    />
  );
}

/**
 * One custom field of an issue with the editor its type needs (T-FLD-01, E-50); also used in
 * the cells of issue lists (TL-8), where `label` names the issue as well.
 */
export function FieldEditor({
  field,
  value,
  projectKey,
  disabled,
  onChange,
  label = field.name,
  offered = [],
}: {
  field: CustomField;
  value: CustomFieldValue | undefined;
  projectKey: string;
  disabled: boolean;
  /** The value as written, and how it shows, so a form not yet sent needs no round trip. */
  onChange: (value: CustomFieldInput, shown?: CustomFieldValue | null) => void;
  label?: string;
  /** The options the project offers for this field (TL-80); empty or missing means all. */
  offered?: string[];
}) {
  const { t } = useTranslation();
  const me = useQuery(meQuery).data;
  const [picking, setPicking] = useState(false);
  const usable = field.options.filter(
    (option) => !option.archived && (offered.length === 0 || offered.includes(option.id)),
  );
  const groups = useQuery({ ...groupsQuery, enabled: field.type === 'group' && !disabled });
  const versions = useQuery({
    ...versionsQuery(projectKey),
    enabled: field.type === 'version' && !disabled,
  });

  switch (field.type) {
    case 'text':
      return (
        <InlineInput
          aria-label={label}
          value={(value as string | undefined) ?? ''}
          disabled={disabled}
          maxLength={255}
          onSave={(next) => onChange(next.trim() || null)}
        />
      );
    case 'textarea':
      return (
        <InlineTextarea
          label={label}
          value={(value as string | undefined) ?? ''}
          disabled={disabled}
          onSave={(next) => onChange(next.trim() ? next : null)}
        />
      );
    case 'url': {
      const link = value as string | undefined;
      return (
        <span className="flex items-center gap-1">
          <InlineInput
            type="url"
            aria-label={label}
            value={link ?? ''}
            disabled={disabled}
            placeholder="https://"
            onSave={(next) => onChange(next.trim() || null)}
          />
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('fields.openLink')}
              title={t('fields.openLink')}
              className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-md)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
            >
              <ArrowSquareOut size={16} aria-hidden />
            </a>
          )}
        </span>
      );
    }
    case 'number':
      return (
        <InlineInput
          type="number"
          step="any"
          aria-label={label}
          value={value === undefined ? '' : String(value)}
          disabled={disabled}
          onSave={(next) => onChange(next === '' ? null : Number(next))}
        />
      );
    case 'date':
      return (
        <InlineInput
          type="date"
          aria-label={label}
          value={(value as string | undefined) ?? ''}
          disabled={disabled}
          onSave={(next) => onChange(next || null)}
        />
      );
    case 'datetime':
      return (
        <InlineInput
          type="datetime-local"
          aria-label={label}
          value={value ? toLocalInput(value as string) : ''}
          disabled={disabled}
          onSave={(next) => onChange(next ? new Date(next).toISOString() : null)}
        />
      );
    case 'checkbox':
      return (
        <label className="flex h-[var(--control-sm)] items-center gap-2 px-1.5">
          <input
            type="checkbox"
            checked={value === true}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span className="sr-only">{label}</span>
          <span className="text-[var(--ink-muted)]">
            {value === true ? t('common.yes') : t('common.no')}
          </span>
        </label>
      );
    case 'select': {
      const current = value as Option | undefined;
      return (
        <select
          aria-label={label}
          value={current?.id ?? ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value || null)}
          className={inputClass}
        >
          <option value="">{t('issues.none')}</option>
          {/* An archived option stays visible while it is set. */}
          {current && !usable.some((option) => option.id === current.id) && (
            <option value={current.id}>{current.value}</option>
          )}
          {usable.map((option) => (
            <option key={option.id} value={option.id}>
              {option.value}
            </option>
          ))}
        </select>
      );
    }
    case 'multiselect': {
      const current = (value as Option[] | undefined) ?? [];
      const chosen = new Set(current.map((option) => option.id));
      const toggle = (id: string) => {
        const next = new Set(chosen);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onChange([...next]);
      };
      const listed = [
        ...current.filter((option) => !usable.some((entry) => entry.id === option.id)),
        ...usable,
      ];
      return (
        <Popover
          label={label}
          triggerLabel={label}
          disabled={disabled}
          triggerClassName="flex min-h-[var(--control-sm)] w-full flex-wrap items-center gap-1 rounded-[var(--radius-md)] border border-transparent px-1.5 py-0.5 text-left hover:border-[var(--border-strong)] disabled:hover:border-transparent"
          trigger={
            current.length === 0 ? (
              <span className="text-[var(--ink-muted)]">{t('issues.none')}</span>
            ) : (
              current.map((option) => (
                <span
                  key={option.id}
                  className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-1.5 text-xs font-semibold"
                >
                  {option.value}
                </span>
              ))
            )
          }
        >
          <div className="flex flex-col gap-0.5 overflow-y-auto p-1">
            {listed.map((option) => (
              <CheckRow
                key={option.id}
                checked={chosen.has(option.id)}
                onChange={() => toggle(option.id)}
              >
                {option.value}
              </CheckRow>
            ))}
          </div>
        </Popover>
      );
    }
    case 'user': {
      const person = value as UserRef | undefined;
      return (
        <>
          <button
            type="button"
            disabled={disabled}
            aria-label={`${label}: ${person?.displayName ?? t('issues.none')}`}
            onClick={() => setPicking(true)}
            className={`${inputClass} flex items-center gap-2 text-left`}
          >
            {person ? (
              <>
                <Avatar user={person} size={20} />
                <span className="truncate">{person.displayName}</span>
              </>
            ) : (
              <span className="text-[var(--ink-muted)]">{t('issues.none')}</span>
            )}
          </button>
          {picking && me && (
            <UserPicker
              open
              onOpenChange={setPicking}
              me={{ id: me.id, displayName: me.displayName }}
              projectKey={projectKey}
              onPick={(user) => onChange(user?.id ?? null, user ?? null)}
            />
          )}
        </>
      );
    }
    case 'users': {
      const people = (value as UserRef[] | undefined) ?? [];
      const write = (next: UserRef[]) =>
        onChange(next.length > 0 ? next.map((person) => person.id) : null, next);
      return (
        <div className="flex min-h-[var(--control-sm)] flex-wrap items-center gap-1 px-1.5">
          {people.map((person) => (
            <span
              key={person.id}
              className="flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--surface-2)] py-0.5 pr-1 pl-0.5 text-xs"
            >
              <Avatar user={person} size={16} />
              {person.displayName}
              {!disabled && (
                <button
                  type="button"
                  aria-label={t('fields.removePerson', { name: person.displayName })}
                  onClick={() => write(people.filter((entry) => entry.id !== person.id))}
                  className="cursor-pointer border-0 bg-transparent p-0 text-[var(--ink-muted)]"
                >
                  ×
                </button>
              )}
            </span>
          ))}
          {!disabled && (
            <button
              type="button"
              aria-label={t('fields.addPerson', { name: label })}
              onClick={() => setPicking(true)}
              className="cursor-pointer rounded-[var(--radius-sm)] border-0 bg-transparent px-1 text-xs text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
            >
              + {people.length === 0 ? t('issues.none') : ''}
            </button>
          )}
          {picking && me && (
            <UserPicker
              open
              onOpenChange={setPicking}
              me={{ id: me.id, displayName: me.displayName }}
              projectKey={projectKey}
              onPick={(user) => {
                if (user && !people.some((entry) => entry.id === user.id)) {
                  write([...people, { id: user.id, displayName: user.displayName }]);
                }
              }}
            />
          )}
        </div>
      );
    }
    case 'group':
    case 'version': {
      const current = value as { id: string; displayName?: string; value?: string } | undefined;
      const choices =
        field.type === 'group'
          ? (groups.data ?? []).map((group) => ({ id: group.id, name: group.name }))
          : (versions.data ?? [])
              .filter((version) => !version.archived || version.id === current?.id)
              .map((version) => ({ id: version.id, name: version.name }));
      const name = current?.displayName ?? current?.value;
      return (
        <select
          aria-label={label}
          value={current?.id ?? ''}
          disabled={disabled}
          onChange={(event) => {
            const chosen = choices.find((choice) => choice.id === event.target.value);
            onChange(
              chosen?.id ?? null,
              !chosen
                ? null
                : field.type === 'group'
                  ? { id: chosen.id, displayName: chosen.name }
                  : { id: chosen.id, value: chosen.name },
            );
          }}
          className={inputClass}
        >
          <option value="">{t('issues.none')}</option>
          {current && name && !choices.some((choice) => choice.id === current.id) && (
            <option value={current.id}>{name}</option>
          )}
          {choices.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.name}
            </option>
          ))}
        </select>
      );
    }
    case 'cascade': {
      // Two selects: the first level, then its children (TL-82, E-92).
      const current = value as Option | undefined;
      const [parentName] = (current?.value ?? '').split(' › ');
      const parents = usable.filter((option) => !option.value.includes(' › '));
      const parent = field.options.find((option) => option.value === parentName);
      const children = parent
        ? usable.filter((option) => option.value.startsWith(`${parent.value} › `))
        : [];
      return (
        <div className="flex gap-1">
          <select
            aria-label={label}
            value={parent?.id ?? ''}
            disabled={disabled}
            onChange={(event) => {
              const chosen = field.options.find((option) => option.id === event.target.value);
              onChange(chosen?.id ?? null, chosen ?? null);
            }}
            className={inputClass}
          >
            <option value="">{t('issues.none')}</option>
            {parent && !parents.includes(parent) && (
              <option value={parent.id}>{parent.value}</option>
            )}
            {parents.map((option) => (
              <option key={option.id} value={option.id}>
                {option.value}
              </option>
            ))}
          </select>
          {parent && (children.length > 0 || current?.id !== parent.id) && (
            <select
              aria-label={t('fields.cascadeChild', { name: label })}
              value={current?.id !== parent.id ? (current?.id ?? '') : ''}
              disabled={disabled}
              onChange={(event) => {
                const chosen =
                  field.options.find((option) => option.id === event.target.value) ?? parent;
                onChange(chosen.id, chosen);
              }}
              className={inputClass}
            >
              <option value="">{t('issues.none')}</option>
              {current &&
                current.id !== parent.id &&
                !children.some((c) => c.id === current.id) && (
                  <option value={current.id}>{current.value.split(' › ')[1]}</option>
                )}
              {children.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.value.split(' › ')[1]}
                </option>
              ))}
            </select>
          )}
        </div>
      );
    }
    case 'labels': {
      const labels = (value as string[] | undefined) ?? [];
      return (
        <InlineInput
          aria-label={label}
          value={labels.join(' ')}
          disabled={disabled}
          placeholder={t('issues.none')}
          onSave={(next) => {
            const list = [...new Set(next.split(/\s+/).filter(Boolean))];
            onChange(list.length > 0 ? list : null, list.length > 0 ? list : null);
          }}
        />
      );
    }
  }
}

/** What an input shows before the server answers, e.g. in a form not yet sent (TL-12). */
export function shownValue(
  field: CustomField,
  input: CustomFieldInput | undefined,
  shown?: CustomFieldValue | null,
): CustomFieldValue | undefined {
  if (input === null || input === undefined) return undefined;
  if (shown) return shown;
  if (field.type === 'select' || field.type === 'cascade') {
    return field.options.find((option) => option.id === input);
  }
  if (field.type === 'multiselect' && Array.isArray(input)) {
    return field.options.filter((option) => input.includes(option.id));
  }
  if (field.type === 'user' || field.type === 'users') return undefined;
  return input as CustomFieldValue;
}

/** The custom fields a project uses, as rows of the issue's field list. */
export function CustomFieldRows({
  issue,
  fieldIds,
  settings = [],
  disabled,
  onChange,
}: {
  issue: Issue;
  fieldIds: string[];
  /** The project's configuration: help text and required marks (TL-12, E-89). */
  settings?: ProjectFieldConfig[];
  disabled: boolean;
  onChange: (fieldId: string, value: CustomFieldInput) => void;
}) {
  const { t } = useTranslation();
  const fields = useQuery(trackingMetaQuery).data?.customFields ?? [];
  // A field whose context leaves out this issue type is not shown (TL-80, E-91).
  const shown = fieldIds.filter((id) => {
    const setting = settings.find((entry) => entry.fieldId === id);
    return !setting?.issueTypeIds.length || setting.issueTypeIds.includes(issue.issueType.id);
  });
  const tabs = fieldTabs(shown, settings, t('fields.moreTab'));
  const [chosen, setChosen] = useState(0);
  const active = tabs[Math.min(chosen, tabs.length - 1)];
  const rows = active?.fieldIds.flatMap((id) => {
    const field = fields.find((entry) => entry.id === id);
    if (!field || field.archived) return [];
    const setting = settings.find((entry) => entry.fieldId === id);
    return [
      <div key={id} className="contents">
        <dt
          className="pt-1.5 text-[13px] text-[var(--ink-muted)]"
          title={setting?.description || field.description || undefined}
        >
          {field.name}
          {setting?.required && <span aria-hidden> *</span>}
        </dt>
        <dd className="m-0 min-w-0">
          <FieldEditor
            field={field}
            value={issue.customFields[id]}
            projectKey={issue.project.key}
            disabled={disabled}
            offered={setting?.optionIds}
            onChange={(value) => onChange(id, value)}
          />
        </dd>
      </div>,
    ];
  });
  if (tabs.length < 2) return rows;
  return (
    <>
      <div role="tablist" className="col-span-2 mt-2 flex gap-1 border-b border-[var(--border)]">
        {tabs.map((tab, index) => (
          <button
            key={tab.name}
            type="button"
            role="tab"
            aria-selected={tab === active}
            onClick={() => setChosen(index)}
            className="-mb-px cursor-pointer border-0 border-b-2 border-transparent bg-transparent px-2 py-1 text-[13px] text-[var(--ink-muted)] aria-selected:border-[var(--accent)] aria-selected:font-medium aria-selected:text-[var(--ink)]"
          >
            {tab.name}
          </button>
        ))}
      </div>
      {rows}
    </>
  );
}

/**
 * The project's fields grouped into tabs (TL-81, E-93): tabs in the order of their first field,
 * fields without a tab last under `more`. Without any tabs, one group with no name.
 */
export function fieldTabs(
  fieldIds: string[],
  settings: ProjectFieldConfig[],
  more: string,
): Array<{ name: string; fieldIds: string[] }> {
  const tabOf = (id: string) => settings.find((entry) => entry.fieldId === id)?.tab || null;
  if (!fieldIds.some((id) => tabOf(id))) return [{ name: '', fieldIds }];
  const tabs: Array<{ name: string; fieldIds: string[] }> = [];
  for (const id of fieldIds) {
    const name = tabOf(id) ?? more;
    const tab = tabs.find((entry) => entry.name === name);
    if (tab) tab.fieldIds.push(id);
    else tabs.push({ name, fieldIds: [id] });
  }
  // "Weitere" comes last, whatever the order.
  return tabs.sort((a, b) => Number(a.name === more) - Number(b.name === more));
}
