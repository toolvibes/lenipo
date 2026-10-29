import { describe, expect, it } from 'vitest';
import { formatDuration, parseDuration } from './duration.js';

describe('parseDuration', () => {
  it('reads weeks, days, hours and minutes with the working time', () => {
    expect(parseDuration('1w 2d 3h 30m')).toBe((40 + 16 + 3) * 3600 + 30 * 60);
    expect(parseDuration('2h30m')).toBe(2.5 * 3600);
    expect(parseDuration('1,5h')).toBe(1.5 * 3600);
    expect(parseDuration('90')).toBe(90 * 60);
    expect(parseDuration(' 1D ')).toBe(8 * 3600);
    expect(parseDuration('1d', { hoursPerDay: 7.5, daysPerWeek: 5 })).toBe(7.5 * 3600);
    expect(parseDuration('1w', { hoursPerDay: 6, daysPerWeek: 4 })).toBe(24 * 3600);
  });

  it('rejects anything else', () => {
    for (const text of ['', 'soon', '2 hours', '1x', '0m', '-1h', '1h foo']) {
      expect(parseDuration(text), text).toBeUndefined();
    }
  });
});

describe('formatDuration', () => {
  it('writes the largest units first', () => {
    expect(formatDuration((40 + 16 + 3) * 3600 + 30 * 60)).toBe('1w 2d 3h 30m');
    expect(formatDuration(9 * 3600)).toBe('1d 1h');
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(7.5 * 3600, { hoursPerDay: 7.5, daysPerWeek: 5 })).toBe('1d');
  });

  it('round-trips with parseDuration', () => {
    for (const text of ['1w 2d 3h 30m', '45m', '3d 4h']) {
      expect(formatDuration(parseDuration(text) ?? 0)).toBe(text);
    }
  });
});
