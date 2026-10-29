import { useQuery } from '@tanstack/react-query';
import type { QueryError } from '@tasklore/shared';
import {
  applySuggestion,
  type CompletionContext,
  completionContext,
  type FieldType,
  quoteValue,
  type Suggestion,
  staticSuggestions,
} from '@tasklore/tql';
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { valueSuggestionsQuery } from '../../lib/search';
import { useMetaName } from '../tracking/icons';

export const META_KIND: Partial<
  Record<FieldType, 'issueType' | 'status' | 'priority' | 'resolution'>
> = {
  'issue-type': 'issueType',
  status: 'status',
  priority: 'priority',
  resolution: 'resolution',
};

export function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Stored values for the field at the cursor, labelled in the UI language. */
function useValueSuggestions(context: CompletionContext | null, enabled: boolean): Suggestion[] {
  const { t } = useTranslation();
  const metaName = useMetaName();
  const field = context?.value?.field;
  const prefix = useDebounced(context?.prefix ?? '', 150);
  const values = useQuery({
    ...valueSuggestionsQuery(field?.id ?? '', prefix),
    enabled: enabled && !!field,
  });
  if (!field || !values.data) return [];
  const kind = META_KIND[field.type];
  // The list may still belong to a shorter prefix while the next request runs.
  const typed = (context?.prefix ?? '').toLowerCase();
  const current = values.data.filter((entry) =>
    [entry.value, entry.label, entry.detail ?? ''].some((text) =>
      text.toLowerCase().includes(typed),
    ),
  );
  return current.map((entry) => {
    let label = entry.label;
    if (kind && entry.key) label = metaName(kind, { key: entry.key, name: entry.label });
    else if (field.type === 'status-category' && entry.key) {
      label = t(`search.category.${entry.key}` as never);
    }
    return { kind: 'value', label, insert: quoteValue(entry.value), detail: entry.detail };
  });
}

interface TqlInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  errors: QueryError[];
  errorId: string;
}

/**
 * TQL editor as a combobox (ARIA 1.2): suggestions come from the shared grammar (fields,
 * operators, keywords, functions) and from the API (stored values) for the word at the cursor.
 */
export function TqlInput({ id, value, onChange, onSubmit, errors, errorId }: TqlInputProps) {
  const { t } = useTranslation();
  const listId = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState(value.length);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  /** Enter accepts a suggestion once one was picked with the arrow keys or a word is typed. */
  const [picked, setPicked] = useState(false);
  const pendingCursor = useRef<number | null>(null);

  const context = useMemo(
    () => (open ? completionContext(value, Math.min(cursor, value.length)) : null),
    [open, value, cursor],
  );
  const values = useValueSuggestions(context, open);
  const suggestions = useMemo(() => {
    if (!context) return [];
    const grammar = staticSuggestions(context);
    // Stored values first, then functions and keywords; an exact match adds nothing.
    return [...values, ...grammar].filter((entry) => entry.insert !== context.prefix).slice(0, 30);
  }, [context, values]);
  const visible = open && suggestions.length > 0;

  // A new list of suggestions starts at its first entry.
  const listKey = `${context?.from}:${suggestions.length}`;
  const [activeList, setActiveList] = useState(listKey);
  if (activeList !== listKey) {
    setActiveList(listKey);
    setActive(0);
    setPicked(false);
  }

  // Put the cursor behind an accepted suggestion once the new value has rendered.
  useEffect(() => {
    if (pendingCursor.current === null || !textarea.current) return;
    textarea.current.setSelectionRange(pendingCursor.current, pendingCursor.current);
    setCursor(pendingCursor.current);
    pendingCursor.current = null;
  });

  function syncCursor() {
    setCursor(textarea.current?.selectionStart ?? value.length);
  }

  function accept(suggestion: Suggestion) {
    if (!context) return;
    const result = applySuggestion(value, context, suggestion.insert);
    pendingCursor.current = result.cursor;
    onChange(result.text);
    setOpen(true);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === ' ' && event.ctrlKey) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (visible && event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % suggestions.length);
      setPicked(true);
    } else if (visible && event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index - 1 + suggestions.length) % suggestions.length);
      setPicked(true);
    } else if (visible && (event.key === 'Tab' || event.key === 'Enter') && !event.shiftKey) {
      const suggestion = suggestions[active];
      if (suggestion && (event.key === 'Tab' || picked || context?.prefix)) {
        event.preventDefault();
        accept(suggestion);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        setOpen(false);
        onSubmit();
      }
    } else if (event.key === 'Escape' && visible) {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      setOpen(false);
      onSubmit();
    }
  }

  const activeId = visible ? `${listId}-${active}` : undefined;

  return (
    <div className="relative">
      <textarea
        id={id}
        ref={textarea}
        role="combobox"
        aria-label={t('search.queryLabel')}
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-invalid={errors.length > 0}
        aria-describedby={errors.length > 0 ? errorId : undefined}
        value={value}
        rows={2}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder={t('search.placeholder')}
        onChange={(event) => {
          onChange(event.target.value);
          setCursor(event.target.selectionStart);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onKeyUp={(event) => {
          if (event.key.startsWith('Arrow') && !visible) syncCursor();
          if (event.key === 'Home' || event.key === 'End') syncCursor();
        }}
        onClick={syncCursor}
        onFocus={syncCursor}
        onBlur={() => setOpen(false)}
        className={`block min-h-[64px] w-full resize-y rounded-[var(--radius-md)] border bg-[var(--surface-1)] px-3 py-2 font-[family-name:var(--font-mono)] text-sm leading-6 text-[var(--ink)] outline-none focus:border-[var(--accent)] ${
          errors.length > 0 ? 'border-[var(--danger)]' : 'border-[var(--border-strong)]'
        }`}
      />
      <div
        id={listId}
        role="listbox"
        aria-label={t('search.suggestions')}
        hidden={!visible}
        className="absolute top-full left-0 z-20 mt-1 max-h-72 w-full max-w-md overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-1 shadow-[var(--shadow-float)]"
      >
        {visible &&
          suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.kind}:${suggestion.insert}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              tabIndex={-1}
              // Keep the focus in the textarea, so typing continues after a click.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => accept(suggestion)}
              onKeyDown={() => {}}
              className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] px-2 py-1 ${
                index === active ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : ''
              }`}
            >
              <span className="min-w-0 flex-1 truncate">
                <span
                  className={
                    suggestion.kind === 'value' ? '' : 'font-[family-name:var(--font-mono)]'
                  }
                >
                  {suggestion.label}
                </span>
                {suggestion.detail && (
                  <span className="ml-2 text-xs text-[var(--ink-muted)]">{suggestion.detail}</span>
                )}
              </span>
              <span className="text-xs text-[var(--ink-muted)]">
                {t(`search.kinds.${suggestion.kind}` as never)}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
