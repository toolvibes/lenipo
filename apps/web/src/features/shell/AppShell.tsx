import { House, type Icon, MagnifyingGlass, NotePencil, SignOut } from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import type { Me } from '@tasklore/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client } from '../../lib/api';
import { initials, presenceColor } from '../../lib/presence';
import { CommandPalette } from './CommandPalette';

function NavItem({ to, icon: IconComponent, label }: { to: string; icon: Icon; label: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: true }}
      className="flex h-8 items-center gap-2.5 rounded-[var(--radius-md)] px-2 text-[var(--ink)] no-underline hover:bg-[var(--surface-1)] data-[status=active]:bg-[var(--accent-soft)] data-[status=active]:font-semibold data-[status=active]:text-[var(--accent)]"
    >
      {({ isActive }) => (
        <>
          <IconComponent size={20} weight={isActive ? 'fill' : 'regular'} aria-hidden />
          {label}
        </>
      )}
    </Link>
  );
}

/** Sidebar layout of the signed-in app (design: Sprint-Board artboard). */
export function AppShell({ me }: { me: Me }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

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

  async function signOut() {
    await client.POST('/api/v1/auth/logout');
    queryClient.clear();
    await navigate({ to: '/login' });
  }

  return (
    <div className="flex min-h-screen flex-wrap">
      <nav
        aria-label={t('shell.navigation')}
        className="flex max-w-full flex-[1_1_var(--sidebar-width)] flex-col gap-4 border-r border-[var(--border)] bg-[var(--surface-2)] px-3 py-4 md:max-w-[var(--sidebar-width)]"
      >
        <span className="px-2 font-[family-name:var(--font-serif)] text-[22px] leading-7 font-semibold">
          {t('common.product')}
        </span>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex h-8 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-left text-[var(--ink-muted)] hover:text-[var(--ink)]"
        >
          <MagnifyingGlass size={16} aria-hidden />
          <span className="flex-1">{t('shell.search')}</span>
          <kbd className="tl-key text-xs">{isMac ? '⌘K' : t('shell.paletteShortcut')}</kbd>
        </button>
        <div className="flex flex-col gap-0.5">
          <NavItem to="/" icon={House} label={t('shell.home')} />
          <NavItem to="/pages/spike" icon={NotePencil} label={t('shell.testPage')} />
        </div>
        <div className="mt-auto flex items-center gap-2 px-2">
          <span
            className="grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white"
            style={{ backgroundColor: presenceColor(me.id) }}
            aria-hidden
          >
            {initials(me.displayName)}
          </span>
          <span
            className="min-w-0 flex-1 truncate"
            title={t('shell.signedInAs', { name: me.email })}
          >
            {me.displayName}
          </span>
          <button
            type="button"
            onClick={signOut}
            aria-label={t('common.signOut')}
            title={t('common.signOut')}
            className="grid size-8 place-items-center rounded-[var(--radius-md)] text-[var(--ink-muted)] hover:bg-[var(--surface-1)] hover:text-[var(--ink)]"
          >
            <SignOut size={18} aria-hidden />
          </button>
        </div>
      </nav>
      <div className="min-w-0 flex-[999_1_560px]">
        <Outlet />
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onSignOut={signOut} />
    </div>
  );
}
