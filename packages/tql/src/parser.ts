import type {
  Clause,
  Expression,
  FunctionOperand,
  ListOperand,
  Operand,
  OrderItem,
  Query,
  Span,
  ValueOperand,
} from './ast.js';
import { parseDuration } from './duration.js';
import { type TqlError, type TqlErrorCode, tqlError } from './errors.js';
import {
  type FieldCatalogue,
  type FieldDef,
  findFunction,
  functionsFor,
  ISSUE_KEY,
  NUMBER,
  type Operator,
  parseDateValue,
  parseIncrement,
  SYSTEM_FIELDS,
} from './fields.js';
import { type Token, tokenize } from './lexer.js';

/** What the parser would accept at the end of the input; drives autocompletion. */
export type Expectation =
  | { type: 'field'; orderBy: boolean }
  | { type: 'operator'; field: FieldDef }
  | { type: 'value'; field: FieldDef; operator: Operator }
  | { type: 'argument' }
  | { type: 'keyword'; keyword: Keyword }
  | { type: 'punctuation'; text: '(' | ')' | ',' };

export type Keyword = 'AND' | 'OR' | 'NOT' | 'IN' | 'EMPTY' | 'ORDER BY' | 'ASC' | 'DESC';

/** Thrown on the first syntax error; semantic errors are collected and parsing goes on. */
class SyntaxFailure extends Error {
  constructor(readonly error: TqlError | null) {
    super(error?.message ?? 'incomplete');
  }
}

const COMPARISON_OPERATORS: Record<string, Operator> = {
  '=': '=',
  '!=': '!=',
  '>': '>',
  '>=': '>=',
  '<': '<',
  '<=': '<=',
  '~': '~',
  '!~': '!~',
};

function spanOf(token: Token): Span {
  return { start: token.start, end: token.end };
}

function join(first: Span, last: Span): Span {
  return { start: first.start, end: last.end };
}

class Parser {
  private position = 0;
  readonly errors: TqlError[] = [];
  readonly expectations: Expectation[] = [];

  constructor(
    private readonly tokens: Token[],
    /** In completion mode the input ends at the cursor; the parser records what could follow. */
    private readonly completing: boolean,
    private readonly catalogue: FieldCatalogue,
  ) {}

  // ---------------------------------------------------------------- token helpers

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.position + offset, this.tokens.length - 1)] as Token;
  }

  private next(): Token {
    const token = this.peek();
    if (token.kind !== 'eof') this.position += 1;
    return token;
  }

  private atEnd(): boolean {
    return this.peek().kind === 'eof';
  }

  private isKeyword(word: string, offset = 0): boolean {
    const token = this.peek(offset);
    return token.kind === 'word' && token.value.toLowerCase() === word;
  }

  private isOp(text: string): boolean {
    const token = this.peek();
    return token.kind === 'op' && token.value === text;
  }

  /** Records what may follow when the input ends here (completion mode only). */
  private expect(...expectations: Expectation[]): void {
    if (this.completing && this.atEnd()) this.expectations.push(...expectations);
  }

  private fail(code: TqlErrorCode, params: Record<string, string> = {}): never {
    const token = this.peek();
    if (this.completing && token.kind === 'eof') throw new SyntaxFailure(null);
    const tokenParams = token.kind === 'eof' ? params : { token: token.text, ...params };
    throw new SyntaxFailure(tqlError(code, spanOf(token), tokenParams));
  }

  private report(code: TqlErrorCode, span: Span, params: Record<string, string>): void {
    this.errors.push(tqlError(code, span, params));
  }

  // ---------------------------------------------------------------- grammar

  parseQuery(): Query {
    let where: Expression | null = null;
    if (this.atEnd()) {
      this.expectStartOfExpression();
      this.expect({ type: 'keyword', keyword: 'ORDER BY' });
    } else if (!this.isKeyword('order')) {
      where = this.parseOr();
      this.expect({ type: 'keyword', keyword: 'ORDER BY' });
    }
    const orderStart = this.isKeyword('order') ? this.peek().start : null;
    const orderBy = orderStart !== null ? this.parseOrderBy() : [];
    const orderSpan = orderStart !== null ? { start: orderStart, end: this.peek(-1).end } : null;
    if (!this.atEnd()) this.fail('unexpected-token');
    return { where, orderBy, orderSpan };
  }

  private expectStartOfExpression(): void {
    this.expect(
      { type: 'field', orderBy: false },
      { type: 'keyword', keyword: 'NOT' },
      { type: 'punctuation', text: '(' },
    );
  }

  private parseOr(): Expression {
    const items = [this.parseAnd()];
    for (;;) {
      this.expect({ type: 'keyword', keyword: 'OR' });
      if (!this.isKeyword('or') && !this.isOp('||')) break;
      this.next();
      items.push(this.parseAnd());
    }
    return items.length === 1 ? (items[0] as Expression) : { kind: 'or', items };
  }

  private parseAnd(): Expression {
    const items = [this.parseUnary()];
    for (;;) {
      this.expect({ type: 'keyword', keyword: 'AND' });
      if (!this.isKeyword('and') && !this.isOp('&&')) break;
      this.next();
      items.push(this.parseUnary());
    }
    return items.length === 1 ? (items[0] as Expression) : { kind: 'and', items };
  }

  private parseUnary(): Expression {
    this.expectStartOfExpression();
    if (this.isKeyword('not') || this.isOp('!')) {
      const start = this.next();
      const expression = this.parseUnary();
      return { kind: 'not', expression, span: { start: start.start, end: this.peek(-1).end } };
    }
    if (this.peek().kind === 'lparen') {
      this.next();
      const expression = this.parseOr();
      this.expect({ type: 'punctuation', text: ')' });
      if (this.peek().kind !== 'rparen') this.fail('expected-closing-paren');
      this.next();
      return expression;
    }
    return this.parseClause();
  }

  private parseFieldName(): { field: FieldDef | null; token: Token } {
    const token = this.peek();
    if (token.kind !== 'word' && token.kind !== 'string') this.fail('expected-field');
    this.next();
    const field = this.catalogue.find(token.value);
    if (!field) this.report('unknown-field', spanOf(token), { field: token.value });
    return { field: field ?? null, token };
  }

  private parseClause(): Clause {
    const { field, token: fieldToken } = this.parseFieldName();
    // Completion cannot go on without knowing the field; a parse still reports the operator part.
    if (!field && this.completing) throw new SyntaxFailure(null);
    if (field && field.operators.length === 0) {
      this.report('field-not-searchable', spanOf(fieldToken), { field: field.id });
    }
    if (field) this.expect({ type: 'operator', field });
    const operatorStart = this.peek();
    const operator = this.parseOperator(fieldToken.value);
    const operatorSpan = join(spanOf(operatorStart), spanOf(this.peek(-1)));

    let operand: Operand;
    if (operator === 'is' || operator === 'is not') {
      this.expect({ type: 'keyword', keyword: 'EMPTY' });
      if (!this.isKeyword('empty') && !this.isKeyword('null')) this.fail('expected-empty');
      operand = { kind: 'empty', span: spanOf(this.next()) };
    } else if (operator === 'in' || operator === 'not in') {
      operand = this.parseListOperand(field, operator);
    } else {
      operand = this.parseSingleOperand(field, operator);
    }

    // `= EMPTY` means `is EMPTY`, as in JQL.
    let normalized = operator;
    if (operand.kind === 'empty' && operator === '=') normalized = 'is';
    else if (operand.kind === 'empty' && operator === '!=') normalized = 'is not';

    const span = join(spanOf(fieldToken), operand.span);
    const resolved = field ?? {
      id: fieldToken.value,
      aliases: [],
      type: 'text',
      operators: [],
      orderable: false,
    };
    if (field && field.operators.length > 0) {
      if (!field.operators.includes(normalized)) {
        this.report('operator-not-supported', operatorSpan, {
          field: field.id,
          operator: operand.kind === 'empty' ? `${operator} EMPTY` : operator,
        });
      } else {
        this.validateOperand(field, normalized, operand);
      }
    }
    return { kind: 'clause', field: resolved, operator: normalized, operand, span };
  }

  private parseOperator(fieldName: string): Operator {
    const token = this.peek();
    if (token.kind === 'op' && token.value in COMPARISON_OPERATORS) {
      this.next();
      return COMPARISON_OPERATORS[token.value] as Operator;
    }
    if (this.isKeyword('in')) {
      this.next();
      return 'in';
    }
    if (this.isKeyword('not')) {
      this.next();
      this.expect({ type: 'keyword', keyword: 'IN' });
      if (!this.isKeyword('in')) this.fail('expected-operator', { field: fieldName });
      this.next();
      return 'not in';
    }
    if (this.isKeyword('is')) {
      this.next();
      this.expect({ type: 'keyword', keyword: 'NOT' });
      if (this.isKeyword('not')) {
        this.next();
        return 'is not';
      }
      return 'is';
    }
    return this.fail('expected-operator', { field: fieldName });
  }

  private parseListOperand(field: FieldDef | null, operator: Operator): Operand {
    this.expect({ type: 'punctuation', text: '(' });
    if (field) this.expect({ type: 'value', field, operator });
    const open = this.peek();
    if (open.kind === 'word' && this.peek(1).kind === 'lparen') return this.parseFunction();
    if (open.kind !== 'lparen') this.fail('expected-list', { operator });
    this.next();
    const items: ListOperand['items'] = [];
    for (;;) {
      if (field) this.expect({ type: 'value', field, operator });
      const item = this.parseSingleValue();
      if (item.kind === 'empty') {
        this.report('operator-not-supported', item.span, {
          field: field?.id ?? '',
          operator: `${operator} EMPTY`,
        });
      } else {
        items.push(item);
      }
      this.expect({ type: 'punctuation', text: ',' }, { type: 'punctuation', text: ')' });
      if (this.peek().kind === 'comma') {
        this.next();
        continue;
      }
      if (this.peek().kind !== 'rparen') this.fail('expected-closing-paren');
      break;
    }
    const close = this.next();
    return { kind: 'list', items, span: join(spanOf(open), spanOf(close)) };
  }

  private parseSingleOperand(field: FieldDef | null, operator: Operator): Operand {
    if (field) {
      this.expect({ type: 'value', field, operator });
      if (field.operators.includes('is') && (operator === '=' || operator === '!=')) {
        this.expect({ type: 'keyword', keyword: 'EMPTY' });
      }
    }
    return this.parseSingleValue();
  }

  private parseSingleValue(): ValueOperand | FunctionOperand | { kind: 'empty'; span: Span } {
    const token = this.peek();
    if (token.kind === 'word' && this.peek(1).kind === 'lparen') return this.parseFunction();
    if (token.kind === 'word' && (this.isKeyword('empty') || this.isKeyword('null'))) {
      return { kind: 'empty', span: spanOf(this.next()) };
    }
    if (token.kind !== 'word' && token.kind !== 'string') this.fail('expected-value');
    this.next();
    return {
      kind: 'value',
      value: token.value,
      quoted: token.kind === 'string',
      span: spanOf(token),
    };
  }

  private parseFunction(): FunctionOperand {
    const nameToken = this.next();
    this.next(); // (
    const args: string[] = [];
    for (;;) {
      this.expect({ type: 'punctuation', text: ')' });
      if (this.peek().kind === 'rparen') break;
      this.expect({ type: 'argument' });
      const arg = this.peek();
      if (arg.kind !== 'word' && arg.kind !== 'string') this.fail('expected-closing-paren');
      args.push(this.next().value);
      this.expect({ type: 'punctuation', text: ',' }, { type: 'punctuation', text: ')' });
      if (this.peek().kind === 'comma') {
        this.next();
        continue;
      }
      if (this.peek().kind !== 'rparen') this.fail('expected-closing-paren');
      break;
    }
    const close = this.next();
    const span = join(spanOf(nameToken), spanOf(close));
    const fn = findFunction(nameToken.value);
    if (!fn) {
      this.report('unknown-function', spanOf(nameToken), { function: nameToken.value });
      return {
        kind: 'function',
        fn: { name: nameToken.value, result: 'user', minArgs: 0, maxArgs: 0 },
        args,
        span,
      };
    }
    if (args.length < fn.minArgs || args.length > fn.maxArgs) {
      this.report('function-arguments', span, {
        function: fn.name,
        min: String(fn.minArgs),
        max: String(fn.maxArgs),
      });
    } else if (
      fn.defaultUnit &&
      args[0] !== undefined &&
      !parseIncrement(args[0], fn.defaultUnit)
    ) {
      this.report('invalid-increment', span, { value: args[0] });
    } else if (fn.result === 'issues' && args[0] !== undefined && !ISSUE_KEY.test(args[0])) {
      this.report('invalid-issue-key', span, { value: args[0] });
    }
    return { kind: 'function', fn, args, span };
  }

  private parseOrderBy(): OrderItem[] {
    this.next(); // ORDER
    this.expect({ type: 'keyword', keyword: 'ORDER BY' });
    if (!this.isKeyword('by')) this.fail('expected-by');
    this.next();
    const items: OrderItem[] = [];
    for (;;) {
      this.expect({ type: 'field', orderBy: true });
      const { field, token } = this.parseFieldName();
      if (field && !field.orderable)
        this.report('field-not-orderable', spanOf(token), { field: field.id });
      let direction: OrderItem['direction'] = 'asc';
      this.expect(
        { type: 'keyword', keyword: 'ASC' },
        { type: 'keyword', keyword: 'DESC' },
        { type: 'punctuation', text: ',' },
      );
      if (this.isKeyword('asc') || this.isKeyword('desc')) {
        direction = this.next().value.toLowerCase() as OrderItem['direction'];
      }
      if (field) items.push({ field, direction, span: join(spanOf(token), spanOf(this.peek(-1))) });
      if (this.peek().kind !== 'comma') break;
      this.next();
    }
    return items;
  }

  // ---------------------------------------------------------------- validation

  private validateOperand(field: FieldDef, operator: Operator, operand: Operand): void {
    if (operand.kind === 'empty') return;
    if (operand.kind === 'list') {
      for (const item of operand.items) this.validateOperand(field, operator, item);
      return;
    }
    if (operand.kind === 'function') {
      if (!findFunction(operand.fn.name)) return; // already reported
      if (!functionsFor(field, operator).includes(operand.fn)) {
        this.report('function-not-supported', operand.span, {
          function: operand.fn.name,
          field: field.id,
        });
      }
      return;
    }
    const params = { field: field.id, value: operand.value };
    switch (field.type) {
      case 'number':
        if (!NUMBER.test(operand.value)) this.report('invalid-number', operand.span, params);
        break;
      case 'date':
      case 'datetime':
        if (!parseDateValue(operand.value)) this.report('invalid-date', operand.span, params);
        break;
      case 'issue':
        if (!ISSUE_KEY.test(operand.value)) this.report('invalid-issue-key', operand.span, params);
        break;
      case 'duration':
        if (parseDuration(operand.value) === undefined) {
          this.report('invalid-duration', operand.span, params);
        }
        break;
      case 'boolean':
        if (!/^(true|false)$/i.test(operand.value)) {
          this.report('invalid-boolean', operand.span, params);
        }
        break;
      default:
        break;
    }
  }
}

export interface ParseResult {
  /** Null when the query has a syntax error. */
  query: Query | null;
  errors: TqlError[];
}

/** Parses a TQL query; the query is usable only when `errors` is empty. */
export function parse(text: string, catalogue: FieldCatalogue = SYSTEM_FIELDS): ParseResult {
  const tokens = tokenize(text);
  const unterminated = tokens.find((token) => token.unterminated);
  if (unterminated) {
    return { query: null, errors: [tqlError('unterminated-string', spanOf(unterminated))] };
  }
  const parser = new Parser(tokens, false, catalogue);
  try {
    const query = parser.parseQuery();
    return { query, errors: parser.errors };
  } catch (error) {
    if (!(error instanceof SyntaxFailure) || !error.error) throw error;
    return {
      query: null,
      errors: [...parser.errors, error.error].sort((a, b) => a.start - b.start),
    };
  }
}

/** Runs the parser over the tokens before the cursor and returns what it expected next. */
export function expectationsAt(
  tokens: Token[],
  catalogue: FieldCatalogue = SYSTEM_FIELDS,
): Expectation[] {
  const parser = new Parser(tokens, true, catalogue);
  try {
    parser.parseQuery();
  } catch (error) {
    if (!(error instanceof SyntaxFailure)) throw error;
    // A syntax error before the cursor: nothing sensible to suggest.
    if (error.error) return [];
  }
  return parser.expectations;
}
