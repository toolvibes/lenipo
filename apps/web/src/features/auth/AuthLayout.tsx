import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LogoMark } from '../../ui/Logo';
import { LegalLinks } from '../shell/LegalLinks';

const PITCH = ['issues', 'lore', 'linked'] as const;

/** Sign-in and setup (1a S1): the form on the left, what Lenipo offers on the right. */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <main className="flex flex-col px-6 py-10 sm:px-14">
        <span className="flex items-center gap-2.5">
          <LogoMark size={24} />
          <span className="text-base font-bold">{t('common.product')}</span>
        </span>
        <div className="flex w-full max-w-[360px] flex-1 flex-col justify-center gap-6 py-10">
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-[28px] leading-9 font-semibold tracking-[-0.02em]">{title}</h1>
            {subtitle && (
              <p className="m-0 text-sm leading-normal text-[var(--ink-muted)]">{subtitle}</p>
            )}
          </div>
          {children}
        </div>
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          <a href="/accessibility" className="text-xs text-[var(--ink-muted)]">
            {t('accessibility.link')}
          </a>
          <LegalLinks />
        </span>
      </main>
      <aside
        aria-label={t('auth.pitchLabel')}
        className="hidden flex-col justify-center gap-5 border-l border-[var(--border)] bg-[var(--surface-2)] p-14 md:flex"
      >
        <span className="tl-label text-[var(--ink-muted)]">{t('auth.pitchLabel')}</span>
        <h2 className="m-0 text-[22px] leading-7 font-semibold tracking-[-0.015em]">
          {t('auth.pitchTitle')}
        </h2>
        <ul className="m-0 flex max-w-[460px] list-none flex-col gap-2.5 p-0">
          {PITCH.map((item) => (
            <li
              key={item}
              className="flex flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-[18px] py-4"
            >
              <span className="text-[14.5px] font-semibold">{t(`auth.pitch.${item}`)}</span>
              <span className="text-[13px] leading-[1.45] text-[var(--ink-muted)]">
                {t(`auth.pitch.${item}Text`)}
              </span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
