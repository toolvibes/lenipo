import { describe, expect, it } from 'vitest';
import { type BusinessHours, workingMillis } from './sla.js';

const HOURS: BusinessHours = {
  timeZone: 'Europe/Berlin',
  dayStartHour: 9,
  hoursPerDay: 8,
  daysPerWeek: 5,
};
const hours = (millis: number) => millis / 3_600_000;

describe('SLA working time (TL-47)', () => {
  it('counts only working hours of working days in the desk time zone', () => {
    // Monday 2026-11-02, 10:00 to 15:30 Berlin time (UTC+1): 5.5 hours.
    expect(
      hours(
        workingMillis(new Date('2026-11-02T09:00:00Z'), new Date('2026-11-02T14:30:00Z'), HOURS),
      ),
    ).toBe(5.5);
    // Friday 16:00 to Monday 10:00: one hour on Friday, one on Monday.
    expect(
      hours(
        workingMillis(new Date('2026-11-06T15:00:00Z'), new Date('2026-11-09T09:00:00Z'), HOURS),
      ),
    ).toBe(2);
  });

  it('leaves out paused intervals and handles daylight saving', () => {
    const paused = [
      { start: new Date('2026-11-02T10:00:00Z'), end: new Date('2026-11-02T12:00:00Z') },
    ];
    expect(
      hours(
        workingMillis(
          new Date('2026-11-02T08:00:00Z'),
          new Date('2026-11-02T16:00:00Z'),
          HOURS,
          paused,
        ),
      ),
    ).toBe(6);
    // Summer time (UTC+2): Monday 2026-06-01 09:00 Berlin is 07:00 UTC.
    expect(
      hours(
        workingMillis(new Date('2026-06-01T07:00:00Z'), new Date('2026-06-01T15:00:00Z'), HOURS),
      ),
    ).toBe(8);
  });
});
