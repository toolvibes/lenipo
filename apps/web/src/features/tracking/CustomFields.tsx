import { ArrowSquareOut } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import type {
  CustomField,
  CustomFieldInput,
  CustomFieldValue,
  Issue,
  UserRef,
} from '@tasklore/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { meQuery } from '../../lib/queries';
import { trackingMetaQuery } from '../../lib/tracking';
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

/** One custom field of an issue with the editor its type needs (T-FLD-01, E-50). */
function FieldEditor({
  field,
  value,
  projectKey,
  disabled,
  onChange,
}: {
  field: CustomField;
  value: CustomFieldValue | undefined;
  projectKey: string;
  disabled: boolean;
  onChange: (value: CustomFieldInput) => void;
}) {
  const { t } = useTranslation();
  const me = useQuery(meQuery).data;
  const [picking, setPicking] = useState(false);
  const usable = field.options.filter((option) => !option.archived);
  const label = field.name;

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
              onPick={(user) => onChange(user?.id ?? null)}
            />
          )}
        </>
      );
    }
  }
}

/** The custom fields a project uses, as rows of the issue's field list. */
export function CustomFieldRows({
  issue,
  fieldIds,
  disabled,
  onChange,
}: {
  issue: Issue;
  fieldIds: string[];
  disabled: boolean;
  onChange: (fieldId: string, value: CustomFieldInput) => void;
}) {
  const fields = useQuery(trackingMetaQuery).data?.customFields ?? [];
  return fieldIds.flatMap((id) => {
    const field = fields.find((entry) => entry.id === id);
    if (!field || field.archived) return [];
    return [
      <div key={id} className="contents">
        <dt
          className="pt-1.5 text-[13px] text-[var(--ink-muted)]"
          title={field.description || undefined}
        >
          {field.name}
        </dt>
        <dd className="m-0 min-w-0">
          <FieldEditor
            field={field}
            value={issue.customFields[id]}
            projectKey={issue.project.key}
            disabled={disabled}
            onChange={(value) => onChange(id, value)}
          />
        </dd>
      </div>,
    ];
  });
}
