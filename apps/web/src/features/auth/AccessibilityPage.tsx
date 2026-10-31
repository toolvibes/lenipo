import { useTranslation } from 'react-i18next';
import { AuthLayout } from './AuthLayout';

const SECTIONS = ['target', 'checked', 'gaps', 'report'] as const;

/** The accessibility statement (P-GEN-03, TL-43, E-124), public like the sign-in page. */
export function AccessibilityPage() {
  const { t } = useTranslation();
  return (
    <AuthLayout title={t('accessibility.title')} subtitle={t('accessibility.intro')}>
      <div className="flex flex-col gap-5 text-sm leading-relaxed">
        {SECTIONS.map((section) => (
          <section key={section} className="flex flex-col gap-1.5">
            <h2 className="m-0 text-base font-semibold">{t(`accessibility.${section}Title`)}</h2>
            <p className="m-0 whitespace-pre-line">{t(`accessibility.${section}`)}</p>
          </section>
        ))}
        <a href="/" className="text-[var(--accent)]">
          {t('accessibility.back')}
        </a>
      </div>
    </AuthLayout>
  );
}
