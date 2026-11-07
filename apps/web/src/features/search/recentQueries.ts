const KEY = 'lenipo.search.recent';
const MAX = 5;

/** The last queries searched in this browser, newest first; a convenience, so failures are ignored. */
export function recentQueries(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter((entry): entry is string => typeof entry === 'string').slice(0, MAX);
  } catch {
    return [];
  }
}

export function rememberQuery(query: string): void {
  const text = query.trim();
  if (!text) return;
  try {
    const next = [text, ...recentQueries().filter((entry) => entry !== text)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private windows may refuse storage; the list then simply stays as it was.
  }
}
