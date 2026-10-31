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
  | 'issue'
  | 'component'
  | 'link-type'
  | 'duration'
  // Custom fields (E-50): select options and checkboxes.
  | 'option'
  | 'boolean'
  | 'sprint'
  | 'version';

export interface FieldDef {
  /** Canonical name, used in suggestions and by the SQL compiler. */
  id: string;
  /** Further accepted names (compared case-insensitively), e.g. Jira's names. */
  aliases: readonly string[];
  type: FieldType;
  /** Empty for fields that can only be sorted by (rank). */
  operators: readonly Operator[];
  orderable: boolean;
  /** Set for custom fields (E-50); `id` is then `cf[n]` and the name is the alias. */
  custom?: CustomFieldInfo;
}

/** The types of custom fields in Phase 1 (E-50). */
export type CustomFieldKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multiselect'
  | 'user'
  | 'checkbox'
  | 'url'
  | 'users'
  | 'group'
  | 'version'
  | 'labels';

/** What the query language needs to know about a custom field. */
export interface CustomFieldInfo {
  id: string;
  number: number;
  name: string;
  type: CustomFieldKind;
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
    id: 'startDate',
    aliases: ['start'],
    type: 'date',
    operators: [...DATES, ...EMPTINESS],
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
  {
    id: 'component',
    aliases: ['components'],
    type: 'component',
    operators: [...EQUALITY, ...EMPTINESS],
    orderable: false,
  },
  {
    id: 'issueLinkType',
    aliases: ['linktype'],
    type: 'link-type',
    operators: EQUALITY,
    orderable: false,
  },
  {
    id: 'originalEstimate',
    aliases: ['timeoriginalestimate'],
    type: 'duration',
    operators: [...DATES, ...EMPTINESS],
    orderable: true,
  },
  {
    id: 'remainingEstimate',
    aliases: ['timeestimate', 'remaining'],
    type: 'duration',
    operators: [...DATES, ...EMPTINESS],
    orderable: true,
  },
  { id: 'timeSpent', aliases: ['timespent'], type: 'duration', operators: DATES, orderable: true },
  { id: 'rank', aliases: [], type: 'text', operators: [], orderable: true },
  {
    id: 'fixVersion',
    aliases: [],
    type: 'version',
    operators: [...EQUALITY, ...EMPTINESS],
    orderable: false,
  },
  {
    id: 'affectedVersion',
    aliases: ['affectsVersion'],
    type: 'version',
    operators: [...EQUALITY, ...EMPTINESS],
    orderable: false,
  },
  {
    id: 'sprint',
    aliases: [],
    type: 'sprint',
    operators: [...EQUALITY, ...EMPTINESS],
    orderable: false,
  },
];

const CUSTOM_TYPES: Record<
  CustomFieldKind,
  { type: FieldType; operators: readonly Operator[]; orderable: boolean }
> = {
  text: { type: 'text', operators: [...TEXT, ...EMPTINESS], orderable: true },
  textarea: { type: 'text', operators: [...TEXT, ...EMPTINESS], orderable: false },
  url: { type: 'text', operators: [...TEXT, ...EMPTINESS], orderable: true },
  number: {
    type: 'number',
    operators: [...EQUALITY, ...COMPARISON, ...EMPTINESS],
    orderable: true,
  },
  date: { type: 'date', operators: [...DATES, ...EMPTINESS], orderable: true },
  datetime: { type: 'datetime', operators: [...DATES, ...EMPTINESS], orderable: true },
  select: { type: 'option', operators: [...EQUALITY, ...EMPTINESS], orderable: false },
  multiselect: { type: 'option', operators: [...EQUALITY, ...EMPTINESS], orderable: false },
  user: { type: 'user', operators: [...EQUALITY, ...EMPTINESS], orderable: false },
  checkbox: { type: 'boolean', operators: ['=', '!='], orderable: true },
  users: { type: 'user', operators: [...EQUALITY, ...EMPTINESS], orderable: false },
  // Groups and versions are matched like options; the server lists them as such (E-90).
  group: { type: 'option', operators: [...EQUALITY, ...EMPTINESS], orderable: false },
  version: { type: 'option', operators: [...EQUALITY, ...EMPTINESS], orderable: false },
  labels: { type: 'label', operators: [...EQUALITY, ...EMPTINESS], orderable: false },
};

export const CUSTOM_FIELD_ID = /^cf\[(\d+)\]$/i;

export function customFieldDef(info: CustomFieldInfo): FieldDef {
  return {
    id: `cf[${info.number}]`,
    aliases: [info.name],
    ...CUSTOM_TYPES[info.type],
    custom: info,
  };
}

/**
 * The fields a query may use: the system fields plus the instance's custom fields (E-50).
 * System names win; the API refuses custom names that would clash with them.
 */
export class FieldCatalogue {
  readonly fields: readonly FieldDef[];
  private readonly byName = new Map<string, FieldDef>();

  constructor(custom: readonly CustomFieldInfo[] = []) {
    const customDefs = custom.map(customFieldDef);
    this.fields = [...FIELDS, ...customDefs];
    // System fields are set last, so their names win.
    for (const field of [...customDefs, ...FIELDS]) {
      for (const name of [field.id, ...field.aliases]) this.byName.set(name.toLowerCase(), field);
    }
  }

  find(name: string): FieldDef | undefined {
    return this.byName.get(name.toLowerCase());
  }
}

export const SYSTEM_FIELDS = new FieldCatalogue();

/** A system field by name or alias; custom fields need a catalogue. */
export function findField(name: string): FieldDef | undefined {
  return SYSTEM_FIELDS.find(name);
}

/** Accepted values of `statusCategory`; the first name of each entry is canonical. */
export const STATUS_CATEGORY_NAMES: Readonly<Record<'todo' | 'in_progress' | 'done', string[]>> = {
  todo: ['todo', 'to do', 'new'],
  in_progress: ['in_progress', 'in progress', 'indeterminate'],
  done: ['done', 'complete'],
};

export type FunctionResult = 'user' | 'users' | 'datetime' | 'issues' | 'sprints' | 'versions';

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
  /** Issues linked to the given one, optionally only through one link type or direction. */
  { name: 'linkedIssues', result: 'issues', minArgs: 1, maxArgs: 2 },
  { name: 'now', result: 'datetime', minArgs: 0, maxArgs: 0 },
  /** Active and planned sprints, as in JQL (E-55). */
  { name: 'openSprints', result: 'sprints', minArgs: 0, maxArgs: 0 },
  { name: 'closedSprints', result: 'sprints', minArgs: 0, maxArgs: 0 },
  { name: 'futureSprints', result: 'sprints', minArgs: 0, maxArgs: 0 },
  /** Versions of all visible projects, or of the project given by key (E-57). */
  { name: 'releasedVersions', result: 'versions', minArgs: 0, maxArgs: 1 },
  { name: 'unreleasedVersions', result: 'versions', minArgs: 0, maxArgs: 1 },
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

const KEYWORDS = ['and', 'or', 'not', 'in', 'is', 'empty', 'null', 'order', 'by', 'asc', 'desc'];

/**
 * Why a custom field cannot have this name, if it cannot: it would clash with a system field,
 * a function, a keyword or the `cf[n]` form (E-50).
 */
export function customFieldNameClash(name: string): 'field' | 'function' | 'keyword' | null {
  const lower = name.trim().toLowerCase();
  if (findField(lower) || CUSTOM_FIELD_ID.test(lower)) return 'field';
  if (findFunction(lower)) return 'function';
  if (KEYWORDS.includes(lower)) return 'keyword';
  return null;
}

/** Functions usable as a value of this field with this operator. */
export function functionsFor(field: FieldDef, operator: Operator): FunctionDef[] {
  const list = operator === 'in' || operator === 'not in';
  return FUNCTIONS.filter((fn) => {
    if (fn.result === 'datetime') return field.type === 'date' || field.type === 'datetime';
    if (fn.result === 'issues') return field.type === 'issue' && list;
    if (fn.result === 'sprints') return field.type === 'sprint' && list;
    if (fn.result === 'versions') return field.type === 'version' && list;
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
