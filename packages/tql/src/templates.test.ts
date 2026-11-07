import { describe, expect, it } from 'vitest';
import { parse } from './parser.js';
import { QUERY_TEMPLATES } from './templates.js';

describe('query templates', () => {
  it.each(QUERY_TEMPLATES)('$id parses without errors', ({ query }) => {
    expect(parse(query).errors).toEqual([]);
  });

  it('have unique ids and queries', () => {
    expect(new Set(QUERY_TEMPLATES.map((entry) => entry.id)).size).toBe(QUERY_TEMPLATES.length);
    expect(new Set(QUERY_TEMPLATES.map((entry) => entry.query)).size).toBe(QUERY_TEMPLATES.length);
  });
});
