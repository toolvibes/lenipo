/** Presence colors from the design system (`presence-1` … `presence-6`); white text on each passes AA. */
const PRESENCE_COLORS = ['#b3372b', '#9c4a00', '#2d6b2d', '#0d6475', '#4a4fb0', '#953374'];

/** Stable color per person, so the same user has the same caret color everywhere. */
export function presenceColor(userId: string): string {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length] ?? '#0d6475';
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const letters =
    parts.length > 1 ? `${parts[0]?.[0] ?? ''}${parts.at(-1)?.[0] ?? ''}` : name.slice(0, 2);
  return letters.toUpperCase();
}
