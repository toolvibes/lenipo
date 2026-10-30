import { Printer } from '@phosphor-icons/react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { Page, PageTreeEntry, RichText } from '@tasklore/shared';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../../lib/format';
import { pageQuery, pageTreeQuery } from '../../lib/wiki';
import { PrintModeContext } from '../../macros/views';
import { Button } from '../../ui/Button';
import { RichTextView } from '../tracking/RichTextEditor';

/** At most this many child pages are printed along. */
const CHILD_LIMIT = 50;

/** The published pages below `id`, depth first in tree order. */
function descendants(entries: PageTreeEntry[], id: string): PageTreeEntry[] {
  const children = (parent: string): PageTreeEntry[] =>
    entries
      .filter((entry) => entry.parentId === parent && entry.published)
      .flatMap((entry) => [entry, ...children(entry.id)]);
  return children(id);
}

function PrintedPage({ page, first }: { page: Page; first: boolean }) {
  const { t } = useTranslation();
  const path = [page.space.name, ...page.ancestors.map((ancestor) => ancestor.title)].join(' / ');
  return (
    <article id={`page-${page.id}`} className={first ? '' : 'tl-print-break'}>
      <header className="mb-6 flex flex-col gap-1 border-b border-[var(--border)] pb-3">
        <span className="text-xs text-[var(--ink-muted)]">{path}</span>
        <h1 className="m-0 font-[family-name:var(--font-prose)] text-[32px] leading-tight font-medium">
          {page.title}
        </h1>
        <span className="text-xs text-[var(--ink-muted)]">
          {t('print.header', {
            space: page.space.key,
            version: page.version,
            name: page.publishedBy?.displayName ?? '?',
            date: page.publishedAt ? formatDateTime(page.publishedAt) : '',
          })}
        </span>
      </header>
      {page.content && (
        <RichTextView
          doc={page.content as RichText}
          variant="page"
          liveKeys
          page={{ spaceKey: page.space.key, pageId: page.id }}
        />
      )}
    </article>
  );
}

/**
 * A page laid out for paper (W-EXP-04, E-75): outside the app shell, published content only,
 * collapsible sections open, optionally followed by its child pages. `auto` opens the print
 * dialog once everything is there.
 */
export function PrintPage({
  spaceKey,
  id,
  withChildren: children,
  auto,
}: {
  spaceKey: string;
  id: string;
  withChildren: boolean;
  auto: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const page = useQuery(pageQuery(id));
  const tree = useQuery({ ...pageTreeQuery(spaceKey), enabled: children });
  const below = useMemo(
    () => (children && tree.data ? descendants(tree.data, id) : []),
    [children, tree.data, id],
  );
  const shown = below.slice(0, CHILD_LIMIT);
  const childPages = useQueries({ queries: shown.map((entry) => pageQuery(entry.id)) });
  const ready =
    !!page.data && (!children || (!!tree.data && childPages.every((query) => query.data)));

  useEffect(() => {
    if (page.data) document.title = page.data.title;
  }, [page.data]);
  useEffect(() => {
    if (!auto || !ready) return;
    // Give macros and live issue keys a moment to load before the dialog opens.
    const timer = setTimeout(() => window.print(), 800);
    return () => clearTimeout(timer);
  }, [auto, ready]);

  if (page.error) {
    return <p className="m-0 p-10 text-[var(--danger)]">{page.error.message}</p>;
  }
  if (!page.data) return null;
  const toggle = (next: boolean) =>
    void navigate({
      to: '/spaces/$key/pages/$id/print',
      params: { key: spaceKey, id },
      search: next ? { children: true } : {},
      replace: true,
    });

  return (
    <PrintModeContext.Provider value>
      <div className="tl-print-toolbar flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-6 py-2.5 text-[13px]">
        <Link
          to="/spaces/$key/pages/$id"
          params={{ key: spaceKey, id }}
          className="text-[var(--ink-muted)] no-underline hover:underline"
        >
          ← {t('print.back')}
        </Link>
        <span className="flex-1" />
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={children}
            onChange={(event) => toggle(event.target.checked)}
          />
          {t('print.withChildren')}
        </label>
        <Button size="sm" variant="primary" disabled={!ready} onClick={() => window.print()}>
          <Printer size={16} aria-hidden />
          {t('print.print')}
        </Button>
      </div>
      <main className="tl-print mx-auto flex max-w-[720px] flex-col gap-10 px-8 py-10">
        {page.data.version === 0 ? (
          <p className="m-0 text-[var(--ink-muted)]">{t('print.draft')}</p>
        ) : (
          <>
            {children && shown.length > 0 && (
              <nav aria-label={t('print.contents')} className="flex flex-col gap-1">
                <h2 className="tl-label m-0 text-[var(--ink-muted)]">{t('print.contents')}</h2>
                <ol className="m-0 pl-5 text-sm">
                  {[{ id, title: page.data.title }, ...shown].map((entry) => (
                    <li key={entry.id}>{entry.title}</li>
                  ))}
                </ol>
                {below.length > CHILD_LIMIT && (
                  <p className="m-0 text-xs text-[var(--ink-muted)]">
                    {t('print.limited', { count: CHILD_LIMIT })}
                  </p>
                )}
              </nav>
            )}
            <PrintedPage page={page.data} first />
            {childPages.map(
              (query) =>
                query.data && <PrintedPage key={query.data.id} page={query.data} first={false} />,
            )}
          </>
        )}
      </main>
    </PrintModeContext.Provider>
  );
}
