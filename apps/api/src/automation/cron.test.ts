import { describe, expect, it } from 'vitest';
import { cronMatches, parseCron } from './cron.js';

describe('cron (E-103)', () => {
  it('parses lists, ranges and steps', () => {
    const cron = parseCron('*/15 8-17 * * 1-5');
    expect(cron?.[0]).toEqual(new Set([0, 15, 30, 45]));
    expect(cron?.[4]).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(parseCron('0 8 * *')).toBeNull();
    expect(parseCron('61 * * * *')).toBeNull();
    expect(parseCron('0 0 * * 7')?.[4]?.has(0)).toBe(true);
  });

  it('matches minutes in a time zone', () => {
    const cron = parseCron('0 8 * * 1-5');
    if (!cron) throw new Error('parse');
    // Monday 2 November 2026, 08:00 in Berlin is 07:00 UTC.
    expect(cronMatches(cron, new Date('2026-11-02T07:00:00Z'), 'Europe/Berlin')).toBe(true);
    expect(cronMatches(cron, new Date('2026-11-02T08:00:00Z'), 'Europe/Berlin')).toBe(false);
    // Saturday.
    expect(cronMatches(cron, new Date('2026-10-31T07:00:00Z'), 'Europe/Berlin')).toBe(false);
  });
});
