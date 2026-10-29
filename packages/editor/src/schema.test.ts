import { describe, expect, it } from 'vitest';
import { isValidDoc } from './schema.js';

describe('isValidDoc', () => {
  it('accepts documents of the shared schema', () => {
    expect(isValidDoc({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(true);
    expect(
      isValidDoc({
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Ziel' }] },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'fett', marks: [{ type: 'bold' }] }],
          },
        ],
      }),
    ).toBe(true);
  });

  it('rejects unknown nodes, bad nesting and other roots', () => {
    expect(isValidDoc({ type: 'doc', content: [{ type: 'script' }] })).toBe(false);
    expect(isValidDoc({ type: 'doc', content: [{ type: 'text', text: 'lose' }] })).toBe(false);
    expect(isValidDoc({ type: 'paragraph' })).toBe(false);
    expect(isValidDoc('doc')).toBe(false);
  });
});
