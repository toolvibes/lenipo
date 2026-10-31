import { describe, expect, it } from 'vitest';
import { render } from './smart-values.js';

const context = {
  timeZone: 'Europe/Berlin',
  values: {
    now: new Date('2026-10-31T10:00:00Z'),
    issue: {
      key: 'WEB-7',
      summary: 'Login',
      dueDate: '2026-11-03',
      assignee: { displayName: 'Mira Kaya' },
      reporter: null,
      labels: ['ui', 'seo'],
      status: { name: 'In Arbeit' },
    },
  },
};

describe('smart values (E-103)', () => {
  it('reads paths and names objects', () => {
    expect(render('{{issue.key}}: {{issue.summary}} ({{issue.status.name}})', context)).toBe(
      'WEB-7: Login (In Arbeit)',
    );
    expect(render('{{issue.assignee}} / {{issue.reporter.displayName}}', context)).toBe(
      'Mira Kaya / ',
    );
    expect(render('{{issue.labels}} {{issue.labels.size}}', context)).toBe('ui, seo 2');
  });

  it('calculates with dates in the time zone', () => {
    expect(render('{{now}}', context)).toBe('2026-10-31');
    expect(render('{{now.plusDays(3)}}', context)).toBe('2026-11-03');
    expect(render('{{issue.dueDate.minusDays(1)}}', context)).toBe('2026-11-02');
    expect(render('{{now.plusMonths(2)}}', context)).toBe('2026-12-31');
    expect(render('{{now.toDateTime}}', context)).toBe('2026-10-31T10:00:00.000Z');
  });

  it('ignores what it does not know, without running code', () => {
    expect(render('{{issue.nothing.here}}|{{constructor}}|{{x(}}|{{ }}', context)).toBe('|||');
    expect(render('{{issue.summary.upperCase}} {{issue.key.lowerCase()}}', context)).toBe(
      'LOGIN web-7',
    );
  });
});
