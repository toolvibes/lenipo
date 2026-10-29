import { describe, expect, it } from 'vitest';
import { docFromText, mentionedUserIds, plainText } from './rich-text.js';

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

describe('mentions', () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Bitte ansehen, ' },
          { type: 'mention', attrs: { id: 'u-1', label: 'Mira Kaya' } },
          { type: 'text', text: ' und ' },
          { type: 'mention', attrs: { id: 'u-2', label: 'Jonas' } },
        ],
      },
      {
        type: 'paragraph',
        content: [{ type: 'mention', attrs: { id: 'u-1', label: 'Mira Kaya' } }],
      },
    ],
  };

  it('keeps mentions readable in the plain text', () => {
    expect(plainText(doc)).toBe('Bitte ansehen, @Mira Kaya und @Jonas\n@Mira Kaya');
  });

  it('lists each mentioned user once', () => {
    expect(mentionedUserIds(doc)).toEqual(['u-1', 'u-2']);
    expect(mentionedUserIds(docFromText('ohne'))).toEqual([]);
  });
});
