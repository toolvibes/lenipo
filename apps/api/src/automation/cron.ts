/**
 * Five-field cron expressions for scheduled rules (T-AUT-01, E-103): minute, hour, day of
 * month, month, day of week (0 or 7 is Sunday). Lists, ranges and steps; evaluated in a time zone.
 */

const RANGES: [number, number][] = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
];

export type Cron = Set<number>[];

export function parseCron(expression: string): Cron | null {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const result: Cron = [];
  for (const [index, field] of fields.entries()) {
    const [min, max] = RANGES[index] as [number, number];
    const values = new Set<number>();
    for (const part of field.split(',')) {
      const match = /^(\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/.exec(part);
      if (!match) return null;
      const step = match[4] ? Number(match[4]) : 1;
      const from = match[1] === '*' ? min : Number(match[2]);
      const to = match[1] === '*' ? max : match[3] ? Number(match[3]) : match[4] ? max : from;
      if (step < 1 || from < min || to > max || from > to) return null;
      for (let value = from; value <= to; value += step) values.add(value);
    }
    // Sunday is 0 and 7.
    if (index === 4 && values.has(7)) values.add(0);
    result.push(values);
  }
  return result;
}

/** Whether the minute of `date` in the time zone matches. */
export function cronMatches(cron: Cron, date: Date, timeZone: string): boolean {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      minute: 'numeric',
      hour: 'numeric',
      day: 'numeric',
      month: 'numeric',
      weekday: 'short',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday ?? '');
  const values = [
    Number(parts.minute),
    Number(parts.hour),
    Number(parts.day),
    Number(parts.month),
    weekday,
  ];
  return values.every((value, index) => cron[index]?.has(value));
}
