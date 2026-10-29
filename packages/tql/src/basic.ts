import type { Clause, Expression, Operand } from './ast.js';
import { quoteValue } from './complete.js';
import { type FieldCatalogue, SYSTEM_FIELDS } from './fields.js';
import { parse } from './parser.js';

/** The click filters of the basic search, in display order (T-QRY-05, E-48). */
export const BASIC_FIELDS = ['project', 'issuetype', 'status', 'assignee', 'priority'] as const;
export type BasicField = (typeof BASIC_FIELDS)[number];

/** Stand-ins for the two non-values the basic search offers for the assignee. */
export const CURRENT_USER = 'currentUser()';
export const NO_VALUE = 'EMPTY';

export interface BasicQuery {
  values: Record<BasicField, string[]>;
  /** Free text, searched with `text ~`. */
  text: string;
  /** The query's ORDER BY as written, kept untouched; empty without one. */
  orderBy: string;
}

export function emptyBasicQuery(): BasicQuery {
  return {
    values: { project: [], issuetype: [], status: [], assignee: [], priority: [] },
    text: '',
    orderBy: '',
  };
}

function clauses(expression: Expression): Clause[] | null {
  if (expression.kind === 'clause') return [expression];
  if (expression.kind !== 'and') return null;
  const result: Clause[] = [];
  for (const item of expression.items) {
    const inner = clauses(item);
    if (!inner) return null;
    result.push(...inner);
  }
  return result;
}

function operandValues(field: BasicField, operand: Operand): string[] | null {
  const items = operand.kind === 'list' ? operand.items : [operand];
  const values: string[] = [];
  for (const item of items) {
    if (item.kind === 'value') {
      // A quoted "EMPTY" means a value named so, which the stand-in could not tell apart.
      if (item.value === NO_VALUE || item.value === CURRENT_USER) return null;
      values.push(item.value);
    } else if (item.kind === 'function' && field === 'assignee' && item.fn.name === 'currentUser') {
      values.push(CURRENT_USER);
    } else {
      return null;
    }
  }
  return values;
}

/**
 * The basic search form of a query, or null when the query has another shape: anything but
 * clauses joined by AND, each basic field at most once with `=` or `in`, and one `text ~`.
 */
export function toBasic(query: string): BasicQuery | null {
  const { query: parsed, errors } = parse(query);
  if (!parsed || errors.length > 0) return null;
  const basic = emptyBasicQuery();
  if (parsed.orderSpan) basic.orderBy = query.slice(parsed.orderSpan.start, parsed.orderSpan.end);
  if (!parsed.where) return basic;
  const list = clauses(parsed.where);
  if (!list) return null;
  const seen = new Set<string>();
  for (const clause of list) {
    const id = clause.field.id;
    if (seen.has(id)) return null;
    seen.add(id);
    if (id === 'text') {
      if (clause.operator !== '~' || clause.operand.kind !== 'value') return null;
      basic.text = clause.operand.value;
      continue;
    }
    if (!(BASIC_FIELDS as readonly string[]).includes(id)) return null;
    const field = id as BasicField;
    if (field === 'assignee' && clause.operator === 'is' && clause.operand.kind === 'empty') {
      basic.values.assignee = [NO_VALUE];
      continue;
    }
    if (clause.operator !== '=' && clause.operator !== 'in') return null;
    const values = operandValues(field, clause.operand);
    if (!values) return null;
    basic.values[field] = values;
  }
  return basic;
}

function clauseText(field: BasicField, values: string[]): string | null {
  // `in (EMPTY)` is not TQL; fromBasic leaves "unassigned" alone in its list.
  if (values.length === 0) return null;
  if (values.length === 1 && values[0] === NO_VALUE) return `${field} is EMPTY`;
  const items = values.map((value) => (value === CURRENT_USER ? value : quoteValue(value)));
  return items.length === 1 ? `${field} = ${items[0]}` : `${field} in (${items.join(', ')})`;
}

/** The TQL for a basic search; fields left empty are not filtered. */
export function fromBasic(basic: BasicQuery): string {
  const parts: string[] = [];
  for (const field of BASIC_FIELDS) {
    let values = basic.values[field];
    // Unassigned together with people cannot be one clause of the basic form; people win.
    if (field === 'assignee' && values.includes(NO_VALUE) && values.length > 1) {
      values = values.filter((value) => value !== NO_VALUE);
    }
    const clause = clauseText(field, values);
    if (clause) parts.push(clause);
  }
  if (basic.text.trim()) parts.push(`text ~ ${quoteValue(basic.text.trim())}`);
  return [parts.join(' AND '), basic.orderBy].filter(Boolean).join(' ');
}

export interface SortKey {
  field: string;
  direction: 'asc' | 'desc';
}

/** The first sort key of a query, by canonical field id; null without ORDER BY or when invalid. */
export function primarySort(
  query: string,
  catalogue: FieldCatalogue = SYSTEM_FIELDS,
): SortKey | null {
  const first = parse(query, catalogue).query?.orderBy[0];
  return first ? { field: first.field.id, direction: first.direction } : null;
}

/**
 * The query sorted by one field only, as a click on a column header does: the ORDER BY is
 * replaced (or added), the rest of the text stays as written. Null for a query with errors.
 */
export function withSort(
  query: string,
  sort: SortKey,
  catalogue: FieldCatalogue = SYSTEM_FIELDS,
): string | null {
  const { query: parsed, errors } = parse(query, catalogue);
  if (!parsed || errors.length > 0) return null;
  const order = `ORDER BY ${sort.field} ${sort.direction.toUpperCase()}`;
  if (!parsed.orderSpan) return [query.trimEnd(), order].filter(Boolean).join(' ');
  const before = query.slice(0, parsed.orderSpan.start);
  const after = query.slice(parsed.orderSpan.end);
  return `${before}${order}${after}`;
}

/** Header click: ascending first, then the other way round. */
export function nextSort(current: SortKey | null, field: string): SortKey {
  if (current?.field === field) {
    return { field, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { field, direction: 'asc' };
}
