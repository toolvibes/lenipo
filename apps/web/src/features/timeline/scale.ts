/** Date arithmetic for the timeline on whole UTC days, so time zones never shift a bar. */

export type Zoom = 'weeks' | 'months' | 'quarters';

/** Pixels per day at each zoom level. */
export const DAY_WIDTH: Record<Zoom, number> = { weeks: 24, months: 6, quarters: 2 };

const MS_PER_DAY = 86_400_000;

/** Days since 1970-01-01 for an ISO date (YYYY-MM-DD). */
export function toDay(iso: string): number {
  return (
    Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) /
    MS_PER_DAY
  );
}

export function fromDay(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Today in the browser's time zone, as a day number. */
export function today(): number {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / MS_PER_DAY;
}

function date(day: number): Date {
  return new Date(day * MS_PER_DAY);
}

function monthStart(year: number, month: number): number {
  return Date.UTC(year, month, 1) / MS_PER_DAY;
}

/** The first day of the week (Monday), month or quarter that contains `day`. */
export function unitStart(day: number, zoom: Zoom): number {
  const value = date(day);
  if (zoom === 'weeks') return day - ((value.getUTCDay() + 6) % 7);
  const month =
    zoom === 'months' ? value.getUTCMonth() : value.getUTCMonth() - (value.getUTCMonth() % 3);
  return monthStart(value.getUTCFullYear(), month);
}

/** The first day of the following week, month or quarter. */
export function nextUnit(day: number, zoom: Zoom): number {
  const start = unitStart(day, zoom);
  if (zoom === 'weeks') return start + 7;
  const value = date(start);
  return monthStart(value.getUTCFullYear(), value.getUTCMonth() + (zoom === 'months' ? 1 : 3));
}

/** ISO 8601 week number. */
export function isoWeek(day: number): number {
  const thursday = day - ((date(day).getUTCDay() + 6) % 7) + 3;
  const year = date(thursday).getUTCFullYear();
  return Math.floor((thursday - Date.UTC(year, 0, 1) / MS_PER_DAY) / 7) + 1;
}

/** Visible range around the given days, padded and aligned to whole units. */
export function visibleRange(days: number[], zoom: Zoom): { start: number; end: number } {
  const pad = zoom === 'weeks' ? 14 : zoom === 'months' ? 45 : 120;
  const min = Math.min(...days) - pad;
  const max = Math.max(...days) + pad;
  return { start: unitStart(min, zoom), end: nextUnit(max, zoom) };
}

export interface Column {
  start: number;
  /** Exclusive. */
  end: number;
  label: string;
  detail: string;
}

/** The header columns from `start` to `end`. */
export function columns(
  start: number,
  end: number,
  zoom: Zoom,
  locale: string,
  weekLabel: (week: number) => string,
): Column[] {
  const month = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' });
  const short = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const result: Column[] = [];
  for (let day = start; day < end; day = nextUnit(day, zoom)) {
    const value = date(day);
    const year = String(value.getUTCFullYear());
    result.push({
      start: day,
      end: nextUnit(day, zoom),
      label:
        zoom === 'weeks'
          ? weekLabel(isoWeek(day))
          : zoom === 'months'
            ? month.format(value)
            : `Q${Math.floor(value.getUTCMonth() / 3) + 1}`,
      detail: zoom === 'weeks' ? short.format(value) : year,
    });
  }
  return result;
}
