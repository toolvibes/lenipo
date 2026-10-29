/** Length of a working day and week, used for "d" and "w" in durations (T-TIM-01). */
export interface WorkingTime {
  hoursPerDay: number;
  daysPerWeek: number;
}

export const DEFAULT_WORKING_TIME: WorkingTime = { hoursPerDay: 8, daysPerWeek: 5 };

const PART = /(\d+(?:[.,]\d+)?)\s*([wdhm])/gi;

/**
 * Parses "1w 2d 3h 30m", "1.5h", "90m" or "2h30m" into seconds; a bare number means minutes.
 * Returns undefined for anything else, including zero.
 */
export function parseDuration(
  text: string,
  time: WorkingTime = DEFAULT_WORKING_TIME,
): number | undefined {
  const trimmed = text.trim().toLowerCase();
  if (/^\d+$/.test(trimmed)) {
    const minutes = Number(trimmed);
    return minutes > 0 ? minutes * 60 : undefined;
  }
  const unitSeconds = {
    w: time.daysPerWeek * time.hoursPerDay * 3600,
    d: time.hoursPerDay * 3600,
    h: 3600,
    m: 60,
  } as const;
  let seconds = 0;
  let consumed = '';
  for (const match of trimmed.matchAll(PART)) {
    const amount = Number((match[1] ?? '').replace(',', '.'));
    seconds += amount * unitSeconds[(match[2] ?? 'm') as keyof typeof unitSeconds];
    consumed += match[0];
  }
  // Every character but spaces must belong to a part.
  if (!consumed || consumed.replace(/\s/g, '') !== trimmed.replace(/\s/g, '')) return undefined;
  const rounded = Math.round(seconds / 60) * 60;
  return rounded > 0 ? rounded : undefined;
}

/** Formats seconds as "1w 2d 3h 30m" with the given working time; zero is "0m". */
export function formatDuration(seconds: number, time: WorkingTime = DEFAULT_WORKING_TIME): string {
  let minutes = Math.round(Math.abs(seconds) / 60);
  if (minutes === 0) return '0m';
  const units: Array<[string, number]> = [
    ['w', time.daysPerWeek * time.hoursPerDay * 60],
    ['d', time.hoursPerDay * 60],
    ['h', 60],
    ['m', 1],
  ];
  const parts: string[] = [];
  for (const [unit, size] of units) {
    const amount = Math.floor(minutes / size);
    if (amount > 0) {
      parts.push(`${amount}${unit}`);
      minutes -= amount * size;
    }
  }
  return `${seconds < 0 ? '-' : ''}${parts.join(' ')}`;
}
