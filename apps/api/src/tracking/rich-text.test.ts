import { describe, expect, it } from 'vitest';
import { docFromText, plainText } from './rich-text.js';

describe('plainText', () => {
  it('extracts one line per block', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Reproduzieren' }],
        },
        {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Board öffnen' }] }],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Warten', marks: [{ type: 'bold' }] }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(plainText(doc)).toBe('Reproduzieren\nBoard öffnen\nWarten');
  });

  it('tolerates empty and malformed input', () => {
    expect(plainText(null)).toBe('');
    expect(plainText({ type: 'doc' })).toBe('');
    expect(plainText({ type: 'doc', content: [null, 3, { type: 'paragraph' }] })).toBe('');
  });

  it('round-trips simple text', () => {
    expect(plainText(docFromText('Erste Zeile\nZweite Zeile'))).toBe('Erste Zeile\nZweite Zeile');
  });
});
