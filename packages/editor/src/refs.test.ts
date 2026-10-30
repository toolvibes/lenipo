import { describe, expect, it } from 'vitest';
import { issueKeysIn, issueRefs } from './refs.js';

const text = (value: string, marks?: Array<{ type: string }>) => ({
  type: 'text',
  text: value,
  marks,
});

describe('issue references', () => {
  it('finds keys in text, not inside words or code', () => {
    expect(
      issueKeysIn('Siehe WEB-12 und (APP-3), nicht XWEB-1a oder WEB-0').map((m) => m.key),
    ).toEqual(['WEB-12', 'APP-3']);
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [text('WEB-1 erledigt, siehe '), { type: 'issue', attrs: { key: 'WEB-2' } }],
        },
        {
          type: 'paragraph',
          content: [text('WEB-3', [{ type: 'code' }]), text(' und WEB-2 nochmal')],
        },
        { type: 'codeBlock', content: [text('WEB-4')] },
      ],
    };
    expect(issueRefs(doc)).toEqual([
      { key: 'WEB-1', kind: 'mention' },
      { key: 'WEB-2', kind: 'macro' },
    ]);
  });
});
