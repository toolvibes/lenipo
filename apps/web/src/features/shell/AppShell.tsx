import { House, type Icon, NotePencil, SignOut } from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import type { Me } from '@tasklore/shared';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { initials, presenceColor } from '../../lib/presence';

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

  async function signOut() {
    await api('POST', '/auth/logout');
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
    </div>
  );
}
