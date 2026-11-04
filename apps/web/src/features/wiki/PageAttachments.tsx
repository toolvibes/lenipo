import { DownloadSimple, File as FileGlyph, Image, Paperclip, Trash } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { uploadPageFile } from '../../collab/uploads';
import { client, unwrap } from '../../lib/api';
import { formatBytes, formatDateTime } from '../../lib/format';
import { pageAttachmentsQuery } from '../../lib/wiki';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';

/** The files of a page below its text (W-EDT-09, E-61). */
export function PageAttachments({ pageId, canEdit }: { pageId: string; canEdit: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const attachments = useQuery(pageAttachmentsQuery(pageId));
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['page', pageId, 'attachments'] });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) await uploadPageFile(pageId, file);
    },
    onError: (failure) => setError(failure.message),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      unwrap(
        client.DELETE('/api/v1/pages/{id}/attachments/{attachmentId}', {
          params: { path: { id: pageId, attachmentId: id } },
        }),
      ),
    onError: (failure) => setError(failure.message),
    onSettled: refresh,
  });

  const list = attachments.data ?? [];
  if (list.length === 0 && !canEdit) return null;
  return (
    <section
      aria-labelledby="page-attachments"
      className="flex flex-col gap-2 border-t border-[var(--border)] pt-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="page-attachments" className="tl-heading-md m-0 flex items-center gap-2">
          <Paperclip size={18} aria-hidden />
          {t('wiki.attachments', { count: list.length })}
        </h2>
        {canEdit && (
          <>
            <Button size="sm" onClick={() => input.current?.click()} disabled={upload.isPending}>
              {upload.isPending ? t('editor.uploading') : t('wiki.attachFile')}
            </Button>
            <input
              ref={input}
              type="file"
              multiple
              hidden
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                event.target.value = '';
                setError(null);
                if (files.length > 0) upload.mutate(files);
              }}
            />
          </>
        )}
      </div>
      {error && <FormError message={error} />}
      {list.length === 0 && (
        <p className="m-0 text-sm text-[var(--ink-muted)]">{t('wiki.noAttachments')}</p>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {list.map((attachment) => {
          const Icon = attachment.image ? Image : FileGlyph;
          return (
            <li
              key={attachment.id}
              className="flex min-h-10 items-center gap-2 border-b border-[var(--border)] last:border-b-0"
            >
              <Icon size={20} aria-hidden className="shrink-0 text-[var(--ink-muted)]" />
              <a
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-[var(--ink)] no-underline hover:underline"
              >
                {attachment.fileName}
              </a>
              <span className="hidden text-xs text-[var(--ink-muted)] sm:inline">
                {formatBytes(attachment.size)} ·{' '}
                {attachment.author?.displayName ?? t('wiki.unknownAuthor')} ·{' '}
                {formatDateTime(attachment.createdAt)}
              </span>
              <a
                href={`${attachment.url}?download=1`}
                aria-label={t('wiki.downloadFile', { name: attachment.fileName })}
                title={t('wiki.downloadFile', { name: attachment.fileName })}
                className="grid size-8 place-items-center rounded-[var(--radius-md)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
              >
                <DownloadSimple size={16} aria-hidden />
              </a>
              {attachment.canDelete && (
                <button
                  type="button"
                  aria-label={t('wiki.deleteFile', { name: attachment.fileName })}
                  title={t('wiki.deleteFile', { name: attachment.fileName })}
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(t('wiki.deleteFileConfirm', { name: attachment.fileName })))
                      remove.mutate(attachment.id);
                  }}
                  className="grid size-8 place-items-center rounded-[var(--radius-md)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
                >
                  <Trash size={16} aria-hidden />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
