import { Check, Eye, EyeSlash, Plus, Tag, X } from '@phosphor-icons/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type Page, PageLabels } from '@tasklore/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';

function useSetPage(pageId: string) {
  const queryClient = useQueryClient();
  return (page: Page) => {
    queryClient.setQueryData(['page', pageId], page);
    void queryClient.invalidateQueries({ queryKey: ['labels'] });
    void queryClient.invalidateQueries({ queryKey: ['space', page.space.key, 'labels'] });
  };
}

/** The page's labels as links; editors add and remove them in place (W-PAG-08, E-65). */
export function PageLabelList({ page }: { page: Page }) {
  const { t } = useTranslation();
  const setPage = useSetPage(page.id);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (labels: string[]) =>
      unwrap(
        client.PUT('/api/v1/pages/{id}/labels', {
          params: { path: { id: page.id } },
          body: { labels },
        }),
      ),
    onSuccess: setPage,
    onError: (failure) => setError(failure.message),
  });

  function add(event: FormEvent) {
    event.preventDefault();
    const words = draft.split(/[\s,]+/).filter(Boolean);
    const parsed = PageLabels.safeParse([...page.labels, ...words]);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t('wiki.labels.invalid'));
      return;
    }
    setError(null);
    setDraft('');
    save.mutate(parsed.data);
  }

  if (page.labels.length === 0 && !page.canEdit) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <Tag size={14} aria-hidden className="text-[var(--ink-muted)]" />
      <span className="sr-only">{t('wiki.labels.title')}</span>
      {page.labels.map((label) => (
        <span
          key={label}
          className="inline-flex h-6 items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--surface-2)] pr-1 pl-2"
        >
          <Link
            to="/labels/$label"
            params={{ label }}
            search={{ space: page.space.key }}
            className="text-[var(--ink)] no-underline hover:underline"
          >
            {label}
          </Link>
          {page.canEdit && (
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate(page.labels.filter((entry) => entry !== label))}
              aria-label={t('wiki.labels.remove', { label })}
              title={t('wiki.labels.remove', { label })}
              className="grid size-4 place-items-center rounded-[var(--radius-sm)] text-[var(--ink-muted)] hover:text-[var(--danger)]"
            >
              <X size={10} aria-hidden />
            </button>
          )}
        </span>
      ))}
      {page.canEdit &&
        (adding ? (
          <form onSubmit={add} className="flex items-center gap-1">
            <input
              // biome-ignore lint/a11y/noAutofocus: opened on purpose by the add button
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => !draft && setAdding(false)}
              onKeyDown={(event) => event.key === 'Escape' && setAdding(false)}
              aria-label={t('wiki.labels.add')}
              placeholder={t('wiki.labels.placeholder')}
              className="h-6 w-40 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-1.5"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-6 items-center gap-1 rounded-[var(--radius-sm)] px-1.5 text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
          >
            <Plus size={12} aria-hidden />
            {page.labels.length === 0 ? t('wiki.labels.addFirst') : t('wiki.labels.add')}
          </button>
        ))}
      {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
    </div>
  );
}

const menuItem =
  'flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 outline-none data-[highlighted]:bg-[var(--surface-2)]';

/** Follow the page alone or with every page below it (W-PAG-09, E-65). */
export function WatchMenu({ page }: { page: Page }) {
  const { t } = useTranslation();
  const setPage = useSetPage(page.id);
  const watch = useMutation({
    mutationFn: ({ scope, on }: { scope: 'page' | 'subtree'; on: boolean }) => {
      const params = { path: { id: page.id } };
      return unwrap(
        on
          ? client.PUT('/api/v1/pages/{id}/watch', { params, body: { scope } })
          : client.DELETE('/api/v1/pages/{id}/watch', { params: { ...params, query: { scope } } }),
      );
    },
    onSuccess: setPage,
  });
  const { page: direct, subtree, inherited } = page.watch;
  const watching = direct || subtree || inherited !== null;
  const item = (scope: 'page' | 'subtree', active: boolean, label: string) => (
    <DropdownMenu.CheckboxItem
      className={menuItem}
      checked={active}
      onCheckedChange={(on) => watch.mutate({ scope, on: on === true })}
    >
      <span className="grid size-4 place-items-center">
        <DropdownMenu.ItemIndicator>
          <Check size={14} aria-hidden />
        </DropdownMenu.ItemIndicator>
      </span>
      {label}
    </DropdownMenu.CheckboxItem>
  );
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={`inline-flex h-[var(--control-md)] items-center gap-2 rounded-[var(--radius-md)] px-3 font-semibold hover:bg-[var(--surface-2)] ${watching ? 'text-[var(--accent)]' : 'text-[var(--ink)]'}`}
      >
        {watching ? (
          <Eye size={16} weight="fill" aria-hidden />
        ) : (
          <EyeSlash size={16} aria-hidden />
        )}
        {watching ? t('wiki.watch.watching') : t('wiki.watch.watch')}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 w-72 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-1 shadow-[var(--shadow-float)]"
        >
          {item('page', direct, t('wiki.watch.page'))}
          {item('subtree', subtree, t('wiki.watch.subtree'))}
          {inherited && (
            <p className="m-0 px-2 py-1.5 text-xs text-[var(--ink-muted)]">
              {inherited === 'space' ? t('wiki.watch.viaSpace') : t('wiki.watch.viaAncestor')}
            </p>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
