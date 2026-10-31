import { useQuery } from '@tanstack/react-query';
import { docToHtml, markdownToDoc } from '@tasklore/editor';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { noticeQuery } from '../../lib/instance';

const DISMISSED = 'tasklore.announcement.dismissed';

function dismissedVersion(): string | null {
  try {
    return localStorage.getItem(DISMISSED);
  } catch {
    return null;
  }
}

/** The administrators' banner and, for them, a reminder that maintenance mode is on (TL-40). */
export function Announcement() {
  const { t } = useTranslation();
  const notice = useQuery(noticeQuery).data;
  const [dismissed, setDismissed] = useState(dismissedVersion);
  const announcement = notice?.announcement;
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
      {announcement && announcement.version !== dismissed && (
        <div
          role="status"
          className={`flex items-start gap-3 border-b border-[var(--border)] px-4 py-2 text-[13px] ${
            announcement.level === 'warning'
              ? 'bg-[var(--warning-soft,var(--surface-2))]'
              : 'bg-[var(--surface-2)]'
          }`}
        >
          <div
            className="tl-announcement min-w-0 flex-1 [&_p]:m-0"
            // Rendered from Markdown by the editor package, which escapes HTML.
            // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitised by docToHtml
            dangerouslySetInnerHTML={{ __html: docToHtml(markdownToDoc(announcement.text)) }}
          />
          <button
            type="button"
            className="text-[var(--ink-muted)]"
            aria-label={t('operations.dismiss')}
            onClick={() => {
              try {
                localStorage.setItem(DISMISSED, announcement.version);
              } catch {
                // The banner just comes back on the next visit.
              }
              setDismissed(announcement.version);
            }}
          >
            ×
          </button>
        </div>
      )}
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
