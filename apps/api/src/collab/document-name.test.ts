import { describe, expect, it } from 'vitest';
import { pageIdOf } from './document-name.js';

describe('pageIdOf', () => {
  it('reads the page id of a draft document', () => {
    expect(pageIdOf('page:0192f3a1-7c2e-7d4b-9a1e-123456789abc')).toBe(
      '0192f3a1-7c2e-7d4b-9a1e-123456789abc',
    );
  });

  it.each(['spike', 'page:', 'page:spike', 'issue:WEB-12', 'user:1', 'page:../etc'])(
    'rejects %s',
    (name) => expect(pageIdOf(name)).toBeNull(),
  );
});
