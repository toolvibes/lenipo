export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'lenipo.theme';

/** Per-browser preference; "system" follows the operating system via prefers-color-scheme. */
export function readTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(theme: ThemePreference): void {
  if (theme === 'system') {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not persisted; the choice still applies until reload.
  }
}
