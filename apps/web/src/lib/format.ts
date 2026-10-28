import i18n from '../i18n';

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
    new Date(`${isoDate}T00:00:00`),
  );
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['minute', 60],
  ['hour', 60 * 60],
  ['day', 24 * 60 * 60],
];

/** "vor 3 Minuten" for the last week, then an absolute date (design: Sprache und Ton). */
export function formatRelative(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  if (Math.abs(seconds) >= 7 * 24 * 60 * 60) return formatDateTime(iso);
  const format = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' });
  if (Math.abs(seconds) < 60) return format.format(0, 'minute');
  const [unit, size] = [...UNITS].reverse().find(([, length]) => Math.abs(seconds) >= length) ??
    UNITS[0] ?? ['minute', 60];
  return format.format(Math.round(seconds / size), unit);
}
