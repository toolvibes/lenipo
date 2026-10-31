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

/** File sizes in the UI language, e.g. "1,2 MB". */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  return `${new Intl.NumberFormat(i18n.language, { maximumFractionDigits: digits }).format(value)} ${units[unit]}`;
}

/** A search total; above the counting cap it reads "10.000+" (TL-44, E-125). */
export function formatTotal(result: { total: number; totalCapped?: boolean }): string {
  const number = result.total.toLocaleString(document.documentElement.lang || 'de');
  return result.totalCapped ? `${number}+` : number;
}
