import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';

/** The space's trash: pages deleted on their own, restorable with what was below (W-PAG-13). */
export function TrashPage({ spaceKey }: { spaceKey: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const trash = useQuery({
    queryKey: ['space', spaceKey, 'trash'],
    queryFn: () =>
      unwrap(client.GET('/api/v1/spaces/{key}/trash', { params: { path: { key: spaceKey } } })),
  });
  const restore = useMutation({
    mutationFn: (id: string) =>
      unwrap(client.POST('/api/v1/pages/{id}/restore', { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['space', spaceKey] }),
  });

  return (
    <main className="flex flex-col gap-4 px-6 py-5">
      <h1 className="tl-heading-xl m-0">{t('wiki.trash')}</h1>
      <p className="m-0 max-w-xl text-[var(--ink-muted)]">{t('wiki.trashHelp')}</p>
      {(trash.error ?? restore.error) && (
        <FormError message={(trash.error ?? restore.error)?.message ?? ''} />
      )}
      {trash.data?.length === 0 && <p className="m-0">{t('wiki.trashEmpty')}</p>}
      <ul className="m-0 flex max-w-3xl list-none flex-col p-0">
        {trash.data?.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--border)] py-2"
          >
            <span className="min-w-0 flex-1 truncate font-semibold">{entry.title}</span>
            <span className="text-xs text-[var(--ink-muted)]">
              {t('wiki.deletedBy', {
                name: entry.deletedBy?.displayName ?? t('wiki.unknownAuthor'),
                date: formatDateTime(entry.deletedAt),
              })}
            </span>
            <Button size="sm" disabled={restore.isPending} onClick={() => restore.mutate(entry.id)}>
              {t('wiki.restore')}
            </Button>
          </li>
        ))}
      </ul>
    </main>
  );
}
