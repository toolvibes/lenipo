import { CaretLeft, CaretRight, Star } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  DEFAULT_ISSUE_COLUMNS,
  type Me,
  type QueryError,
  type SavedFilter,
} from '@tasklore/shared';
import { fromBasic, nextSort, parse, primarySort, toBasic, withSort } from '@tasklore/tql';
import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, client, unwrap } from '../../lib/api';
import { issueColumnsQuery } from '../../lib/personal';
import { filterQuery, filtersQuery, SEARCH_PAGE_SIZE, searchQuery } from '../../lib/search';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { IssueTable } from '../tracking/IssueTable';
import { BasicSearch } from './BasicSearch';
import { ColumnPicker } from './ColumnPicker';
import { SaveFilterDialog } from './SaveFilterDialog';
import { TqlInput } from './TqlInput';

/** Built-in starting points, like Jira's default filters. */
const PRESETS = {
  mine: 'assignee = currentUser() AND resolution is EMPTY ORDER BY priority, updated DESC',
  reported: 'reporter = currentUser() ORDER BY created DESC',
  recent: 'updated >= -7d ORDER BY updated DESC',
  all: 'ORDER BY created DESC',
} as const;

type Mode = 'basic' | 'advanced';
const MODE_KEY = 'tasklore.search.mode';

/** The last chosen search mode of this browser; a convenience, so failures are ignored. */
function useMode(): [Mode, (mode: Mode) => void] {
  const [mode, setMode] = useState<Mode>(() => {
    try {
      return localStorage.getItem(MODE_KEY) === 'advanced' ? 'advanced' : 'basic';
    } catch {
      return 'basic';
    }
  });
  return [
    mode,
    (next) => {
      setMode(next);
      try {
        localStorage.setItem(MODE_KEY, next);
      } catch {
        // Private windows may refuse storage; the mode then lasts for this page only.
      }
    },
  ];
}

const SIDEBAR_LINK =
  'block truncate rounded-[var(--radius-md)] px-2 py-1 text-[var(--ink)] no-underline hover:bg-[var(--surface-2)] data-[current=true]:bg-[var(--accent-soft)] data-[current=true]:font-semibold data-[current=true]:text-[var(--accent)]';

function FilterList({
  title,
  filters,
  currentId,
}: {
  title: string;
  filters: SavedFilter[];
  currentId: string | undefined;
}) {
  if (filters.length === 0) return null;
  return (
    <section className="flex flex-col gap-0.5">
      <h2 className="tl-label px-2 uppercase text-[var(--ink-muted)]">{title}</h2>
      {filters.map((filter) => (
        <Link
          key={filter.id}
          to="/issues"
          search={{ filter: filter.id }}
          data-current={filter.id === currentId}
          title={filter.description || filter.name}
          className={SIDEBAR_LINK}
        >
          {filter.name}
        </Link>
      ))}
    </section>
  );
}

/** Issue search with TQL, saved filters and default filters (T-QRY-01 to -06). */
export function SearchPage({ me, q, filterId }: { me: Me; q?: string; filterId?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputId = useId();
  const errorId = useId();

  const filter = useQuery({ ...filterQuery(filterId ?? ''), enabled: !!filterId });
  const filters = useQuery(filtersQuery());
  // The query in the URL wins; a filter alone runs its stored query.
  const applied = q ?? (filterId ? filter.data?.query : '');

  const [draft, setDraft] = useState(applied ?? '');
  const [offset, setOffset] = useState(0);
  const [checkNow, setCheckNow] = useState(false);
  const [saving, setSaving] = useState<'new' | 'details' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [mode, setMode] = useMode();
  const columns = useQuery(issueColumnsQuery).data?.columns ?? DEFAULT_ISSUE_COLUMNS;

  useEffect(() => {
    if (applied !== undefined) setDraft(applied);
    setOffset(0);
  }, [applied]);

  const results = useQuery({
    ...searchQuery(applied ?? '', offset),
    enabled: applied !== undefined,
  });

  // Syntax errors appear once typing pauses, or at once when searching.
  const [settledDraft, setSettledDraft] = useState(draft);
  useEffect(() => {
    const timer = setTimeout(() => setSettledDraft(draft), 700);
    return () => clearTimeout(timer);
  }, [draft]);
  const localErrors = useMemo(
    () => parse(checkNow ? draft : settledDraft).errors,
    [checkNow, draft, settledDraft],
  );
  const serverErrors: QueryError[] =
    results.error instanceof ApiError ? (results.error.problem.queryErrors ?? []) : [];
  const errors = draft === applied && localErrors.length === 0 ? serverErrors : localErrors;
  const otherError =
    results.error && serverErrors.length === 0
      ? results.error instanceof ApiError
        ? results.error.message
        : String(results.error)
      : null;

  /** Shows the results of a query; an open filter stays open, marked as changed. */
  function apply(query: string) {
    if (query === applied) {
      void results.refetch();
      return;
    }
    const stored = filter.data?.query;
    void navigate({
      to: '/issues',
      search: { filter: filterId, q: filterId && query === stored ? undefined : query },
    });
  }

  function run() {
    setCheckNow(true);
    if (parse(draft).errors.length > 0) return;
    setCheckNow(false);
    apply(draft);
  }

  // The basic search shows the applied query when it has the simple form (E-48).
  const basic = useMemo(() => (applied === undefined ? null : toBasic(applied)), [applied]);
  const showBasic = mode === 'basic' && basic !== null;
  const sort = useMemo(() => primarySort(applied ?? ''), [applied]);

  function sortBy(field: string) {
    const sorted = withSort(applied ?? '', nextSort(sort, field));
    if (sorted !== null) apply(sorted);
  }

  function showError(error: QueryError) {
    const element = document.getElementById(inputId) as HTMLTextAreaElement | null;
    element?.focus();
    element?.setSelectionRange(error.start, Math.max(error.end, error.start + 1));
  }

  const current = filter.data;
  const modified = !!current && applied !== undefined && applied !== current.query;
  const canShare = me.globalPermissions.includes('share-filters');

  const refreshFilters = async (saved?: SavedFilter) => {
    if (saved) queryClient.setQueryData(['filter', saved.id], saved);
    await queryClient.invalidateQueries({ queryKey: ['filters'] });
  };

  const favourite = useMutation({
    mutationFn: (next: boolean) =>
      unwrap(
        next
          ? client.PUT('/api/v1/filters/{id}/favourite', {
              params: { path: { id: filterId ?? '' } },
            })
          : client.DELETE('/api/v1/filters/{id}/favourite', {
              params: { path: { id: filterId ?? '' } },
            }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['filter', filterId] });
      await queryClient.invalidateQueries({ queryKey: ['favourites'] });
      await refreshFilters();
    },
  });

  const saveQuery = useMutation({
    mutationFn: () =>
      unwrap(
        client.PATCH('/api/v1/filters/{id}', {
          params: { path: { id: filterId ?? '' } },
          body: { query: applied ?? '' },
        }),
      ),
    onSuccess: async (saved) => {
      await refreshFilters(saved);
      await navigate({ to: '/issues', search: { filter: saved.id } });
    },
  });

  const remove = useMutation({
    mutationFn: () =>
      unwrap(client.DELETE('/api/v1/filters/{id}', { params: { path: { id: filterId ?? '' } } })),
    onSuccess: async () => {
      setDeleting(false);
      await refreshFilters();
      await navigate({ to: '/issues', search: { q: applied } });
    },
  });

  const all = filters.data ?? [];
  const page = results.data;
  const title = current?.name ?? t('search.title');

  return (
    <main className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-start">
      <aside
        aria-label={t('search.filters')}
        className="flex shrink-0 flex-col gap-4 md:sticky md:top-5 md:w-56"
      >
        <section className="flex flex-col gap-0.5">
          <h2 className="tl-label px-2 uppercase text-[var(--ink-muted)]">
            {t('search.defaultFilters')}
          </h2>
          {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((preset) => (
            <Link
              key={preset}
              to="/issues"
              search={{ q: PRESETS[preset] }}
              data-current={!filterId && q === PRESETS[preset]}
              className={SIDEBAR_LINK}
            >
              {t(`search.presets.${preset}`)}
            </Link>
          ))}
        </section>
        <FilterList
          title={t('search.favourites')}
          filters={all.filter((entry) => entry.favourite)}
          currentId={filterId}
        />
        <FilterList
          title={t('search.myFilters')}
          filters={all.filter((entry) => entry.editable)}
          currentId={filterId}
        />
        <FilterList
          title={t('search.sharedFilters')}
          filters={all.filter((entry) => !entry.editable)}
          currentId={filterId}
        />
        {filters.data && all.length === 0 && (
          <p className="px-2 text-xs text-[var(--ink-muted)]">{t('search.noFilters')}</p>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="flex flex-wrap items-center gap-3">
          {/* The title keeps its room; the actions wrap below it on narrow screens. */}
          <div className="flex min-w-[min(100%,18rem)] flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="tl-heading-xl min-w-0 break-words">{title}</h1>
              {current && (
                <button
                  type="button"
                  aria-pressed={current.favourite}
                  aria-label={current.favourite ? t('search.unfavourite') : t('search.favourite')}
                  title={current.favourite ? t('search.unfavourite') : t('search.favourite')}
                  disabled={favourite.isPending}
                  onClick={() => favourite.mutate(!current.favourite)}
                  className="grid size-8 place-items-center rounded-[var(--radius-md)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] aria-pressed:text-[var(--accent)]"
                >
                  <Star size={18} weight={current.favourite ? 'fill' : 'regular'} aria-hidden />
                </button>
              )}
            </div>
            {current && (modified || !current.editable || current.description) && (
              <p className="text-xs text-[var(--ink-muted)]">
                {current.editable
                  ? current.description
                  : t('search.ownedBy', { name: current.owner.displayName })}
                {modified && (
                  <span className="ml-2 rounded-[var(--radius-sm)] bg-[var(--warning-soft)] px-1.5 font-semibold text-[var(--ink)]">
                    {t('search.modified')}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {current?.editable && modified && (
              <Button
                variant="primary"
                onClick={() => saveQuery.mutate()}
                disabled={saveQuery.isPending}
              >
                {t('search.save')}
              </Button>
            )}
            <Button onClick={() => setSaving('new')}>
              {current ? t('search.saveCopy') : t('search.saveAsFilter')}
            </Button>
            {current?.editable && (
              <>
                <Button variant="ghost" onClick={() => setSaving('details')}>
                  {t('search.editDetails')}
                </Button>
                <Button variant="ghost" onClick={() => setDeleting(true)}>
                  {t('search.delete')}
                </Button>
              </>
            )}
          </div>
        </header>

        {filterId && filter.isError && <FormError message={t('search.filterNotFound')} />}
        {saveQuery.error && <FormError message={saveQuery.error.message} />}

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <fieldset className="m-0 inline-flex rounded-[var(--radius-md)] border border-[var(--border-strong)] p-0.5">
              <legend className="sr-only">{t('search.mode.label')}</legend>
              {(['basic', 'advanced'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={(option === 'basic') === showBasic}
                  onClick={() => setMode(option)}
                  className="h-7 rounded-[var(--radius-sm)] px-3 text-[var(--ink-muted)] aria-pressed:bg-[var(--accent-soft)] aria-pressed:font-semibold aria-pressed:text-[var(--accent)]"
                >
                  {t(`search.mode.${option}`)}
                </button>
              ))}
            </fieldset>
            {mode === 'basic' && !showBasic && applied !== undefined && (
              <p role="status" className="m-0 text-xs text-[var(--ink-muted)]">
                {t('search.mode.tooComplex')}
              </p>
            )}
          </div>
          {showBasic ? (
            <BasicSearch value={basic} onChange={(next) => apply(fromBasic(next))} />
          ) : (
            <>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <TqlInput
                    id={inputId}
                    value={draft}
                    onChange={(value) => {
                      setDraft(value);
                      setCheckNow(false);
                    }}
                    onSubmit={run}
                    errors={errors}
                    errorId={errorId}
                  />
                </div>
                <Button variant="primary" onClick={run}>
                  {t('search.run')}
                </Button>
              </div>
              {errors.length > 0 ? (
                <ul id={errorId} className="flex flex-col gap-1">
                  {errors.slice(0, 3).map((error) => (
                    <li
                      key={`${error.code}:${error.start}`}
                      className="flex flex-wrap items-baseline gap-2 text-[var(--danger)]"
                    >
                      <span>
                        {t(`search.errors.${error.code}` as never, {
                          ...error.params,
                          defaultValue: error.message,
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={() => showError(error)}
                        className="text-xs text-[var(--ink-muted)] underline"
                      >
                        {t('search.showError')}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[var(--ink-muted)]">{t('search.hint')}</p>
              )}
            </>
          )}
        </div>

        {otherError && <FormError message={otherError} />}

        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* An empty result is shown in the table; the live region still announces it. */}
          <span
            className={`text-xs text-[var(--ink-muted)] ${page?.total === 0 ? 'sr-only' : ''}`}
            aria-live="polite"
          >
            {page &&
              (page.total === 0
                ? t('search.noResults')
                : t('search.range', {
                    from: page.offset + 1,
                    to: page.offset + page.issues.length,
                    total: page.total,
                  }))}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {page && page.total > SEARCH_PAGE_SIZE && (
              <nav aria-label={t('search.pagination')} className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - SEARCH_PAGE_SIZE))}
                >
                  <CaretLeft size={14} aria-hidden />
                  {t('search.previous')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={offset + SEARCH_PAGE_SIZE >= page.total}
                  onClick={() => setOffset(offset + SEARCH_PAGE_SIZE)}
                >
                  {t('search.next')}
                  <CaretRight size={14} aria-hidden />
                </Button>
              </nav>
            )}
            <ColumnPicker columns={columns} />
          </div>
        </div>

        <IssueTable
          issues={page?.issues ?? []}
          empty={page && !results.error ? t('search.noResults') : null}
          columns={columns}
          sort={sort}
          onSort={results.error ? undefined : sortBy}
        />
      </div>

      <SaveFilterDialog
        open={saving !== null}
        onOpenChange={(open) => !open && setSaving(null)}
        query={draft}
        editing={saving === 'details' ? current : undefined}
        canShare={canShare}
        onSaved={(saved) => {
          void refreshFilters(saved);
          void navigate({ to: '/issues', search: { filter: saved.id } });
        }}
      />
      {current && (
        <Dialog open={deleting} onOpenChange={setDeleting} title={t('search.deleteTitle')}>
          <div className="flex flex-col gap-4">
            {remove.error && <FormError message={remove.error.message} />}
            <p>{t('search.deleteConfirm', { name: current.name })}</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
                {t('search.delete')}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </main>
  );
}
