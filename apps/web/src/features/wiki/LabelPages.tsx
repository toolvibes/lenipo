import { Tag } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../../lib/format';
import { labelPagesQuery, spaceLabelsQuery } from '../../lib/wiki';

/** The labels of a space with their page counts (W-PAG-08). */
export function SpaceLabelsPage({ spaceKey }: { spaceKey: string }) {
  const { t } = useTranslation();
  const labels = useQuery(spaceLabelsQuery(spaceKey));
  return (
    <main className="flex flex-col gap-4 px-6 py-6">
      <h1 className="tl-heading-xl m-0">{t('wiki.labels.overview')}</h1>
      {labels.data?.length === 0 && (
        <p className="m-0 text-[var(--ink-muted)]">{t('wiki.labels.none')}</p>
      )}
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {labels.data?.map((entry) => (
          <li key={entry.label}>
            <Link
              to="/labels/$label"
              params={{ label: entry.label }}
              search={{ space: spaceKey }}
              className="inline-flex h-8 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] px-3 text-[var(--ink)] no-underline hover:border-[var(--border-strong)]"
            >
              <Tag size={14} aria-hidden className="text-[var(--ink-muted)]" />
              {entry.label}
              <span className="text-xs text-[var(--ink-muted)]">{entry.pages}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

/** Every page with a label, in one space or across the wiki. */
export function LabelPages({ label, space }: { label: string; space?: string }) {
  const { t } = useTranslation();
  const pages = useQuery(labelPagesQuery(label, space));
  return (
    <main className="flex flex-col gap-4 px-6 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="tl-heading-xl m-0 flex items-center gap-2">
          <Tag size={22} aria-hidden />
          {label}
        </h1>
        <p className="m-0 text-sm text-[var(--ink-muted)]">
          {space ? (
            <>
              {t('wiki.labels.inSpace', { space })}{' '}
              <Link to="/labels/$label" params={{ label }} search={{}}>
                {t('wiki.labels.everywhere')}
              </Link>
            </>
          ) : (
            t('wiki.labels.allSpaces')
          )}
        </p>
      </header>
      {pages.data?.length === 0 && (
        <p className="m-0 text-[var(--ink-muted)]">{t('wiki.labels.noPages')}</p>
      )}
      <ul className="m-0 flex max-w-3xl list-none flex-col p-0">
        {pages.data?.map((page) => (
          <li
            key={page.id}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[var(--border)] py-2.5 last:border-b-0"
          >
            <Link
              to="/spaces/$key/pages/$id"
              params={{ key: page.space.key, id: page.id }}
              className="font-semibold text-[var(--ink)] no-underline hover:underline"
            >
              {page.title}
            </Link>
            <span className="text-xs text-[var(--ink-muted)]">
              {page.space.name}
              {page.publishedAt
                ? ` · ${formatDateTime(page.publishedAt)}`
                : ` · ${t('wiki.draft')}`}
            </span>
            <span className="flex w-full flex-wrap gap-1">
              {page.labels.map((entry) => (
                <Link
                  key={entry}
                  to="/labels/$label"
                  params={{ label: entry }}
                  search={space ? { space } : {}}
                  className={`rounded-[var(--radius-sm)] px-1.5 text-xs no-underline ${entry === label ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-[var(--surface-2)] text-[var(--ink-muted)]'}`}
                >
                  {entry}
                </Link>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
