import { describe, expect, it } from 'vitest';
import { applySuggestion, completionContext, quoteValue, staticSuggestions } from './complete.js';

/** Suggestions at the position of `|` in the text. */
function at(textWithCursor: string) {
  const cursor = textWithCursor.indexOf('|');
  const text = textWithCursor.replace('|', '');
  const context = completionContext(text, cursor);
  return { context, labels: staticSuggestions(context).map((suggestion) => suggestion.label) };
}

describe('completion', () => {
  it('offers fields, NOT, parentheses and ORDER BY at the start', () => {
    const { labels, context } = at('|');
    expect(labels).toContain('project');
    expect(labels).toContain('assignee');
    expect(labels).not.toContain('rank');
    expect(labels).toEqual(expect.arrayContaining(['NOT', '(', 'ORDER BY']));
    expect(context.value).toBeUndefined();
  });

  it('filters fields by the typed prefix, including aliases', () => {
    expect(at('sta|').labels).toEqual(['status', 'statusCategory', 'startDate']);
    expect(at('ty|').labels).toEqual(['issuetype']);
    const { context } = at('project = WEB AND sta|');
    expect(context).toMatchObject({ from: 18, to: 21, prefix: 'sta' });
  });

  it('offers the operators of the field', () => {
    expect(at('status |').labels).toEqual([
      '=',
      '!=',
      'IN',
      'NOT IN',
      'WAS',
      'WAS NOT',
      'WAS IN',
      'WAS NOT IN',
      'CHANGED',
    ]);
    expect(at('assignee i|').labels).toEqual(['IN', 'IS', 'IS NOT']);
    expect(at('summary |').labels).toEqual(['~', '!~']);
    expect(at('status not |').labels).toEqual(['IN']);
    expect(at('resolution is |').labels).toEqual(['NOT', 'EMPTY']);
  });

  it('asks for stored values and offers fitting functions and EMPTY', () => {
    const status = at('status = |');
    expect(status.context.value).toMatchObject({ field: { id: 'status' }, operator: '=' });
    expect(status.labels).toEqual([]);

    const assignee = at('assignee = cur|');
    expect(assignee.context.value?.field.id).toBe('assignee');
    expect(assignee.context.prefix).toBe('cur');
    expect(assignee.labels).toEqual(['currentUser()']);
    expect(at('assignee = |').labels).toEqual(['currentUser()', 'EMPTY']);
    expect(at('assignee in |').labels).toEqual(['(', 'currentUser()', 'membersOf()', 'agents()']);
    expect(at('created > start|').labels).toContain('startOfWeek()');
    expect(at('key in |').labels).toEqual(['(', 'linkedIssues()', 'issueHistory()']);
    expect(at('comp|').labels).toEqual(['component']);
  });

  it('continues inside lists and quoted values', () => {
    const list = at('status in (Open, |');
    expect(list.context.value?.field.id).toBe('status');
    const quoted = at('status = "In Ar|');
    expect(quoted.context).toMatchObject({ prefix: 'In Ar', from: 9, to: 15 });
    expect(quoted.context.value?.field.id).toBe('status');
    expect(at('status in (Open|').context.value?.field.id).toBe('status');
    expect(at('status in (Open |').labels).toEqual([',', ')']);
  });

  it('offers connectives and ORDER BY after a complete clause', () => {
    expect(at('status = Open |').labels).toEqual(['AND', 'OR', 'ORDER BY']);
    expect(at('status = Open o|').labels).toEqual(['OR', 'ORDER BY']);
    expect(at('(status = Open |').labels).toEqual(['AND', 'OR', ')']);
  });

  it('offers orderable fields and directions after ORDER BY', () => {
    const fields = at('status = Open ORDER BY |').labels;
    expect(fields).toContain('rank');
    expect(fields).not.toContain('text');
    expect(at('ORDER BY created |').labels).toEqual(['ASC', 'DESC', ',']);
  });

  it('suggests nothing after a syntax error', () => {
    expect(at('status Open AND |').labels).toEqual([]);
  });

  it('ignores the text behind the cursor', () => {
    expect(at('sta| = Open').labels).toEqual(['status', 'statusCategory', 'startDate']);
  });
});

describe('quoteValue', () => {
  it('quotes only when needed', () => {
    expect(quoteValue('WEB')).toBe('WEB');
    expect(quoteValue('mira@example.com')).toBe('mira@example.com');
    expect(quoteValue('In Arbeit')).toBe('"In Arbeit"');
    expect(quoteValue('Done')).toBe('Done');
    expect(quoteValue('empty')).toBe('"empty"');
    expect(quoteValue('say "hi"')).toBe('"say \\"hi\\""');
  });
});

describe('applySuggestion', () => {
  it('replaces the partial word and adds a space', () => {
    const text = 'project = WEB AND sta';
    const context = completionContext(text, text.length);
    expect(applySuggestion(text, context, 'status')).toEqual({
      text: 'project = WEB AND status ',
      cursor: 25,
    });
  });

  it('leaves the cursor inside an opened function call', () => {
    const text = 'assignee in mem';
    const context = completionContext(text, text.length);
    expect(applySuggestion(text, context, 'membersOf(')).toEqual({
      text: 'assignee in membersOf(',
      cursor: 22,
    });
  });
});
