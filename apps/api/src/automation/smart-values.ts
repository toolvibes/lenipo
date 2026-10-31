/**
 * Smart values in rule texts (T-AUT-05, E-103): {{issue.key}}, {{issue.assignee.displayName}},
 * {{now.plusDays(3)}}, {{issue.dueDate.minusDays(1)}}. A small reader of paths and a fixed set of
 * functions; nothing is evaluated as code. Unknown paths give an empty text.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;

type Value = unknown;

interface Call {
  name: string;
  args: (string | number)[] | null;
}

/** Splits `a.b(1).c("x")` into names with optional arguments; null if malformed. */
function parsePath(text: string): Call[] | null {
  const calls: Call[] = [];
  let rest = text.trim();
  while (rest) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)(\(([^)]*)\))?/.exec(rest);
    if (!match) return null;
    let args: (string | number)[] | null = null;
    if (match[2] !== undefined) {
      const raw = (match[3] ?? '').trim();
      args = raw
        ? raw.split(',').map((arg) => {
            const value = arg.trim();
            const quoted = /^"(.*)"$|^'(.*)'$/.exec(value);
            if (quoted) return quoted[1] ?? quoted[2] ?? '';
            const number = Number(value);
            return Number.isFinite(number) ? number : value;
          })
        : [];
    }
    calls.push({ name: match[1] as string, args });
    rest = rest.slice(match[0].length);
    if (rest.startsWith('.')) rest = rest.slice(1);
    else if (rest) return null;
  }
  return calls;
}

function asDate(value: Value): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && DATE.test(value)) return new Date(`${value}T12:00:00Z`);
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value)) && value.includes('T')) {
    return new Date(value);
  }
  return null;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

/** A date in the time zone as yyyy-MM-dd. */
export function dateIn(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
}

function apply(value: Value, call: Call, timeZone: string): Value {
  const n = typeof call.args?.[0] === 'number' ? (call.args[0] as number) : 0;
  const date = asDate(value);
  if (date) {
    switch (call.name) {
      case 'plusDays':
        return new Date(date.getTime() + n * DAY);
      case 'minusDays':
        return new Date(date.getTime() - n * DAY);
      case 'plusWeeks':
        return new Date(date.getTime() + n * 7 * DAY);
      case 'minusWeeks':
        return new Date(date.getTime() - n * 7 * DAY);
      case 'plusHours':
        return new Date(date.getTime() + n * 3_600_000);
      case 'minusHours':
        return new Date(date.getTime() - n * 3_600_000);
      case 'plusMonths':
        return addMonths(date, n);
      case 'minusMonths':
        return addMonths(date, -n);
      case 'toDate':
        return dateIn(date, timeZone);
      case 'toDateTime':
        return date.toISOString();
    }
  }
  const text = typeof value === 'string' ? value : value == null ? '' : String(value);
  switch (call.name) {
    case 'upperCase':
      return text.toUpperCase();
    case 'lowerCase':
      return text.toLowerCase();
    case 'trim':
      return text.trim();
    case 'length':
      return Array.isArray(value) ? value.length : text.length;
  }
  return undefined;
}

function lookup(root: Record<string, Value>, calls: Call[], timeZone: string): Value {
  let value: Value = root;
  for (const call of calls) {
    if (
      call.args === null &&
      value !== null &&
      typeof value === 'object' &&
      !(value instanceof Date)
    ) {
      value = Array.isArray(value)
        ? call.name === 'size'
          ? value.length
          : undefined
        : // Own properties only: nothing from the prototype chain.
          Object.hasOwn(value, call.name)
          ? (value as Record<string, Value>)[call.name]
          : undefined;
    } else {
      value = apply(value, call, timeZone);
    }
    if (value === undefined) return undefined;
  }
  return value;
}

function show(value: Value, timeZone: string): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return dateIn(value, timeZone);
  if (Array.isArray(value)) return value.map((entry) => show(entry, timeZone)).join(', ');
  if (typeof value === 'object') {
    const named = value as { displayName?: unknown; name?: unknown; key?: unknown };
    return String(named.displayName ?? named.name ?? named.key ?? '');
  }
  return String(value);
}

export interface SmartContext {
  values: Record<string, Value>;
  timeZone: string;
}

export function render(template: string, context: SmartContext): string {
  return template.replace(/\{\{([^{}]*)\}\}/g, (_, inner: string) => {
    const calls = parsePath(inner);
    if (!calls) return '';
    return show(lookup(context.values, calls, context.timeZone), context.timeZone);
  });
}
