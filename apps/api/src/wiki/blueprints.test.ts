import { isValidDoc } from '@tasklore/editor';
import { describe, expect, it } from 'vitest';
import { BLUEPRINT_KEYS, blueprint } from './blueprints.js';

describe('blueprints', () => {
  it.each(
    BLUEPRINT_KEYS.flatMap((key) => [
      [key, 'de'],
      [key, 'en'],
    ]),
  )('%s (%s) is a valid document with a name', (key, locale) => {
    const entry = blueprint(key, locale);
    expect(entry.name).not.toBe('');
    expect(isValidDoc(entry.content())).toBe(true);
  });
});
