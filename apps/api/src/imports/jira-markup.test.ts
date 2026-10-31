import { describe, expect, it } from 'vitest';
import { jiraToMarkdown } from './jira-markup.js';

describe('Jira wiki markup (TL-35)', () => {
  it('converts headings, emphasis, lists, links and code', () => {
    const markup = [
      'h2. Ziel',
      'Das ist *wichtig* und _betont_, siehe [Doku|https://example.org] und {{npm test}}.',
      '* eins',
      '** zwei',
      '# erstens',
      '{code:java}',
      'int a = *1*;',
      '{code}',
      '||Feld||Wert||',
      '|a|b|',
      'bq. Zitat [~lena]',
    ].join('\n');
    expect(jiraToMarkdown(markup)).toBe(
      [
        '## Ziel',
        'Das ist **wichtig** und *betont*, siehe [Doku](https://example.org) und `npm test`.',
        '- eins',
        '  - zwei',
        '1. erstens',
        '```java',
        'int a = *1*;',
        '```',
        '| Feld | Wert |',
        '| --- | --- |',
        '| a | b |',
        '> Zitat @lena',
      ].join('\n'),
    );
  });

  it('keeps other text as it is', () => {
    expect(jiraToMarkdown('Version 1.2-beta, 3*4 und snake_case_name')).toBe(
      'Version 1.2-beta, 3*4 und snake_case_name',
    );
    expect(jiraToMarkdown(null)).toBe('');
  });
});
