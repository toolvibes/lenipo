import { isValidDoc } from '@toolvibes/editor';
import { describe, expect, it } from 'vitest';
import { BLUEPRINT_KEYS, blueprint } from './blueprints.js';
import { fillDocument } from './template-variables.js';

describe('blueprints', () => {
  it.each(
    BLUEPRINT_KEYS.flatMap((key) => [
      [key, 'de'],
      [key, 'en'],
    ]),
  )('%s (%s) is a valid document with a name', (key, locale) => {
    const entry = blueprint(key, locale);
    expect(entry.name).not.toBe('');
    // As a page starts from it: with its variables filled in (TL-27, TL-28).
    const filled = fillDocument(entry.content(), {
      date: '2026-10-31',
      author: 'Lena Vogt',
      space: 'Doku',
      title: entry.title,
      inputs: { Epic: 'WEB-1' },
    });
    expect(isValidDoc(filled)).toBe(true);
  });
});
