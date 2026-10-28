import { describe, expect, it } from 'vitest';
import { isValidDocumentName } from './document-name.js';

describe('isValidDocumentName', () => {
  it.each(['page:spike', 'issue:WEB-12', 'page:0192f3a1-7c2e-7d4b-9a1e-123456789abc'])(
    'accepts %s',
    (name) => expect(isValidDocumentName(name)).toBe(true),
  );

  it.each(['spike', 'page:', 'user:1', 'page:../etc', `page:${'x'.repeat(65)}`])(
    'rejects %s',
    (name) => expect(isValidDocumentName(name)).toBe(false),
  );
});
