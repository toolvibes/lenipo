export type Operator =
  | '='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | '~'
  | '!~'
  | 'in'
  | 'not in'
  | 'is'
  | 'is not';

/** What kind of values a field holds; decides operators, functions and value suggestions. */
export type FieldType =
  | 'project'
  | 'issue-type'
  | 'status'
  | 'status-category'
  | 'priority'
  | 'resolution'
  | 'user'
  | 'text'
  | 'label'
  | 'number'
  | 'date'
  | 'datetime'
  | 'issue';

export interface FieldDef {
  /** Canonical name, used in suggestions and by the SQL compiler. */
  id: string;
  /** Further accepted names (compared case-insensitively), e.g. Jira's names. */
  aliases: readonly string[];
  type: FieldType;
  /** Empty for fields that can only be sorted by (rank). */
  operators: readonly Operator[];
  orderable: boolean;
}

const EQUALITY: readonly Operator[] = ['=', '!=', 'in', 'not in'];
const EMPTINESS: readonly Operator[] = ['is', 'is not'];
const COMPARISON: readonly Operator[] = ['>', '>=', '<', '<='];
const TEXT: readonly Operator[] = ['~', '!~'];
const DATES: readonly Operator[] = ['=', '!=', ...COMPARISON];

export const FIELDS: readonly FieldDef[] = [
  { id: 'project', aliases: [], type: 'project', operators: EQUALITY, orderable: true },
  {
    id: 'issuetype',
    aliases: ['type'],
    type: 'issue-type',
    operators: EQUALITY,
    orderable: true,
  },
  { id: 'status', aliases: [], type: 'status', operators: EQUALITY, orderable: true },
  {
    id: 'statusCategory',
    aliases: ['category'],
    type: 'status-category',
    operators: EQUALITY,
    orderable: false,
  },
  { id: 'priority', aliases: [], type: 'priority', operators: EQUALITY, orderable: true },
  {
    id: 'resolution',
    aliases: [],
    type: 'resolution',
    operators: [...EQUALITY, ...EMPTINESS],
    orderable: true,
  },
  {
    id: 'assignee',
    aliases: [],
    type: 'user',
    operators: [...EQUALITY, ...EMPTINESS],
    orderable: true,
  },
  {
    id: 'reporter',
    aliases: [],
    type: 'user',
    operators: [...EQUALITY, ...EMPTINESS],
    orderable: true,
  },
  { id: 'watcher', aliases: [], type: 'user', operators: EQUALITY, orderable: false },
  { id: 'summary', aliases: [], type: 'text', operators: TEXT, orderable: true },
  {
    id: 'description',
    aliases: [],
    type: 'text',
    operators: [...TEXT, ...EMPTINESS],
    orderable: false,
  },
  { id: 'comment', aliases: [], type: 'text', operators: TEXT, orderable: false },
  { id: 'text', aliases: [], type: 'text', operators: TEXT, orderable: false },
  {
    id: 'labels',
    aliases: ['label'],
    type: 'label',
    operators: [...EQUALITY, ...EMPTINESS],
    orderable: false,
  },
  {
    id: 'storyPoints',
    aliases: ['story points'],
    type: 'number',
    operators: [...EQUALITY, ...COMPARISON, ...EMPTINESS],
    orderable: true,
  },
  {
    id: 'due',
    aliases: ['duedate'],
    type: 'date',
    operators: [...DATES, ...EMPTINESS],
    orderable: true,
  },
  { id: 'created', aliases: ['createddate'], type: 'datetime', operators: DATES, orderable: true },
  { id: 'updated', aliases: ['updateddate'], type: 'datetime', operators: DATES, orderable: true },
  {
    id: 'resolved',
    aliases: ['resolutiondate'],
    type: 'datetime',
    operators: [...DATES, ...EMPTINESS],
    orderable: true,
  },
  {
    id: 'key',
    aliases: ['issuekey', 'issue', 'id'],
    type: 'issue',
    operators: EQUALITY,
    orderable: true,
  },
  {
    id: 'parent',
    aliases: [],
    type: 'issue',
    operators: [...EQUALITY, ...EMPTINESS],
    orderable: false,
  },
  { id: 'rank', aliases: [], type: 'text', operators: [], orderable: true },
];

const FIELD_BY_NAME = new Map(
  FIELDS.flatMap((field) =>
    [field.id, ...field.aliases].map((name) => [name.toLowerCase(), field] as const),
  ),
);

export function findField(name: string): FieldDef | undefined {
  return FIELD_BY_NAME.get(name.toLowerCase());
}

/** Accepted values of `statusCategory`; the first name of each entry is canonical. */
export const STATUS_CATEGORY_NAMES: Readonly<Record<'todo' | 'in_progress' | 'done', string[]>> = {
  todo: ['todo', 'to do', 'new'],
  in_progress: ['in_progress', 'in progress', 'indeterminate'],
  done: ['done', 'complete'],
};

export type FunctionResult = 'user' | 'users' | 'datetime';

export interface FunctionDef {
  name: string;
  result: FunctionResult;
  minArgs: number;
  maxArgs: number;
  /** Unit used by an increment argument without its own unit, e.g. `startOfWeek(-1)`. */
  defaultUnit?: TimeUnit;
}

export const FUNCTIONS: readonly FunctionDef[] = [
  { name: 'currentUser', result: 'user', minArgs: 0, maxArgs: 0 },
  { name: 'membersOf', result: 'users', minArgs: 1, maxArgs: 1 },
  { name: 'now', result: 'datetime', minArgs: 0, maxArgs: 0 },
  { name: 'startOfDay', result: 'datetime', minArgs: 0, maxArgs: 1, defaultUnit: 'd' },
  { name: 'endOfDay', result: 'datetime', minArgs: 0, maxArgs: 1, defaultUnit: 'd' },
  { name: 'startOfWeek', result: 'datetime', minArgs: 0, maxArgs: 1, defaultUnit: 'w' },
  { name: 'endOfWeek', result: 'datetime', minArgs: 0, maxArgs: 1, defaultUnit: 'w' },
  { name: 'startOfMonth', result: 'datetime', minArgs: 0, maxArgs: 1, defaultUnit: 'M' },
  { name: 'endOfMonth', result: 'datetime', minArgs: 0, maxArgs: 1, defaultUnit: 'M' },
  { name: 'startOfYear', result: 'datetime', minArgs: 0, maxArgs: 1, defaultUnit: 'y' },
  { name: 'endOfYear', result: 'datetime', minArgs: 0, maxArgs: 1, defaultUnit: 'y' },
];

const FUNCTION_BY_NAME = new Map(FUNCTIONS.map((fn) => [fn.name.toLowerCase(), fn]));

export function findFunction(name: string): FunctionDef | undefined {
  return FUNCTION_BY_NAME.get(name.toLowerCase());
}

/** Functions usable as a value of this field with this operator. */
export function functionsFor(field: FieldDef, operator: Operator): FunctionDef[] {
  const list = operator === 'in' || operator === 'not in';
  return FUNCTIONS.filter((fn) => {
    if (fn.result === 'datetime') return field.type === 'date' || field.type === 'datetime';
    if (field.type !== 'user') return false;
    return fn.result === 'user' || list;
  });
}

// ---------------------------------------------------------------- dates

/** y = years, M = months, w = weeks, d = days, h = hours, m = minutes (as in JQL). */
export type TimeUnit = 'y' | 'M' | 'w' | 'd' | 'h' | 'm';

export interface Duration {
  amount: number;
  unit: TimeUnit;
}

export type DateValue =
  | { kind: 'absolute'; date: string; time?: string }
  | { kind: 'relative'; parts: Duration[] };

const ABSOLUTE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/;
const RELATIVE = /^([+-]?)((?:\d+[yMwdhm]\s*)+)$/;

function validDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/**
 * Parses `2026-10-28`, `2026/10/28 14:30` or a relative offset such as `-7d`, `2w` or `-1w 2d`
 * (the sign applies to every part). Returns undefined for anything else.
 */
export function parseDateValue(text: string): DateValue | undefined {
  const trimmed = text.trim();
  const absolute = ABSOLUTE.exec(trimmed);
  if (absolute) {
    const [, y, mo, d, h, mi] = absolute;
    const year = Number(y);
    const month = Number(mo);
    const day = Number(d);
    if (!validDate(year, month, day)) return undefined;
    const date = `${y}-${mo?.padStart(2, '0')}-${d?.padStart(2, '0')}`;
    if (h === undefined) return { kind: 'absolute', date };
    if (Number(h) > 23 || Number(mi) > 59) return undefined;
    return { kind: 'absolute', date, time: `${h.padStart(2, '0')}:${mi}` };
  }
  const relative = RELATIVE.exec(trimmed);
  if (relative) {
    const sign = relative[1] === '-' ? -1 : 1;
    const parts = [...(relative[2] ?? '').matchAll(/(\d+)([yMwdhm])/g)].map((match) => ({
      amount: sign * Number(match[1]),
      unit: match[2] as TimeUnit,
    }));
    return { kind: 'relative', parts };
  }
  return undefined;
}

/** Parses a function increment such as `-1`, `+2d` or `1M`; a bare number uses the default unit. */
export function parseIncrement(text: string, defaultUnit: TimeUnit): Duration | undefined {
  const match = /^([+-]?\d+)([yMwdhm])?$/.exec(text.trim());
  if (!match) return undefined;
  return { amount: Number(match[1]), unit: (match[2] as TimeUnit | undefined) ?? defaultUnit };
}

export const ISSUE_KEY = /^[A-Za-z][A-Za-z0-9]{1,9}-\d+$/;
export const NUMBER = /^-?\d+(?:\.\d+)?$/;
