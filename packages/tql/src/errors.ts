/** Error codes; the web app translates them, the API sends them with an English message. */
export type TqlErrorCode =
  | 'unterminated-string'
  | 'unexpected-token'
  | 'expected-field'
  | 'expected-operator'
  | 'expected-value'
  | 'expected-list'
  | 'expected-empty'
  | 'expected-closing-paren'
  | 'expected-by'
  | 'unknown-field'
  | 'field-not-searchable'
  | 'field-not-orderable'
  | 'operator-not-supported'
  | 'unknown-function'
  | 'function-not-supported'
  | 'function-arguments'
  | 'invalid-increment'
  | 'invalid-number'
  | 'invalid-date'
  | 'invalid-issue-key'
  | 'invalid-duration'
  | 'invalid-boolean'
  // Reported by the API, which knows the stored values.
  | 'value-not-found'
  | 'no-search-terms'
  | 'semantic-unavailable';

export interface TqlError {
  code: TqlErrorCode;
  /** English description; clients may show a translation of the code instead. */
  message: string;
  /** Offending range in the query text. */
  start: number;
  end: number;
  params: Record<string, string>;
}

const MESSAGES: Record<TqlErrorCode, (params: Record<string, string>) => string> = {
  'unterminated-string': () => 'A quoted text is missing its closing quote.',
  'unexpected-token': (p) => `Unexpected "${p.token}".`,
  'expected-field': (p) =>
    p.token ? `Expected a field name instead of "${p.token}".` : 'Expected a field name.',
  'expected-operator': (p) =>
    p.token
      ? `Expected an operator after "${p.field}" instead of "${p.token}".`
      : `Expected an operator after "${p.field}".`,
  'expected-value': (p) =>
    p.token ? `Expected a value instead of "${p.token}".` : 'Expected a value.',
  'expected-list': (p) => `"${p.operator}" needs a list in parentheses, e.g. (A, B).`,
  'expected-empty': () => 'Expected EMPTY after IS or IS NOT.',
  'expected-closing-paren': () => 'A closing parenthesis is missing.',
  'expected-by': () => 'Expected BY after ORDER.',
  'unknown-field': (p) => `The field "${p.field}" does not exist.`,
  'field-not-searchable': (p) => `The field "${p.field}" can only be used in ORDER BY.`,
  'field-not-orderable': (p) => `Results cannot be ordered by "${p.field}".`,
  'operator-not-supported': (p) => `The operator "${p.operator}" cannot be used with "${p.field}".`,
  'unknown-function': (p) => `The function "${p.function}" does not exist.`,
  'function-not-supported': (p) =>
    `The function "${p.function}" cannot be used with "${p.field}" here.`,
  'function-arguments': (p) =>
    p.min === p.max
      ? `"${p.function}" takes ${p.min} argument(s).`
      : `"${p.function}" takes ${p.min} to ${p.max} arguments.`,
  'invalid-increment': (p) => `"${p.value}" is not a valid increment such as -1, +2d or 1w.`,
  'invalid-number': (p) => `"${p.value}" is not a number.`,
  'invalid-date': (p) =>
    `"${p.value}" is not a valid date. Use "yyyy-MM-dd", "yyyy-MM-dd HH:mm" or a period such as -7d.`,
  'invalid-issue-key': (p) => `"${p.value}" is not a valid issue key such as WEB-12.`,
  'invalid-duration': (p) => `"${p.value}" is not a duration such as 2h, 1d 4h or 30m.`,
  'invalid-boolean': (p) => `"${p.field}" is true or false, not "${p.value}".`,
  'value-not-found': (p) => `The value "${p.value}" does not exist for the field "${p.field}".`,
  'no-search-terms': (p) => `"${p.value}" contains no words to search for.`,
  'semantic-unavailable': () =>
    'Semantic search is not set up: it needs an embedding model and pgvector in the database.',
};

export function tqlError(
  code: TqlErrorCode,
  span: { start: number; end: number },
  params: Record<string, string> = {},
): TqlError {
  return { code, message: MESSAGES[code](params), start: span.start, end: span.end, params };
}
