import { Link } from '@tanstack/react-router';
import type { Me } from '@tasklore/shared';
import { useTranslation } from 'react-i18next';

export function HomePage({ me }: { me: Me }) {
  const { t } = useTranslation();
  return (
    <main className="flex max-w-3xl flex-col gap-4 px-6 py-8">
      <h1 className="tl-heading-xl">{t('home.title', { name: me.displayName })}</h1>
      <p className="text-[var(--ink-muted)]">{t('home.intro')}</p>
      <Link
        to="/pages/$pageId"
        params={{ pageId: 'spike' }}
        className="inline-flex h-[var(--control-md)] w-fit items-center rounded-[var(--radius-md)] bg-[var(--accent)] px-3 font-semibold text-[var(--on-accent)] no-underline hover:bg-[var(--accent-hover)]"
      >
        {t('home.openTestPage')}
      </Link>
    </main>
  );
}
