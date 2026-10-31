import type { FieldDef, FunctionDef, Operator } from './fields.js';

export interface Span {
  start: number;
  end: number;
}

export interface ValueOperand {
  kind: 'value';
  value: string;
  quoted: boolean;
  span: Span;
}

export interface FunctionOperand {
  kind: 'function';
  fn: FunctionDef;
  args: string[];
  span: Span;
}

export interface EmptyOperand {
  kind: 'empty';
  span: Span;
}

export interface ListOperand {
  kind: 'list';
  items: Array<ValueOperand | FunctionOperand>;
  span: Span;
}

export type Operand = ValueOperand | FunctionOperand | EmptyOperand | ListOperand;

/** A condition on a history operator: who, when, from or to which value (TL-17, E-98). */
export interface HistoryPredicate {
  kind: 'by' | 'after' | 'before' | 'on' | 'during' | 'from' | 'to';
  operand: Operand;
  span: Span;
}

export interface Clause {
  kind: 'clause';
  field: FieldDef;
  /** `= EMPTY` and `!= EMPTY` are normalized to `is` and `is not`. */
  operator: Operator;
  operand: Operand;
  /** Only with history operators. */
  history?: HistoryPredicate[];
  span: Span;
}

export type Expression =
  | Clause
  | { kind: 'and'; items: Expression[] }
  | { kind: 'or'; items: Expression[] }
  | { kind: 'not'; expression: Expression; span: Span };

export interface OrderItem {
  field: FieldDef;
  direction: 'asc' | 'desc';
  span: Span;
}

export interface Query {
  where: Expression | null;
  orderBy: OrderItem[];
  /** From `ORDER` to the last sort key; null without ORDER BY. */
  orderSpan: Span | null;
}
