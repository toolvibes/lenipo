/** Hour (0–23) and weekday (1 = Monday … 7 = Sunday) of a moment in a time zone. */
export function localTime(at: Date, timeZone: string): { hour: number; weekday: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hourCycle: 'h23',
      weekday: 'short',
    }).formatToParts(at);
  } catch {
    // An unknown zone stored long ago: fall back to UTC rather than skipping the person.
    return localTime(at, 'UTC');
  }
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0) % 24;
  const name = parts.find((part) => part.type === 'weekday')?.value ?? 'Mon';
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(name) + 1;
  return { hour, weekday: weekday || 1 };
}
