import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { noticeQuery } from '../../lib/instance';

/** Imprint and privacy policy of whoever runs the instance (TL-105, E-157); nothing without them. */
export function LegalLinks({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const legal = useQuery(noticeQuery).data?.legal;
  if (!legal?.imprintUrl && !legal?.privacyUrl) return null;
  return (
    <span className={`flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--ink-muted)] ${className}`}>
      {legal.imprintUrl && (
        <a href={legal.imprintUrl} target="_blank" rel="noreferrer" className="text-inherit">
          {t('legal.imprint')}
        </a>
      )}
      {legal.privacyUrl && (
        <a href={legal.privacyUrl} target="_blank" rel="noreferrer" className="text-inherit">
          {t('legal.privacy')}
        </a>
      )}
    </span>
  );
}
