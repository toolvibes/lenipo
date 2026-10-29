import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** Centered card for sign-in and setup, on the page ground. */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-screen items-start justify-center px-4 py-16 sm:items-center">
      <div className="flex w-full max-w-[420px] flex-col gap-6">
        <span className="text-[26px] leading-[34px] font-semibold tracking-[-0.02em]">
          {t('common.product')}
        </span>
        <section className="flex flex-col gap-5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-6">
          <h1 className="tl-heading-lg">{title}</h1>
          {children}
        </section>
      </div>
    </main>
  );
}
