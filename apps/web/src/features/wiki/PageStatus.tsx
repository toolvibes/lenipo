import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { PAGE_STATUSES, type Page, type PageStatus } from '@toolvibes/shared';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { meQuery } from '../../lib/queries';
import { FormError } from '../../ui/FormError';

const TONE: Record<PageStatus, string> = {
  none: '',
  draft: 'bg-[var(--surface-2)] text-[var(--ink-muted)]',
  'in-review': 'bg-[var(--warning-soft)] text-[var(--ink)]',
  verified: 'bg-[var(--success-soft)] text-[var(--ink)]',
  outdated: 'bg-[var(--danger-soft)] text-[var(--ink)]',
};

/** Status and owner of a page (W-PAG-11, TL-29, E-110). */
export function PageStatusBar({ page }: { page: Page }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const me = useQuery(meQuery);
  const save = useMutation({
    mutationFn: (body: { status: PageStatus; ownerId?: string | null }) =>
      unwrap(client.PUT('/api/v1/pages/{id}/status', { params: { path: { id: page.id } }, body })),
    onSuccess: (next) => queryClient.setQueryData(['page', page.id], next),
  });
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--ink-muted)]">
      {save.error && <FormError message={save.error.message} />}
      {page.status !== 'none' && (
        <span
          className={`rounded-[var(--radius-sm)] px-1.5 py-0.5 font-semibold ${TONE[page.status]}`}
        >
          {t(`pageStatus.${page.status}`)}
        </span>
      )}
      <span>
        {page.owner
          ? t('pageStatus.owner', { name: page.owner.displayName })
          : t('pageStatus.ownerAdmins')}
      </span>
      {page.kind === 'blog' && page.publishedAt && (
        <span>· {formatRelative(page.publishedAt)}</span>
      )}
      {page.canEdit && (
        <>
          <select
            aria-label={t('pageStatus.label')}
            value={page.status}
            disabled={save.isPending}
            onChange={(event) => save.mutate({ status: event.target.value as PageStatus })}
            className="h-7 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-1.5 text-[12.5px]"
          >
            {PAGE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`pageStatus.${status}`)}
              </option>
            ))}
          </select>
          {me.data && page.owner?.id !== me.data.id && (
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate({ status: page.status, ownerId: me.data?.id ?? null })}
              className="underline"
            >
              {t('pageStatus.takeOver')}
            </button>
          )}
        </>
      )}
      {page.kind === 'blog' && (
        <Link to="/spaces/$key/blog" params={{ key: page.space.key }}>
          {t('blog.title')}
        </Link>
      )}
    </div>
  );
}
