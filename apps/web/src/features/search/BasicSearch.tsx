import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import {
  BASIC_FIELDS,
  type BasicField,
  type BasicQuery,
  CURRENT_USER,
  emptyBasicQuery,
  findField,
  NO_VALUE,
} from '@tasklore/tql';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { valueSuggestionsQuery } from '../../lib/search';
import { Button } from '../../ui/Button';
import { CheckRow, Popover } from '../../ui/Popover';
import { useMetaName } from '../tracking/icons';
import { META_KIND, useDebounced } from './TqlInput';

interface Option {
  value: string;
  label: string;
  detail?: string;
}

/** Stored values of a field, labelled in the UI language; the assignee adds "me" and "nobody". */
function useOptions(field: BasicField, prefix: string, enabled: boolean): Option[] {
  const { t } = useTranslation();
  const metaName = useMetaName();
  const values = useQuery({ ...valueSuggestionsQuery(field, prefix, 50), enabled });
  const kind = META_KIND[findField(field)?.type ?? 'text'];
  const options: Option[] = (values.data ?? []).map((entry) => ({
    value: entry.value,
    label: kind && entry.key ? metaName(kind, { key: entry.key, name: entry.label }) : entry.label,
    detail: entry.detail,
  }));
  if (field !== 'assignee') return options;
  const lower = prefix.toLowerCase();
  const special = [
    { value: CURRENT_USER, label: t('search.basic.me') },
    { value: NO_VALUE, label: t('search.basic.unassigned') },
  ].filter((option) => option.label.toLowerCase().includes(lower));
  return [...special, ...options];
}

/** TQL compares stored names without case (E-35). */
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function FieldFilter({
  field,
  values,
  onChange,
}: {
  field: BasicField;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const { t } = useTranslation();
  const [prefix, setPrefix] = useState('');
  const debounced = useDebounced(prefix, 150);
  // Loaded while values are set, so the button can name them.
  const options = useOptions(field, debounced, true);
  const labelOf = (value: string) =>
    options.find((option) => same(option.value, value))?.label ?? value;
  const chosen = (value: string) => values.some((entry) => same(entry, value));
  const name = t(`search.basic.fields.${field}`);
  // Chosen values stay listed even when the search text hides them.
  const listed: Option[] = [
    ...values
      .filter((value) => !options.some((option) => same(option.value, value)))
      .map((value) => ({ value, label: value })),
    ...options,
  ];

  function toggle(value: string) {
    if (chosen(value)) onChange(values.filter((entry) => !same(entry, value)));
    else if (value === NO_VALUE) onChange([NO_VALUE]);
    else onChange([...values.filter((entry) => entry !== NO_VALUE), value]);
  }

  const summary =
    values.length === 0
      ? t('search.basic.any')
      : values.length === 1
        ? labelOf(values[0] as string)
        : t('search.basic.several', {
            first: labelOf(values[0] as string),
            count: values.length - 1,
          });

  return (
    <Popover
      label={name}
      active={values.length > 0}
      trigger={
        <>
          <span className="shrink-0">{name}:</span>
          <span className="truncate font-semibold">{summary}</span>
          <CaretDown size={12} aria-hidden className="shrink-0" />
        </>
      }
    >
      <div className="border-b border-[var(--border)] p-1.5">
        <input
          type="search"
          aria-label={t('search.basic.find', { field: name })}
          placeholder={t('search.basic.find', { field: name })}
          value={prefix}
          onChange={(event) => setPrefix(event.target.value)}
          className="h-[var(--control-sm)] w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2"
        />
      </div>
      <div className="flex flex-col gap-0.5 overflow-y-auto p-1">
        {listed.length === 0 && (
          <p className="m-0 px-2 py-1.5 text-[var(--ink-muted)]">{t('search.basic.noValues')}</p>
        )}
        {listed.map((option) => (
          <CheckRow
            key={option.value}
            checked={chosen(option.value)}
            onChange={() => toggle(option.value)}
            detail={option.detail}
          >
            {option.label}
          </CheckRow>
        ))}
      </div>
      {values.length > 0 && (
        <div className="border-t border-[var(--border)] p-1">
          <Button size="sm" variant="ghost" onClick={() => onChange([])}>
            {t('search.basic.clearField')}
          </Button>
        </div>
      )}
    </Popover>
  );
}

/** Click filters that stand for a simple TQL query (T-QRY-05, E-48). */
export function BasicSearch({
  value,
  onChange,
}: {
  value: BasicQuery;
  onChange: (value: BasicQuery) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(value.text);
  useEffect(() => setText(value.text), [value.text]);
  const commitText = () => {
    if (text.trim() !== value.text) onChange({ ...value, text: text.trim() });
  };
  const filtered = text.trim() !== '' || BASIC_FIELDS.some((field) => value.values[field].length);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex h-[var(--control-sm)] min-w-56 flex-1 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 focus-within:border-[var(--accent)] sm:max-w-80">
        <MagnifyingGlass size={14} aria-hidden className="shrink-0 text-[var(--ink-muted)]" />
        <input
          type="search"
          aria-label={t('search.basic.text')}
          placeholder={t('search.basic.text')}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={commitText}
          onKeyDown={(event) => event.key === 'Enter' && commitText()}
          className="min-w-0 flex-1 bg-transparent outline-none"
        />
      </label>
      {BASIC_FIELDS.map((field) => (
        <FieldFilter
          key={field}
          field={field}
          values={value.values[field]}
          onChange={(values) =>
            onChange({ ...value, values: { ...value.values, [field]: values } })
          }
        />
      ))}
      {filtered && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onChange({ ...emptyBasicQuery(), orderBy: value.orderBy })}
        >
          {t('search.basic.reset')}
        </Button>
      )}
    </div>
  );
}
