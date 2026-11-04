import { useQuery } from '@tanstack/react-query';
import { docToHtml, markdownToDoc } from '@toolvibes/editor';
import type { InstanceNotice } from '@toolvibes/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { noticeQuery } from '../../lib/instance';

const DISMISSED = 'lenipo.announcement.dismissed';

/** Versions of dismissed banners; an older single value still counts. */
function dismissedVersions(): string[] {
  try {
    const stored = localStorage.getItem(DISMISSED);
    if (!stored) return [];
    const parsed: unknown = stored.startsWith('[') ? JSON.parse(stored) : [stored];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

type Banner = NonNullable<InstanceNotice['announcement']>;

/**
 * The administrators' banner, the provider's notice (TL-106) and, for administrators, a reminder
 * that maintenance mode is on (TL-40). Each banner can be dismissed until it changes.
 */
export function Announcement() {
  const { t } = useTranslation();
  const notice = useQuery(noticeQuery).data;
  const [dismissed, setDismissed] = useState(dismissedVersions);
  const dismiss = (version: string) => {
    const next = [...dismissed.filter((item) => item !== version), version].slice(-10);
    try {
      localStorage.setItem(DISMISSED, JSON.stringify(next));
    } catch {
      // The banner just comes back on the next visit.
    }
    setDismissed(next);
  };
  const banners: { banner: Banner; label?: string }[] = [];
  if (notice?.providerNotice) {
    banners.push({ banner: notice.providerNotice, label: t('operations.providerNotice') });
  }
  if (notice?.announcement) banners.push({ banner: notice.announcement });
  return (
    <>
      {notice?.maintenance.enabled && (
        <div
          role="status"
          className="border-b border-[var(--border)] bg-[var(--warning-soft,var(--surface-2))] px-4 py-1.5 text-[13px]"
        >
          {t('operations.maintenanceActive')}
        </div>
      )}
      {banners
        .filter(({ banner }) => !dismissed.includes(banner.version))
        .map(({ banner, label }) => (
          <div
            key={banner.version}
            role="status"
            className={`flex items-start gap-3 border-b border-[var(--border)] px-4 py-2 text-[13px] ${
              banner.level === 'warning'
                ? 'bg-[var(--warning-soft,var(--surface-2))]'
                : 'bg-[var(--surface-2)]'
            }`}
          >
            {label && <strong className="shrink-0">{label}:</strong>}
            <div
              className="tl-announcement min-w-0 flex-1 [&_p]:m-0"
              // Rendered from Markdown by the editor package, which escapes HTML.
              // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised by docToHtml
              dangerouslySetInnerHTML={{ __html: docToHtml(markdownToDoc(banner.text)) }}
            />
            <button
              type="button"
              className="text-[var(--ink-muted)]"
              aria-label={t('operations.dismiss')}
              onClick={() => dismiss(banner.version)}
            >
              ×
            </button>
          </div>
        ))}
    </>
  );
}

/** Shown instead of the app while non-administrators are locked out (TL-40). */
export function MaintenanceScreen() {
  const { t } = useTranslation();
  const notice = useQuery(noticeQuery).data;
  return (
    <main className="mx-auto flex min-h-screen max-w-[520px] flex-col justify-center gap-3 px-4">
      <h1 className="m-0 text-xl font-semibold">{t('operations.maintenanceTitle')}</h1>
      <p className="m-0 text-[var(--ink-muted)]">
        {notice?.maintenance.message || t('operations.maintenanceDefault')}
      </p>
      <p className="m-0 text-[13px]">
        <a href="/login" className="text-[var(--accent)]">
          {t('operations.adminSignIn')}
        </a>
      </p>
    </main>
  );
}
