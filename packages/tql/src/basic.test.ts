import { describe, expect, it } from 'vitest';
import {
  CURRENT_USER,
  emptyBasicQuery,
  fromBasic,
  NO_VALUE,
  nextSort,
  primarySort,
  toBasic,
  withSort,
} from './basic.js';

describe('basic search', () => {
  it('reads click-filter queries', () => {
    const basic = toBasic(
      'project = WEB AND status in ("In Arbeit", Review) AND assignee = currentUser() AND text ~ "login fehler" ORDER BY priority DESC, updated',
    );
    expect(basic).toEqual({
      values: {
        project: ['WEB'],
        issuetype: [],
        status: ['In Arbeit', 'Review'],
        assignee: [CURRENT_USER],
        priority: [],
      },
      text: 'login fehler',
      orderBy: 'ORDER BY priority DESC, updated',
    });
  });

  it('accepts aliases, nested AND and unassigned', () => {
    expect(toBasic('(type = Bug AND assignee is EMPTY)')?.values).toMatchObject({
      issuetype: ['Bug'],
      assignee: [NO_VALUE],
    });
    expect(toBasic('')).toEqual(emptyBasicQuery());
  });

  it('refuses everything the click filters cannot show', () => {
    for (const query of [
      'project = WEB OR project = APP',
      'NOT status = Done',
      'status != Done',
      'labels = frontend',
      'project = WEB AND project = APP',
      'reporter = currentUser()',
      'assignee is not EMPTY',
      'status = "EMPTY"',
      'project = ',
    ]) {
      expect(toBasic(query), query).toBeNull();
    }
  });

  it('writes TQL that reads back the same', () => {
    const basic = emptyBasicQuery();
    basic.values.project = ['WEB'];
    basic.values.status = ['In Arbeit', 'Done'];
    basic.values.assignee = [CURRENT_USER, 'mira@example.org'];
    basic.text = 'Token "refresh"';
    basic.orderBy = 'ORDER BY created DESC';
    const query = fromBasic(basic);
    expect(query).toBe(
      'project = WEB AND status in ("In Arbeit", Done) AND assignee in (currentUser(), mira@example.org) AND text ~ "Token \\"refresh\\"" ORDER BY created DESC',
    );
    expect(toBasic(query)).toEqual(basic);
  });

  it('drops "unassigned" when people are chosen too', () => {
    const basic = emptyBasicQuery();
    basic.values.assignee = [NO_VALUE];
    expect(fromBasic(basic)).toBe('assignee is EMPTY');
    basic.values.assignee = [NO_VALUE, CURRENT_USER];
    expect(fromBasic(basic)).toBe('assignee = currentUser()');
  });
});

describe('sorting', () => {
  it('replaces or adds the ORDER BY and keeps the rest as written', () => {
    expect(withSort('project = WEB  ORDER BY rank', { field: 'created', direction: 'desc' })).toBe(
      'project = WEB  ORDER BY created DESC',
    );
    expect(withSort('status = Done', { field: 'priority', direction: 'asc' })).toBe(
      'status = Done ORDER BY priority ASC',
    );
    expect(withSort('', { field: 'key', direction: 'asc' })).toBe('ORDER BY key ASC');
    expect(withSort('status = ', { field: 'key', direction: 'asc' })).toBeNull();
  });

  it('reads the first key by canonical name and flips on the second click', () => {
    expect(primarySort('ORDER BY type DESC, key')).toEqual({
      field: 'issuetype',
      direction: 'desc',
    });
    expect(primarySort('project = WEB')).toBeNull();
    expect(nextSort({ field: 'key', direction: 'asc' }, 'key')).toEqual({
      field: 'key',
      direction: 'desc',
    });
    expect(nextSort({ field: 'key', direction: 'desc' }, 'created')).toEqual({
      field: 'created',
      direction: 'asc',
    });
  });
});
