import { BookOpenText, FileText, FolderSimple, MagnifyingGlass, Plus } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type Me, type SpaceSummary } from '@toolvibes/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { recentQuery } from '../../lib/personal';
import { everythingQuery } from '../../lib/search';
import { spacesQuery } from '../../lib/wiki';
import { Button } from '../../ui/Button';
import { FavouriteButton } from '../personal/FavouriteButton';
import { useDebounced } from '../search/TqlInput';
import { CreateSpaceDialog } from './CreateSpaceDialog';

/** Spaces and pages opened lately, as quick links above the directory (W-SPC-08). */
function RecentlyVisited() {
  const { t } = useTranslation();
  const recent = useQuery(recentQuery(50));
  const items = (recent.data ?? [])
    .filter((item) => item.kind === 'space' || item.kind === 'page')
    .slice(0, 8);
  if (items.length === 0) return null;
  const chip =
    'flex h-8 max-w-64 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] px-2 text-sm text-[var(--ink)] no-underline hover:border-[var(--border-strong)]';
  return (
    <section className="flex flex-col gap-2">
      <h2 className="tl-label m-0 text-[var(--ink-muted)]">{t('wiki.recent')}</h2>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {items.map((item) => (
          <li key={`${item.kind}:${item.ref}`}>
            {item.kind === 'space' ? (
              <Link to="/spaces/$key" params={{ key: item.ref }} className={chip}>
                <BookOpenText size={16} className="shrink-0 text-[var(--accent)]" aria-hidden />
                <span className="truncate">{item.name}</span>
              </Link>
            ) : (
              <Link
                to="/spaces/$key/pages/$id"
                params={{ key: item.spaceKey ?? '', id: item.ref }}
                className={chip}
              >
                <FileText size={16} className="shrink-0 text-[var(--ink-muted)]" aria-hidden />
                <span className="truncate">{item.name}</span>
                <span className="tl-key text-xs text-[var(--ink-muted)]">{item.spaceKey}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One space in the directory: name, key, star, description and its project. */
function SpaceCard({ space }: { space: SpaceSummary }) {
  return (
    <Link
      to="/spaces/$key"
      params={{ key: space.key }}
      className="flex h-full flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-4 text-[var(--ink)] no-underline hover:border-[var(--border-strong)]"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
          <BookOpenText size={18} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <strong className="truncate font-semibold">{space.name}</strong>
          <span className="tl-key text-[var(--ink-muted)]">{space.key}</span>
        </div>
        <FavouriteButton
          kind="space"
          refId={space.key}
          active={space.favourite}
          name={space.name}
        />
      </div>
      {space.description && (
        <span className="line-clamp-2 text-sm text-[var(--ink-muted)]">{space.description}</span>
      )}
      {space.project && (
        <span className="mt-auto flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
          <FolderSimple size={14} aria-hidden />
          {space.project.name}
        </span>
      )}
    </Link>
  );
}

function SpaceGroup({ title, spaces }: { title: string; spaces: SpaceSummary[] }) {
  if (spaces.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="tl-label m-0 text-[var(--ink-muted)]">{title}</h2>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 p-0">
        {spaces.map((space) => (
          <li key={space.id}>
            <SpaceCard space={space} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Search over the published pages of every space, as the way in (TL-83). */
function WikiSearch() {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const q = useDebounced(text.trim(), 200);
  const results = useQuery(everythingQuery(q, 'page'));
  const pages = q ? (results.data?.pages ?? []) : [];
  return (
    <section className="flex flex-col gap-2">
      <label className="relative flex max-w-2xl items-center">
        <span className="sr-only">{t('wikiHome.search')}</span>
        <MagnifyingGlass
          size={18}
          aria-hidden
          className="pointer-events-none absolute left-3 text-[var(--ink-muted)]"
        />
        <input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('wikiHome.searchPlaceholder')}
          className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] pr-3 pl-10 text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)]"
        />
      </label>
      {q && results.data && (
        <ul aria-live="polite" className="m-0 flex max-w-2xl list-none flex-col gap-1 p-0">
          {pages.length === 0 && (
            <li className="text-sm text-[var(--ink-muted)]">{t('wikiHome.noResults')}</li>
          )}
          {pages.map((page) => (
            <li key={page.id}>
              <Link
                to="/spaces/$key/pages/$id"
                params={{ key: page.space.key, id: page.id }}
                className="flex flex-col gap-0.5 rounded-[var(--radius-md)] px-2 py-1.5 text-[var(--ink)] no-underline hover:bg-[var(--surface-2)]"
              >
                <span className="flex items-center gap-2">
                  <FileText size={16} aria-hidden className="shrink-0 text-[var(--ink-muted)]" />
                  <span className="truncate font-medium">{page.title}</span>
                  <span className="tl-key text-xs text-[var(--ink-muted)]">{page.space.key}</span>
                </span>
                <span className="line-clamp-1 text-sm text-[var(--ink-muted)]">
                  {page.snippet.map((part, index) =>
                    part.hit ? (
                      // biome-ignore lint/suspicious/noArrayIndexKey: segments never reorder
                      <mark key={index}>{part.text}</mark>
                    ) : (
                      // biome-ignore lint/suspicious/noArrayIndexKey: segments never reorder
                      <span key={index}>{part.text}</span>
                    ),
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Pages published lately in any space the caller sees (TL-83). */
function RecentlyChanged() {
  const { t } = useTranslation();
  const recent = useQuery({
    queryKey: ['wiki-home', 'recent-pages'],
    queryFn: () =>
      unwrap(client.GET('/api/v1/wiki/recent-pages', { params: { query: { limit: 8 } } })),
  });
  if (!recent.data || recent.data.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="tl-label m-0 text-[var(--ink-muted)]">{t('wikiHome.changed')}</h2>
      <ul className="m-0 flex max-w-2xl list-none flex-col gap-px p-0">
        {recent.data.map((page) => (
          <li key={page.id}>
            <Link
              to="/spaces/$key/pages/$id"
              params={{ key: page.space.key, id: page.id }}
              className="flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-sm text-[var(--ink)] no-underline hover:bg-[var(--surface-2)]"
            >
              <FileText size={16} aria-hidden className="shrink-0 text-[var(--ink-muted)]" />
              <span className="min-w-0 flex-1 truncate">{page.title}</span>
              <span className="truncate text-xs text-[var(--ink-muted)]">{page.space.name}</span>
              {page.publishedAt && (
                <span className="shrink-0 text-xs text-[var(--ink-muted)]">
                  {formatRelative(page.publishedAt)}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The wiki's start page (W-SPC-08, TL-83, E-130): search over all spaces, what changed and was
 * opened lately, then the general spaces and those of projects, starred ones first.
 */
export function SpacesPage({ me }: { me: Me }) {
  const { t } = useTranslation();
  const spaces = useQuery({
    ...spacesQuery,
    select: (list) =>
      list
        .filter((space) => space.type !== 'personal')
        .sort((a, b) => Number(b.favourite) - Number(a.favourite) || a.name.localeCompare(b.name)),
  });
  const [creating, setCreating] = useState(false);
  const canCreate = me.globalPermissions.includes('create-spaces');
  const all = spaces.data ?? [];

  return (
    <main className="flex flex-col gap-6 px-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="tl-heading-xl">{t('wikiHome.title')}</h1>
          <p className="m-0 max-w-2xl text-[var(--ink-muted)]">{t('wikiHome.intro')}</p>
        </div>
        {canCreate && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden />
            {t('wiki.createSpace')}
          </Button>
        )}
      </header>
      <WikiSearch />
      <RecentlyChanged />
      <RecentlyVisited />
      {spaces.data?.length === 0 && (
        <p className="max-w-xl text-[var(--ink-muted)]">{t('wiki.noSpaces')}</p>
      )}
      <SpaceGroup
        title={t('wikiHome.generalSpaces')}
        spaces={all.filter((space) => !space.project)}
      />
      <SpaceGroup
        title={t('wikiHome.projectSpaces')}
        spaces={all.filter((space) => space.project)}
      />
      {creating && <CreateSpaceDialog open onOpenChange={setCreating} />}
    </main>
  );
}
