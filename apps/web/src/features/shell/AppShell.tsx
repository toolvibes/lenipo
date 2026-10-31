import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Outlet, useNavigate } from '@tanstack/react-router';
import type { Me } from '@tasklore/shared';
import { useEffect, useMemo, useState } from 'react';
import { client } from '../../lib/api';
import { meQuery } from '../../lib/queries';
import { startRealtime, stopRealtime } from '../../lib/realtime';
import { CurrentProjectProvider, ShortcutListener } from '../../lib/shortcuts';
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

  return (
    <CurrentProjectProvider value={currentProject}>
      <div className="flex min-h-screen flex-wrap">
        <Sidebar me={me} onSearch={() => setPaletteOpen(true)} onSignOut={signOut} />
        <div className="min-w-0 flex-[999_1_560px]">
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
