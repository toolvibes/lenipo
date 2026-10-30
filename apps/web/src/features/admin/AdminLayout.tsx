import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

const PAGES = [
  { to: '/admin/webhooks', label: 'webhooks.title' },
  { to: '/admin/custom-fields', label: 'fields.title' },
  { to: '/admin/time-tracking', label: 'time.settingsTitle' },
  { to: '/admin/templates', label: 'templates.globalTitle' },
] as const;

/** Administration with its own sub-navigation beside the page (1a S11). */
export function AdminLayout() {
  const { t } = useTranslation();
  const path = useRouterState({ select: (state) => state.location.pathname });
  return (
    <div className="flex min-h-full flex-wrap">
      <nav
        aria-label={t('webhooks.admin')}
        className="flex w-full flex-col gap-px border-b border-[var(--border)] px-3 py-6 md:w-[220px] md:border-r md:border-b-0"
      >
        <span className="tl-label px-2.5 pb-1.5 text-[var(--ink-muted)]">
          {t('webhooks.admin')}
        </span>
        {PAGES.map((page) => {
          const active = path === page.to || path.startsWith(`${page.to}/`);
          return (
            <Link
              key={page.to}
              to={page.to}
              aria-current={active ? 'page' : undefined}
              className={`flex h-[30px] items-center rounded-[5px] px-2.5 text-[13px] no-underline hover:bg-[var(--selected)] hover:text-[var(--ink)] ${
                active
                  ? 'bg-[var(--selected)] font-semibold text-[var(--ink)]'
                  : 'font-medium text-[var(--ink-muted)]'
              }`}
            >
              {t(page.label)}
            </Link>
          );
        })}
      </nav>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
