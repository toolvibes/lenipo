import { describe, expect, it } from 'vitest';
import { completionContext, staticSuggestions } from './complete.js';
import { customFieldNameClash, FieldCatalogue } from './fields.js';
import { parse } from './parser.js';

const catalogue = new FieldCatalogue([
  { id: 'f1', number: 1, name: 'Kunde', type: 'select' },
  { id: 'f2', number: 2, name: 'Freigabe am', type: 'date' },
  { id: 'f3', number: 3, name: 'Geprüft', type: 'checkbox' },
  { id: 'f4', number: 4, name: 'Notizen', type: 'textarea' },
  // A clashing name never takes over the system field.
  { id: 'f5', number: 5, name: 'status', type: 'text' },
]);

describe('custom fields', () => {
  it('are found by name, in quotes, or as cf[n]', () => {
    const { query, errors } = parse(
      'Kunde in (ACME, "Muster AG") AND "Freigabe am" >= -7d AND cf[3] = true',
      catalogue,
    );
    expect(errors).toEqual([]);
    const where = query?.where;
    expect(
      where?.kind === 'and' && where.items.map((item) => item.kind === 'clause' && item.field.id),
    ).toEqual(['cf[1]', 'cf[2]', 'cf[3]']);
  });

  it('check values and operators by type', () => {
    expect(parse('Geprüft = vielleicht', catalogue).errors.map((error) => error.code)).toEqual([
      'invalid-boolean',
    ]);
    expect(parse('"Freigabe am" = gestern', catalogue).errors[0]?.code).toBe('invalid-date');
    expect(parse('Notizen = x', catalogue).errors[0]?.code).toBe('operator-not-supported');
    expect(parse('ORDER BY Notizen', catalogue).errors[0]?.code).toBe('field-not-orderable');
    expect(parse('Kunde = ACME').errors[0]?.code).toBe('unknown-field');
  });

  it('leave system fields alone', () => {
    const clause = parse('status = Done', catalogue).query?.where;
    expect(clause?.kind === 'clause' && clause.field.id).toBe('status');
    expect(customFieldNameClash('Status')).toBe('field');
    expect(customFieldNameClash('cf[12]')).toBe('field');
    expect(customFieldNameClash('now')).toBe('function');
    expect(customFieldNameClash('order')).toBe('keyword');
    expect(customFieldNameClash('Kunde')).toBeNull();
  });

  it('are offered by name in completion', () => {
    const context = completionContext('Fre', 3, catalogue);
    expect(staticSuggestions(context, catalogue)).toContainEqual({
      kind: 'field',
      label: 'Freigabe am',
      insert: '"Freigabe am"',
      detail: 'cf[2]',
    });
  });
});
