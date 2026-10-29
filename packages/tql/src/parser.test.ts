import { describe, expect, it } from 'vitest';
import type { Clause, Expression } from './ast.js';
import { parseDateValue, parseIncrement } from './fields.js';
import { parse } from './parser.js';

function where(text: string): Expression {
  const result = parse(text);
  expect(result.errors).toEqual([]);
  if (!result.query?.where) throw new Error('no where clause');
  return result.query.where;
}

function clause(text: string): Clause {
  const expression = where(text);
  if (expression.kind !== 'clause') throw new Error(`expected a clause, got ${expression.kind}`);
  return expression;
}

function codes(text: string): string[] {
  return parse(text).errors.map((error) => error.code);
}

describe('parse', () => {
  it('parses the example query from the plan', () => {
    const result = parse(
      'project = WEB AND status in ("In Arbeit", Review) AND assignee = currentUser() ORDER BY rank',
    );
    expect(result.errors).toEqual([]);
    const expression = result.query?.where;
    expect(expression?.kind).toBe('and');
    if (expression?.kind !== 'and') return;
    const [project, status, assignee] = expression.items as Clause[];
    expect(project?.field.id).toBe('project');
    expect(project?.operand).toMatchObject({ kind: 'value', value: 'WEB', quoted: false });
    expect(status?.operator).toBe('in');
    expect(status?.operand).toMatchObject({
      kind: 'list',
      items: [
        { kind: 'value', value: 'In Arbeit', quoted: true },
        { kind: 'value', value: 'Review' },
      ],
    });
    expect(assignee?.operand).toMatchObject({ kind: 'function', fn: { name: 'currentUser' } });
    expect(result.query?.orderBy).toMatchObject([{ field: { id: 'rank' }, direction: 'asc' }]);
  });

  it('binds AND tighter than OR and honours parentheses and NOT', () => {
    const expression = where('status = A OR status = B AND NOT (priority = High OR labels = x)');
    expect(expression.kind).toBe('or');
    if (expression.kind !== 'or') return;
    expect(expression.items[0]?.kind).toBe('clause');
    const right = expression.items[1];
    expect(right?.kind).toBe('and');
    if (right?.kind !== 'and') return;
    expect(right.items[1]).toMatchObject({ kind: 'not', expression: { kind: 'or' } });
  });

  it('accepts keywords and field names in any case, aliases and symbolic AND/OR', () => {
    expect(clause('TYPE = Bug').field.id).toBe('issuetype');
    expect(clause('"Story Points" > 3').field.id).toBe('storyPoints');
    expect(where('status = a && status = b').kind).toBe('and');
    expect(where('status = a || status = b').kind).toBe('or');
    expect(where('not status = a').kind).toBe('not');
    expect(where('!(status = a)').kind).toBe('not');
  });

  it('normalizes = EMPTY and supports IS [NOT] EMPTY', () => {
    expect(clause('assignee = EMPTY').operator).toBe('is');
    expect(clause('assignee != null').operator).toBe('is not');
    expect(clause('resolution is empty').operand.kind).toBe('empty');
    expect(clause('resolution IS NOT EMPTY').operator).toBe('is not');
  });

  it('unescapes quoted strings', () => {
    expect(clause('summary ~ "say \\"hi\\""').operand).toMatchObject({ value: 'say "hi"' });
    expect(clause("labels = 'a b'").operand).toMatchObject({ value: 'a b' });
  });

  it('parses ORDER BY with several fields and directions', () => {
    const result = parse('ORDER BY priority DESC, created asc, key');
    expect(result.errors).toEqual([]);
    expect(result.query?.where).toBeNull();
    expect(result.query?.orderBy.map((item) => [item.field.id, item.direction])).toEqual([
      ['priority', 'desc'],
      ['created', 'asc'],
      ['key', 'asc'],
    ]);
  });

  it('accepts an empty query', () => {
    expect(parse('   ')).toEqual({ query: { where: null, orderBy: [] }, errors: [] });
  });

  it('reports syntax errors with their position', () => {
    expect(parse('status = ')).toMatchObject({ query: null, errors: [{ code: 'expected-value' }] });
    expect(parse('status Open').errors[0]).toMatchObject({
      code: 'expected-operator',
      start: 7,
      end: 11,
      params: { field: 'status', token: 'Open' },
    });
    expect(codes('(status = Open')).toEqual(['expected-closing-paren']);
    expect(codes('status in Open')).toEqual(['expected-list']);
    expect(codes('status = Open ORDER priority')).toEqual(['expected-by']);
    expect(codes('status = "Open')).toEqual(['unterminated-string']);
    expect(codes('status = Open )')).toEqual(['unexpected-token']);
    expect(codes('resolution is Done')).toEqual(['expected-empty']);
  });

  it('reports semantic errors without stopping', () => {
    expect(codes('colour = red AND priority ~ High')).toEqual([
      'unknown-field',
      'operator-not-supported',
    ]);
    expect(codes('rank = 3')).toEqual(['field-not-searchable']);
    expect(codes('ORDER BY text')).toEqual(['field-not-orderable']);
    expect(codes('status = EMPTY')).toEqual(['operator-not-supported']);
    expect(codes('storyPoints > many')).toEqual(['invalid-number']);
    expect(codes('created > yesterday')).toEqual(['invalid-date']);
    expect(codes('key = WEB')).toEqual(['invalid-issue-key']);
    expect(codes('assignee = me()')).toEqual(['unknown-function']);
    expect(codes('status = currentUser()')).toEqual(['function-not-supported']);
    expect(codes('assignee = membersOf(team)')).toEqual(['function-not-supported']);
    expect(codes('assignee in membersOf()')).toEqual(['function-arguments']);
    expect(codes('created > startOfWeek(soon)')).toEqual(['invalid-increment']);
  });

  it('supports components, link types and linkedIssues()', () => {
    expect(codes('component in (Backend, "API Gateway") OR component is EMPTY')).toEqual([]);
    expect(codes('issueLinkType = blocks')).toEqual([]);
    expect(codes('key in linkedIssues(WEB-1) AND parent in linkedIssues(WEB-2, blocks)')).toEqual(
      [],
    );
    expect(codes('key = linkedIssues(WEB-1)')).toEqual(['function-not-supported']);
    expect(codes('key in linkedIssues(nonsense)')).toEqual(['invalid-issue-key']);
    expect(codes('key in linkedIssues()')).toEqual(['function-arguments']);
  });

  it('accepts functions where they fit', () => {
    expect(codes('assignee in membersOf("team-plattform")')).toEqual([]);
    expect(codes('assignee in (currentUser(), "mira@example.com")')).toEqual([]);
    expect(
      codes('created >= startOfWeek(-1) AND updated < endOfDay(+2d) AND due <= now()'),
    ).toEqual([]);
    expect(codes('created > -7d AND resolved < "2026-10-28 14:30" AND due = 2026/1/5')).toEqual([]);
  });
});

describe('dates', () => {
  it('parses absolute and relative dates', () => {
    expect(parseDateValue('2026-10-28')).toEqual({ kind: 'absolute', date: '2026-10-28' });
    expect(parseDateValue('2026/1/5 9:05')).toEqual({
      kind: 'absolute',
      date: '2026-01-05',
      time: '09:05',
    });
    expect(parseDateValue('-1w 2d')).toEqual({
      kind: 'relative',
      parts: [
        { amount: -1, unit: 'w' },
        { amount: -2, unit: 'd' },
      ],
    });
    expect(parseDateValue('4h')).toEqual({ kind: 'relative', parts: [{ amount: 4, unit: 'h' }] });
  });

  it('rejects impossible dates and other text', () => {
    expect(parseDateValue('2026-02-30')).toBeUndefined();
    expect(parseDateValue('2026-10-28 24:00')).toBeUndefined();
    expect(parseDateValue('tomorrow')).toBeUndefined();
    expect(parseDateValue('-7x')).toBeUndefined();
  });

  it('parses function increments with a default unit', () => {
    expect(parseIncrement('-1', 'w')).toEqual({ amount: -1, unit: 'w' });
    expect(parseIncrement('+2d', 'w')).toEqual({ amount: 2, unit: 'd' });
    expect(parseIncrement('soon', 'd')).toBeUndefined();
  });
});
