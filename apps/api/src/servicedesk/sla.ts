/**
 * SLA clocks in working time (TL-47, E-137): working days are Monday and the following days up
 * to `daysPerWeek`, each from `dayStartHour` for `hoursPerDay` hours in the desk's time zone.
 */
export interface BusinessHours {
  timeZone: string;
  dayStartHour: number;
  hoursPerDay: number;
  daysPerWeek: number;
}

export interface Interval {
  start: Date;
  end: Date;
}

const DAY = 86_400_000;

/** Minutes the zone is ahead of UTC at that instant. */
function offsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** The instant a local wall-clock time on a local date happens in the zone. */
function zoned(year: number, month: number, day: number, hour: number, timeZone: string): Date {
  const guess = new Date(Date.UTC(year, month, day, hour));
  const first = new Date(guess.getTime() - offsetMinutes(guess, timeZone) * 60_000);
  // A second pass settles daylight-saving changes between the guess and the result.
  return new Date(guess.getTime() - offsetMinutes(first, timeZone) * 60_000);
}

/** The working windows of every local day that touches the range. */
export function windows(from: Date, to: Date, hours: BusinessHours): Interval[] {
  const result: Interval[] = [];
  const localStart = new Date(from.getTime() + offsetMinutes(from, hours.timeZone) * 60_000);
  let year = localStart.getUTCFullYear();
  let month = localStart.getUTCMonth();
  let day = localStart.getUTCDate() - 1;
  for (let guard = 0; guard < 3700; guard += 1) {
    const date = new Date(Date.UTC(year, month, day));
    year = date.getUTCFullYear();
    month = date.getUTCMonth();
    day = date.getUTCDate();
    // Monday is 1 … Sunday 7.
    const weekday = ((date.getUTCDay() + 6) % 7) + 1;
    const start = zoned(year, month, day, hours.dayStartHour, hours.timeZone);
    if (start.getTime() > to.getTime()) break;
    if (weekday <= hours.daysPerWeek) {
      result.push({ start, end: new Date(start.getTime() + hours.hoursPerDay * 3_600_000) });
    }
    day += 1;
  }
  return result;
}

/** Milliseconds of working time between two instants, minus the paused intervals. */
export function workingMillis(
  from: Date,
  to: Date,
  hours: BusinessHours,
  paused: Interval[] = [],
): number {
  if (to.getTime() <= from.getTime()) return 0;
  let total = 0;
  for (const window of windows(new Date(from.getTime() - DAY), to, hours)) {
    const start = Math.max(window.start.getTime(), from.getTime());
    const end = Math.min(window.end.getTime(), to.getTime());
    if (end <= start) continue;
    total += end - start;
    for (const pause of paused) {
      const pauseStart = Math.max(start, pause.start.getTime());
      const pauseEnd = Math.min(end, pause.end.getTime());
      if (pauseEnd > pauseStart) total -= pauseEnd - pauseStart;
    }
  }
  return total;
}
