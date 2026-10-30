import { BookOpenText } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { formatRelative } from '../../lib/format';
import { issuePagesQuery } from '../../lib/wiki';

/** "Wiki-Seiten": Lore pages that name or embed this issue (W-INT-03, E-73). */
export function IssueWikiPages({ issueKey }: { issueKey: string }) {
  const { t } = useTranslation();
  const pages = useQuery(issuePagesQuery(issueKey));
  if (!pages.data) return null;
  return (
    <section aria-label={t('issues.wikiPages')} className="flex flex-col gap-2">
      <h2 className="tl-label text-[var(--ink-muted)]">
        {t('issues.wikiPages')}
        {pages.data.length > 0 && <span className="ml-1.5">{pages.data.length}</span>}
      </h2>
      {pages.data.length === 0 ? (
        <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('issues.wikiPagesEmpty')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {pages.data.map((page) => (
            <li
              key={page.id}
              className="flex min-h-[34px] items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 text-[13.5px]"
            >
              <BookOpenText size={16} aria-hidden className="shrink-0 text-[var(--ink-muted)]" />
              <Link
                to="/spaces/$key/pages/$id"
                params={{ key: page.space.key, id: page.id }}
                className="min-w-0 flex-1 truncate font-[family-name:var(--font-prose)] text-[15px] text-[var(--ink)] no-underline hover:underline"
              >
                {page.title}
              </Link>
              <span className="shrink-0 text-xs text-[var(--ink-muted)]">
                {page.space.name} ·{' '}
                {page.kind === 'macro' ? t('issues.wikiEmbedded') : t('issues.wikiMentioned')}
                {page.publishedAt && ` · ${formatRelative(page.publishedAt)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
