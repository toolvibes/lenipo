import { describe, expect, it } from 'vitest';
import { fillDocument, fillText, inputsOf } from './template-variables.js';

const values = {
  date: '2026-10-31',
  author: 'Lena Vogt',
  space: 'Doku',
  title: 'Ausfall',
  inputs: { Vorfall: 'API down' },
};

describe('template variables (TL-27)', () => {
  it('finds input variables in title, text and macro settings', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '{{input:Vorfall}} am {{date}}' }] },
        { type: 'issueList', attrs: { query: 'fixVersion = "{{input:Version}}"' } },
      ],
    };
    expect(inputsOf('{{ input:Team }} – {{input:Vorfall}}', doc)).toEqual([
      'Team',
      'Vorfall',
      'Version',
    ]);
  });

  it('fills variables and drops text that became empty', () => {
    expect(fillText('{{date}} {{author}} in {{space}}: {{title}}', values)).toBe(
      '2026-10-31 Lena Vogt in Doku: Ausfall',
    );
    const filled = fillDocument(
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '{{input:Unbekannt}}' },
          { type: 'text', text: 'Vorfall: {{input:Vorfall}}' },
        ],
      },
      values,
    );
    expect(filled.content).toEqual([{ type: 'text', text: 'Vorfall: API down' }]);
  });
});
