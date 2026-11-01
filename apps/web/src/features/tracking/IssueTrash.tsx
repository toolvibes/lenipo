import { Trash } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';

/** Deleted issues of a project with their subtasks, until retention removes them (TL-61). */
export function IssueTrash({ projectKey }: { projectKey: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const trash = useQuery({
    queryKey: ['project', projectKey, 'trash'],
    queryFn: () =>
      unwrap(client.GET('/api/v1/projects/{key}/trash', { params: { path: { key: projectKey } } })),
  });
  const restore = useMutation({
    mutationFn: (key: string) =>
      unwrap(client.POST('/api/v1/issues/{key}/restore', { params: { path: { key } } })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['project', projectKey, 'trash'] }),
  });
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-base font-semibold">{t('trash.title')}</h2>
      <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('trash.intro')}</p>
      {restore.error && <FormError message={restore.error.message} />}
      {trash.data?.length === 0 && (
        <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('trash.empty')}</p>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {(trash.data ?? []).map((issue) => (
          <li
            key={issue.key}
            className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] py-2 text-[13px]"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span>
                <span className="tl-key mr-2">{issue.key}</span>
                {issue.summary}
              </span>
              <span className="text-xs text-[var(--ink-muted)]">
                {t('trash.deleted', {
                  when: formatRelative(issue.deletedAt),
                  who: issue.deletedBy?.displayName ?? t('trash.someone'),
                })}
                {issue.subtasks > 0 && ` · ${t('trash.subtasks', { count: issue.subtasks })}`}
              </span>
            </span>
            {restore.isSuccess && restore.variables === issue.key ? (
              <Link to="/issues/$key" params={{ key: issue.key }}>
                {t('trash.open')}
              </Link>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                disabled={restore.isPending}
                onClick={() => restore.mutate(issue.key)}
              >
                {t('trash.restore')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Delete" on the issue page: into the trash after a confirmation (TL-61). */
export function DeleteIssueButton({
  issueKey,
  projectKey,
  subtasks,
}: {
  issueKey: string;
  projectKey: string;
  subtasks: number;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const remove = useMutation({
    mutationFn: () =>
      unwrap(client.DELETE('/api/v1/issues/{key}', { params: { path: { key: issueKey } } })),
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['issues'] });
      await navigate({ to: '/projects/$key', params: { key: projectKey } });
    },
  });
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Trash size={16} aria-hidden />
        {t('trash.delete')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={t('trash.confirmTitle', { key: issueKey })}>
        <div className="flex flex-col gap-3 text-[13px]">
          <p className="m-0">
            {subtasks > 0
              ? t('trash.confirmWithSubtasks', { count: subtasks })
              : t('trash.confirm')}
          </p>
          {remove.error && <FormError message={remove.error.message} />}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>
              {t('trash.delete')}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
