import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react';

/**
 * Keyboard shortcuts (T-VIEW-04, E-58): single keys ("c", "/", "?") and two-key sequences
 * ("g b"). One registry drives both the handling and the help dialog.
 */
export interface Shortcut {
  keys: string;
  /** Translation key of the description. */
  label: string;
  group: 'navigation' | 'actions' | 'issue';
  run: () => void;
}

const registered = new Set<Shortcut>();
const listeners = new Set<() => void>();
let version = 0;

function changed() {
  version += 1;
  for (const listener of listeners) listener();
}

/** Registers shortcuts while the calling component is mounted; handlers stay current. */
export function useShortcuts(shortcuts: Shortcut[]): void {
  const latest = useRef(shortcuts);
  latest.current = shortcuts;
  const signature = shortcuts.map((shortcut) => `${shortcut.keys}:${shortcut.label}`).join('|');
  useEffect(() => {
    const entries = signature
      .split('|')
      .filter(Boolean)
      .map((_, index) => ({
        get keys() {
          return latest.current[index]?.keys ?? '';
        },
        get label() {
          return latest.current[index]?.label ?? '';
        },
        get group() {
          return latest.current[index]?.group ?? 'actions';
        },
        run: () => latest.current[index]?.run(),
      }));
    for (const entry of entries) registered.add(entry);
    changed();
    return () => {
      for (const entry of entries) registered.delete(entry);
      changed();
    };
  }, [signature]);
}

/** All shortcuts currently active, for the help dialog. */
export function useRegisteredShortcuts(): Shortcut[] {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
  );
  return [...registered];
}

/** Typing in a field or editor never triggers a shortcut. */
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    target.closest('[role=textbox]') !== null
  );
}

const SEQUENCE_MS = 1000;

/** Listens once for the whole app; place it in the signed-in shell. */
export function ShortcutListener(): null {
  useEffect(() => {
    let prefix: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (typing(event.target)) return;
      // Dialogs and menus own the keyboard while open.
      if (document.querySelector('[role=dialog], [role=menu]')) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const combined = prefix ? `${prefix} ${key}` : key;
      const all = [...registered];
      const exact = all.find((shortcut) => shortcut.keys === combined);
      if (exact) {
        event.preventDefault();
        prefix = null;
        exact.run();
        return;
      }
      if (!prefix && all.some((shortcut) => shortcut.keys.startsWith(`${key} `))) {
        event.preventDefault();
        prefix = key;
        clearTimeout(timer);
        timer = setTimeout(() => {
          prefix = null;
        }, SEQUENCE_MS);
        return;
      }
      prefix = null;
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(timer);
    };
  }, []);
  return null;
}

// ---------------------------------------------------------------- current project

type ProjectSetter = (key: string | null) => void;
const CurrentProject = createContext<{ key: string | null; set: ProjectSetter } | null>(null);

export function CurrentProjectProvider({
  value,
  children,
}: {
  value: { key: string | null; set: ProjectSetter };
  children: ReactNode;
}) {
  return <CurrentProject.Provider value={value}>{children}</CurrentProject.Provider>;
}

/** Tells the shell which project a page is about, e.g. for "c" (create issue). */
export function useCurrentProject(key: string | undefined): void {
  const context = useContext(CurrentProject);
  const set = context?.set;
  useEffect(() => {
    if (!set || !key) return;
    set(key);
  }, [set, key]);
}

export function useCurrentProjectKey(): string | null {
  return useContext(CurrentProject)?.key ?? null;
}
