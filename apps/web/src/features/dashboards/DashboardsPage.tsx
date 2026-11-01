import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { DashboardSummary, Me } from '@toolvibes/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dashboardsQuery } from '../../lib/dashboards';
import { formatRelative } from '../../lib/format';
import { Button } from '../../ui/Button';
import { TopBar } from '../../ui/TopBar';
import { DashboardDialog } from './DashboardDialog';

function List({ title, dashboards }: { title: string; dashboards: DashboardSummary[] }) {
  const { t } = useTranslation();
  if (dashboards.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="m-0 text-base font-semibold">{title}</h2>
      <ul className="m-0 flex max-w-[860px] list-none flex-col p-0">
        {dashboards.map((dashboard) => (
          <li
            key={dashboard.id}
            className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] py-2.5 text-[13.5px]"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <Link
                to="/dashboards/$id"
                params={{ id: dashboard.id }}
                className="font-semibold text-[var(--ink)] no-underline hover:underline"
              >
                {dashboard.name}
              </Link>
              {dashboard.description && (
                <span className="truncate text-xs text-[var(--ink-muted)]">
                  {dashboard.description}
                </span>
              )}
            </span>
            {dashboard.home && (
              <span className="rounded-[var(--radius-sm)] bg-[var(--accent-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
                {t('dashboards.startPage')}
              </span>
            )}
            <span className="text-xs text-[var(--ink-muted)]">
              {dashboard.owner.displayName} · {formatRelative(dashboard.updatedAt)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Own and shared dashboards (TL-20, E-101). */
export function DashboardsPage({ me }: { me: Me }) {
  const { t } = useTranslation();
  const dashboards = useQuery(dashboardsQuery());
  const [creating, setCreating] = useState(false);
  const all = dashboards.data ?? [];
  return (
    <>
      <TopBar
        crumbs={[t('dashboards.title')]}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            {t('dashboards.create')}
          </Button>
        }
      />
      <main className="flex max-w-[960px] flex-col gap-6 px-10 py-6">
        <header className="flex flex-col gap-1">
          <h1 className="m-0 text-[26px] leading-tight font-semibold tracking-[-0.015em]">
            {t('dashboards.title')}
          </h1>
          <p className="m-0 text-[var(--ink-muted)]">{t('dashboards.intro')}</p>
        </header>
        {dashboards.data && all.length === 0 && (
          <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('dashboards.none_yet')}</p>
        )}
        <List
          title={t('dashboards.mine')}
          dashboards={all.filter((dashboard) => dashboard.owner.id === me.id)}
        />
        <List
          title={t('dashboards.sharedWithMe')}
          dashboards={all.filter((dashboard) => dashboard.owner.id !== me.id)}
        />
      </main>
      <DashboardDialog
        open={creating}
        onOpenChange={setCreating}
        canShare={me.globalPermissions.includes('share-filters')}
      />
    </>
  );
}
