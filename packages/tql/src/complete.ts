import { FIELDS, type FieldDef, functionsFor, type Operator } from './fields.js';
import { type Token, tokenize } from './lexer.js';
import { type Expectation, expectationsAt } from './parser.js';

export interface CompletionContext {
  /** Range of the partly typed word that a suggestion replaces (from === to if none). */
  from: number;
  to: number;
  /** What has been typed of that word so far, unquoted. */
  prefix: string;
  expectations: Expectation[];
  /** Set when a value is expected: the client fetches stored values for this field. */
  value?: { field: FieldDef; operator: Operator };
}

export type SuggestionKind =
  | 'field'
  | 'operator'
  | 'keyword'
  | 'function'
  | 'punctuation'
  | 'value';

export interface Suggestion {
  kind: SuggestionKind;
  label: string;
  /** Text that replaces the range from..to. */
  insert: string;
  detail?: string;
}

const RESERVED = new Set([
  'and',
  'or',
  'not',
  'in',
  'is',
  'empty',
  'null',
  'order',
  'by',
  'asc',
  'desc',
]);
const PLAIN_WORD = /^[^\s"'(),=!<>~]+$/;

/** Quotes a value when it would otherwise not parse as one word. */
export function quoteValue(value: string): string {
  if (
    PLAIN_WORD.test(value) &&
    !RESERVED.has(value.toLowerCase()) &&
    !value.includes('&&') &&
    !value.includes('||')
  ) {
    return value;
  }
  return `"${value.replace(/["\\]/g, (char) => `\\${char}`)}"`;
}

/** Finds the word at the cursor and what the grammar allows there. */
export function completionContext(text: string, cursor: number): CompletionContext {
  const tokens = tokenize(text);
  const partial = tokens.find(
    (token) =>
      (token.kind === 'word' || token.kind === 'string') &&
      token.start < cursor &&
      cursor <= token.end,
  );
  const before: Token[] = tokens.filter(
    (token) => token.kind !== 'eof' && token.end <= (partial?.start ?? cursor),
  );
  before.push({ kind: 'eof', text: '', value: '', start: cursor, end: cursor });

  let prefix = '';
  if (partial?.kind === 'word') prefix = text.slice(partial.start, cursor);
  else if (partial?.kind === 'string') prefix = partial.value.slice(0, cursor - partial.start - 1);

  const expectations = dedupe(expectationsAt(before));
  const valueExpectation = expectations.find((entry) => entry.type === 'value');
  return {
    from: partial?.start ?? cursor,
    to: partial?.end ?? cursor,
    prefix,
    expectations,
    ...(valueExpectation
      ? { value: { field: valueExpectation.field, operator: valueExpectation.operator } }
      : {}),
  };
}

function dedupe(expectations: Expectation[]): Expectation[] {
  const seen = new Set<string>();
  return expectations.filter((entry) => {
    const key = JSON.stringify(entry, (name, value) => (name === 'field' ? value.id : value));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matches(candidate: string, prefix: string): boolean {
  return candidate.toLowerCase().startsWith(prefix.toLowerCase());
}

/**
 * Suggestions that follow from the grammar alone: fields, operators, keywords, functions and
 * punctuation. Stored values (statuses, people, …) come from the API for `context.value`.
 */
export function staticSuggestions(context: CompletionContext): Suggestion[] {
  const { prefix } = context;
  const suggestions: Suggestion[] = [];
  for (const expectation of context.expectations) {
    switch (expectation.type) {
      case 'field':
        for (const field of FIELDS) {
          const usable = expectation.orderBy ? field.orderable : field.operators.length > 0;
          const names = [field.id, ...field.aliases];
          if (usable && names.some((name) => matches(name, prefix))) {
            suggestions.push({
              kind: 'field',
              label: field.id,
              insert: field.id,
            });
          }
        }
        break;
      case 'operator':
        for (const operator of expectation.field.operators) {
          if (matches(operator, prefix)) {
            // Word operators are written in upper case like the other keywords.
            const insert = /^[a-z]/.test(operator) ? operator.toUpperCase() : operator;
            suggestions.push({ kind: 'operator', label: insert, insert });
          }
        }
        break;
      case 'value':
        for (const fn of functionsFor(expectation.field, expectation.operator)) {
          if (matches(fn.name, prefix)) {
            const call = fn.maxArgs === 0 ? `${fn.name}()` : `${fn.name}(`;
            suggestions.push({ kind: 'function', label: `${fn.name}()`, insert: call });
          }
        }
        break;
      case 'keyword':
        if (matches(expectation.keyword, prefix)) {
          suggestions.push({
            kind: 'keyword',
            label: expectation.keyword,
            insert: expectation.keyword,
          });
        }
        break;
      case 'punctuation':
        if (prefix === '') {
          suggestions.push({
            kind: 'punctuation',
            label: expectation.text,
            insert: expectation.text,
          });
        }
        break;
      case 'argument':
        break;
    }
  }
  return suggestions;
}

/** Replaces the completed range and puts the cursor behind the insertion (plus a space). */
export function applySuggestion(
  text: string,
  context: CompletionContext,
  insert: string,
): { text: string; cursor: number } {
  const opensCall = insert.endsWith('(');
  const after = text.slice(context.to);
  const spacer = opensCall || after.startsWith(' ') ? '' : ' ';
  const result = `${text.slice(0, context.from)}${insert}${spacer}${after}`;
  const cursor = context.from + insert.length + (opensCall ? 0 : 1);
  return { text: result, cursor: Math.min(cursor, result.length) };
}
