import { useQuery } from '@tanstack/react-query';
import type { QueryError } from '@toolvibes/shared';
import {
  applySuggestion,
  type CompletionContext,
  completionContext,
  type FieldType,
  QUERY_TEMPLATES,
  quoteValue,
  type Suggestion,
  staticSuggestions,
} from '@toolvibes/tql';
import {
  type KeyboardEvent,
  type Ref,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { valueSuggestionsQuery } from '../../lib/search';
import { useFieldCatalogue } from '../../lib/tracking';
import { useMetaName } from '../tracking/icons';
import { recentQueries } from './recentQueries';

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

/** A whole query to search at once: a template or one of the last searches. */
interface QuickEntry {
  kind: 'template' | 'recent';
  label: string;
  insert: string;
  detail?: string;
}
type Entry = Suggestion | QuickEntry;

const isQuick = (entry: Entry): entry is QuickEntry =>
  entry.kind === 'template' || entry.kind === 'recent';

/** What the empty field (or "/" and a word) offers: the last searches, then the templates. */
function useQuickEntries(term: string | null): QuickEntry[] {
  const { t } = useTranslation();
  return useMemo(() => {
    if (term === null) return [];
    const templates = QUERY_TEMPLATES.map(
      (template): QuickEntry => ({
        kind: 'template',
        label: t(`search.presets.${template.id}`),
        insert: template.query,
        detail: template.query,
      }),
    );
    const known = new Set(templates.map((entry) => entry.insert));
    const recent = recentQueries()
      .filter((query) => !known.has(query))
      .map((query): QuickEntry => ({ kind: 'recent', label: query, insert: query }));
    const wanted = term.toLocaleLowerCase();
    return [...recent, ...templates].filter((entry) =>
      [entry.label, entry.insert].some((text) => text.toLocaleLowerCase().includes(wanted)),
    );
  }, [term, t]);
}

/** One line of explanation for a field, operator, keyword or function. */
function useDescribe() {
  const { t } = useTranslation();
  return (suggestion: Suggestion): string | undefined => {
    if (suggestion.detail) return suggestion.detail;
    const help = (group: string, key: string) =>
      t(`search.help.${group}.${key}` as never, { defaultValue: '' }) || undefined;
    switch (suggestion.kind) {
      case 'field':
        return help('fields', suggestion.insert);
      case 'operator':
        return help('operators', suggestion.insert);
      case 'keyword':
        return help('keywords', suggestion.insert);
      case 'function':
        return help('functions', suggestion.label.replace('()', ''));
      default:
        return undefined;
    }
  };
}

/** The part of the query an empty field or a "/word" asks templates for; null otherwise. */
function quickTerm(value: string): string | null {
  const text = value.trim();
  if (text === '') return '';
  return /^\/(\S*)$/.exec(text)?.[1] ?? null;
}

export interface TqlInputHandle {
  /** Inserts a building block at the cursor; "|" marks where the cursor goes. */
  insert(snippet: string): void;
}

interface TqlInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** Searches a whole query picked from the quick selection. */
  onRun: (query: string) => void;
  errors: QueryError[];
  errorId: string;
  ref?: Ref<TqlInputHandle>;
}

/**
 * TQL editor as a combobox (ARIA 1.2): suggestions come from the shared grammar (fields,
 * operators, keywords, functions) and from the API (stored values) for the word at the cursor,
 * each with a short explanation. The empty field offers templates and the last searches.
 */
export function TqlInput({
  id,
  value,
  onChange,
  onSubmit,
  onRun,
  errors,
  errorId,
  ref,
}: TqlInputProps) {
  const { t } = useTranslation();
  const listId = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState(value.length);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  /** Enter accepts a suggestion once one was picked with the arrow keys or a word is typed. */
  const [picked, setPicked] = useState(false);
  const pendingCursor = useRef<number | null>(null);
  const describe = useDescribe();

  const catalogue = useFieldCatalogue();
  const term = open ? quickTerm(value) : null;
  const quick = useQuickEntries(term);
  const context = useMemo(
    () =>
      open && term === null
        ? completionContext(value, Math.min(cursor, value.length), catalogue)
        : null,
    [open, term, value, cursor, catalogue],
  );
  const values = useValueSuggestions(context, open);
  const suggestions = useMemo((): Entry[] => {
    if (term !== null) return quick;
    if (!context) return [];
    const grammar = staticSuggestions(context, catalogue);
    // Stored values first, then functions and keywords; an exact match adds nothing.
    return [...values, ...grammar]
      .filter((entry) => entry.insert !== context.prefix)
      .slice(0, 30)
      .map((entry) => ({ ...entry, detail: describe(entry) }));
  }, [term, quick, context, values, catalogue, describe]);
  const visible = open && suggestions.length > 0;

  // A new list of suggestions starts at its first entry.
  const listKey = `${term ?? context?.from}:${suggestions.length}`;
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

  useImperativeHandle(
    ref,
    () => ({
      insert(snippet) {
        const element = textarea.current;
        const start = element?.selectionStart ?? value.length;
        const end = element?.selectionEnd ?? start;
        const mark = snippet.indexOf('|');
        const text = snippet.replace('|', '');
        const before = value.slice(0, start);
        const after = value.slice(end);
        const lead = before === '' || /[\s(]$/.test(before) ? '' : ' ';
        const trail = /^[\s)]/.test(after) || (after === '' && mark >= 0) ? '' : ' ';
        pendingCursor.current =
          before.length + lead.length + (mark >= 0 ? mark : text.length + trail.length);
        onChange(`${before}${lead}${text}${trail}${after}`);
        element?.focus();
        setOpen(true);
      },
    }),
    [value, onChange],
  );

  function syncCursor() {
    setCursor(textarea.current?.selectionStart ?? value.length);
  }

  function accept(entry: Entry) {
    if (isQuick(entry)) {
      pendingCursor.current = entry.insert.length;
      onChange(entry.insert);
      setOpen(false);
      onRun(entry.insert);
      return;
    }
    if (!context) return;
    const result = applySuggestion(value, context, entry.insert);
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
      if (suggestion && (event.key === 'Tab' || picked || context?.prefix || term)) {
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
  // Grey text on the tinted active row needs the darker grey to stay at 4.5:1.
  const muted = (index: number) =>
    index === active ? 'text-[var(--ink-soft)]' : 'text-[var(--ink-muted)]';

  return (
    // Ligatures would show >= as ≥: in a query language every character must read as typed.
    <div className="relative [font-variant-ligatures:none]">
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
        onClick={() => {
          syncCursor();
          // The empty field offers the templates on a click, too.
          if (value.trim() === '') setOpen(true);
        }}
        onFocus={() => {
          syncCursor();
          if (value.trim() === '') setOpen(true);
        }}
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
        className="absolute top-full left-0 z-20 mt-1 max-h-80 w-full max-w-xl overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-1 shadow-[var(--shadow-float)]"
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
                    suggestion.kind === 'value' || suggestion.kind === 'template'
                      ? ''
                      : 'font-[family-name:var(--font-mono)]'
                  }
                >
                  {suggestion.label}
                </span>
                {suggestion.detail && (
                  <span
                    className={`ml-2 text-xs ${muted(index)} ${
                      suggestion.kind === 'template' ? 'font-[family-name:var(--font-mono)]' : ''
                    }`}
                  >
                    {suggestion.detail}
                  </span>
                )}
              </span>
              <span className={`shrink-0 text-xs ${muted(index)}`}>
                {t(`search.kinds.${suggestion.kind}` as never)}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
