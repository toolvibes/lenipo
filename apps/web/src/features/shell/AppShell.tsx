import { List, MagnifyingGlass, X } from '@phosphor-icons/react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import type { Me } from '@toolvibes/shared';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client } from '../../lib/api';
import { meQuery } from '../../lib/queries';
import { startRealtime, stopRealtime } from '../../lib/realtime';
import { CurrentProjectProvider, ShortcutListener } from '../../lib/shortcuts';
import { LogoMark } from '../../ui/Logo';
import { Announcement } from './Announcement';
import { CommandPalette } from './CommandPalette';
import { GlobalShortcuts } from './Shortcuts';
import { Sidebar } from './Sidebar';

/** Layout of the signed-in app: the fixed sidebar of direction 1a beside the page (E-67). */
export function AppShell({ me: signedIn }: { me: Me }) {
  // The cache, not the route context: profile changes (name, shortcuts) apply at once.
  const me = useQuery(meQuery).data ?? signedIn;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [projectKey, setProjectKey] = useState<string | null>(null);
  const currentProject = useMemo(() => ({ key: projectKey, set: setProjectKey }), [projectKey]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Live signals for the bell, boards and issues while signed in (E-58).
  useEffect(() => startRealtime(queryClient), [queryClient]);

  async function signOut() {
    stopRealtime();
    await client.POST('/api/v1/auth/logout');
    queryClient.clear();
    await navigate({ to: '/login' });
  }

  const { t } = useTranslation();
  const narrow = useNarrow();
  const [menuOpen, setMenuOpen] = useState(false);
  const path = useRouterState({ select: (state) => state.location.pathname });
  // The drawer closes when a link in it was followed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on every navigation
  useEffect(() => setMenuOpen(false), [path]);
  const sidebar = (
    <Sidebar
      me={me}
      onSearch={() => {
        setMenuOpen(false);
        setPaletteOpen(true);
      }}
      onSignOut={signOut}
    />
  );

  return (
    <CurrentProjectProvider value={currentProject}>
      {/* The first stop for keyboard users: past the navigation (WCAG 2.4.1, TL-43). */}
      <a
        href="#main"
        className="sr-only z-50 rounded-[var(--radius-sm)] bg-[var(--surface-1)] px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('shell.skipToContent')}
      </a>
      {narrow && (
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 bg-[var(--surface-2)] px-2">
          <RadixDialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <RadixDialog.Trigger
              className="grid size-9 place-items-center rounded-[var(--radius-sm)]"
              aria-label={t('shell.openMenu')}
            >
              <List size={20} aria-hidden />
            </RadixDialog.Trigger>
            <RadixDialog.Portal>
              <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
              <RadixDialog.Content
                aria-describedby={undefined}
                className="fixed inset-y-0 left-0 z-50 flex w-[min(300px,85vw)] flex-col overflow-y-auto bg-[var(--surface-2)] shadow-[var(--shadow-float)]"
              >
                <RadixDialog.Title className="sr-only">{t('shell.navigation')}</RadixDialog.Title>
                <RadixDialog.Close
                  className="absolute top-3 right-3 grid size-8 place-items-center rounded-[var(--radius-sm)]"
                  aria-label={t('shell.closeMenu')}
                >
                  <X size={18} aria-hidden />
                </RadixDialog.Close>
                {sidebar}
              </RadixDialog.Content>
            </RadixDialog.Portal>
          </RadixDialog.Root>
          <span className="flex flex-1 items-center gap-2 text-[15px] font-bold">
            <LogoMark size={20} />
            {t('common.product')}
          </span>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-[var(--radius-sm)]"
            aria-label={t('sidebar.search')}
            onClick={() => setPaletteOpen(true)}
          >
            <MagnifyingGlass size={20} aria-hidden />
          </button>
        </header>
      )}
      <div className="flex min-h-screen flex-wrap bg-[var(--surface-2)]">
        {!narrow && sidebar}
        {/* The work area floats as a white panel next to the sidebar; overflow-clip keeps sticky bars working. */}
        <div
          id="main"
          tabIndex={-1}
          className="min-w-0 flex-[999_1_560px] bg-[var(--surface-0)] outline-none md:my-2.5 md:mr-2.5 md:min-h-[calc(100vh-20px)] md:overflow-clip md:rounded-[var(--radius-xl)] md:shadow-[var(--shadow-panel)] print:m-0 print:shadow-none"
        >
          <Announcement />
          <Outlet />
        </div>
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onSignOut={signOut} />
        <ShortcutListener enabled={me.keyboardShortcuts} />
        <GlobalShortcuts me={me} onPalette={() => setPaletteOpen(true)} />
      </div>
    </CurrentProjectProvider>
  );
}

/** Below 768 px the sidebar moves into a drawer behind a top bar (TL-43, E-124). */
function useNarrow(): boolean {
  const query = '(max-width: 767px)';
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const change = () => setNarrow(list.matches);
    list.addEventListener('change', change);
    return () => list.removeEventListener('change', change);
  }, []);
  return narrow;
}
