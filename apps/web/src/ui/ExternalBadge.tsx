import { useTranslation } from 'react-i18next';

/** Marks an external collaborator next to the name (TL-66, E-131). */
export function ExternalBadge() {
  const { t } = useTranslation();
  return (
    <span className="ml-2 inline-flex h-[18px] items-center rounded-[4px] border border-[var(--border-strong)] px-1.5 align-middle text-[11px] font-medium text-[var(--ink-muted)]">
      {t('external.badge')}
    </span>
  );
}
