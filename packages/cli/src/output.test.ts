import { describe, expect, it } from 'vitest';
import { completion } from './completion.js';
import { formatOf, markdownTable, table } from './output.js';

describe('output (D-CLI-06)', () => {
  it('aligns columns and cuts the last one to the width', () => {
    expect(
      table(
        ['KEY', 'SUMMARY'],
        [
          ['WEB-1', 'Login'],
          ['WEB-12', 'x'.repeat(40)],
        ],
        20,
      ).split('\n'),
    ).toEqual(['KEY     SUMMARY', 'WEB-1   Login', `WEB-12  ${'x'.repeat(11)}…`]);
  });

  it('writes Markdown tables and checks the format', () => {
    expect(markdownTable(['A'], [['x|y']])).toBe('| A |\n| --- |\n| x\\|y |');
    expect(formatOf(undefined)).toBe('table');
    expect(() => formatOf('xml')).toThrow();
  });

  it('completes commands and subcommands in every shell', () => {
    expect(completion('zsh')).toContain('issue) compadd list view create edit move comment assign');
    expect(completion('fish')).toContain('complete -c tasklore');
    expect(() => completion('cmd')).toThrow();
  });
});
