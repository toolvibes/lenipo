import { List, MagnifyingGlass, X } from '@phosphor-icons/react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import type { Me } from '@toolvibes/shared';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client } from '../../lib/api';
import { meQuery } from '../../lib/queries';
import { startRealtime, stopRealtime } from '../../lib/realtime';
import {
  CurrentProjectProvider,
  ShortcutListener,
  useSetCurrentProject,
} from '../../lib/shortcuts';
import { LogoMark } from '../../ui/Logo';
import { Announcement } from './Announcement';
import { AreaMenu } from './AreaMenu';
import { CommandPalette } from './CommandPalette';
import { GlobalShortcuts } from './Shortcuts';
import { AccountMenu, AreaTabs, NotificationsButton, TopNav } from './TopNav';
import { useNav } from './useNav';

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
  const shellProps = {
    me,
    path,
    narrow,
    menuOpen,
    setMenuOpen,
    onSearch: () => {
      setMenuOpen(false);
      setPaletteOpen(true);
    },
    onSignOut: signOut,
  };

  return (
    <CurrentProjectProvider value={currentProject}>
      {/* The first stop for keyboard users: past the navigation (WCAG 2.4.1, TL-43). */}
      <a
        href="#main"
        className="sr-only z-50 rounded-[var(--radius-sm)] bg-[var(--surface-1)] px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('shell.skipToContent')}
      </a>
      <Frame {...shellProps} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onSignOut={signOut} />
      <ShortcutListener enabled={me.keyboardShortcuts} />
      <GlobalShortcuts me={me} onPalette={() => setPaletteOpen(true)} />
    </CurrentProjectProvider>
  );
}

/**
 * Top bar over the full width with the areas, the menu of the active area on the left and the
 * page as a white panel (design "Neue Navigation"). Below 768 px a compact bar and a drawer.
 */
function Frame({
  me,
  path,
  narrow,
  menuOpen,
  setMenuOpen,
  onSearch,
  onSignOut,
}: {
  me: Me;
  path: string;
  narrow: boolean;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  onSearch: () => void;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();
  const nav = useNav();
  const setCurrent = useSetCurrentProject();
  // The project of the page becomes the current one (create issue, project tab).
  useEffect(() => {
    if (nav.projectKey) setCurrent(nav.projectKey);
  }, [nav.projectKey, setCurrent]);
  return (
    <div className="flex min-h-screen flex-col bg-[var(--surface-2)]">
      {narrow ? (
        <header className="sticky top-0 z-30 flex h-[var(--sticky-top)] items-center gap-1 bg-[var(--surface-2)] px-2">
          <RadixDialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <RadixDialog.Trigger
              className="grid size-9 place-items-center rounded-[var(--radius-md)]"
              aria-label={t('shell.openMenu')}
            >
              <List size={20} aria-hidden />
            </RadixDialog.Trigger>
            <RadixDialog.Portal>
              <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
              <RadixDialog.Content
                aria-describedby={undefined}
                className="fixed inset-y-0 left-0 z-50 flex w-[min(300px,85vw)] flex-col gap-4 overflow-y-auto bg-[var(--surface-2)] p-3 pt-12 shadow-[var(--shadow-float)]"
              >
                <RadixDialog.Title className="sr-only">{t('shell.navigation')}</RadixDialog.Title>
                <RadixDialog.Close
                  className="absolute top-3 right-3 grid size-8 place-items-center rounded-[var(--radius-md)]"
                  aria-label={t('shell.closeMenu')}
                >
                  <X size={18} aria-hidden />
                </RadixDialog.Close>
                <AreaTabs nav={nav} vertical />
                <div className="h-px bg-[var(--border)]" />
                <AreaMenu nav={nav} me={me} inDrawer />
              </RadixDialog.Content>
            </RadixDialog.Portal>
          </RadixDialog.Root>
          <Link
            to="/"
            className="flex flex-1 items-center gap-2 text-[15px] font-bold text-[var(--ink)] no-underline"
          >
            <LogoMark size={22} />
            {t('common.product')}
          </Link>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-[var(--radius-md)]"
            aria-label={t('sidebar.search')}
            onClick={onSearch}
          >
            <MagnifyingGlass size={20} aria-hidden />
          </button>
          <NotificationsButton active={path === '/notifications'} />
          <AccountMenu me={me} onSignOut={onSignOut} />
        </header>
      ) : (
        <TopNav me={me} nav={nav} path={path} onSearch={onSearch} onSignOut={onSignOut} />
      )}
      <div className="flex flex-1">
        {!narrow && <AreaMenu nav={nav} me={me} />}
        {/* The page lies in a white panel on the base, 10 px from the right and bottom; overflow-clip keeps sticky bars working. */}
        <div
          id="main"
          tabIndex={-1}
          className="min-w-0 flex-1 bg-[var(--surface-0)] outline-none md:mr-2.5 md:mb-2.5 md:min-h-[calc(100vh-var(--topbar-height)-10px)] md:overflow-clip md:rounded-[var(--radius-xl)] md:shadow-[var(--shadow-panel)] print:m-0 print:shadow-none"
        >
          <Announcement />
          <Outlet />
        </div>
      </div>
    </div>
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
