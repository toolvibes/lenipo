import {
  CaretLeft,
  CaretRight,
  DownloadSimple,
  File as FileGlyph,
  FilePdf,
  Paperclip,
  Trash,
} from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Attachment, Problem } from '@tasklore/shared';
import { type DragEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatBytes, formatDateTime, formatRelative } from '../../lib/format';
import { attachmentsQuery, trackingMetaQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';

/** Uploads one file as multipart/form-data (the typed client only speaks JSON). */
async function uploadFile(issueKey: string, file: File): Promise<Attachment> {
  const form = new FormData();
  form.append('file', file, file.name);
  const response = await fetch(`/api/v1/issues/${encodeURIComponent(issueKey)}/attachments`, {
    method: 'POST',
    body: form,
    credentials: 'same-origin',
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as Problem | null;
    throw new Error(problem?.detail ?? problem?.title ?? response.statusText);
  }
  return response.json() as Promise<Attachment>;
}

function FileIcon({ attachment }: { attachment: Attachment }) {
  const Icon = attachment.contentType === 'application/pdf' ? FilePdf : FileGlyph;
  return <Icon size={20} aria-hidden className="shrink-0 text-[var(--ink-muted)]" />;
}

/** Large view of the images of an issue, with previous/next by button or arrow key. */
function Gallery({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: Attachment[];
  index: number | null;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const image = index === null ? undefined : images[index];
  const step = (delta: number) => {
    if (index !== null) onIndex((index + delta + images.length) % images.length);
  };
  return (
    <Dialog
      open={image !== undefined}
      onOpenChange={(open) => !open && onClose()}
      title={image?.fileName ?? ''}
      description={
        image
          ? `${formatBytes(image.size)} · ${image.author?.displayName ?? ''} · ${formatDateTime(image.createdAt)}`
          : undefined
      }
      width={1040}
    >
      {image && (
        // biome-ignore lint/a11y/noStaticElementInteractions: arrow keys page through the images
        <div
          className="flex flex-col items-center gap-3"
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') step(1);
            if (event.key === 'ArrowLeft') step(-1);
          }}
        >
          <img
            src={image.url}
            alt={image.fileName}
            className="max-h-[60vh] max-w-full rounded-[var(--radius-md)] object-contain"
          />
          <div className="flex flex-wrap items-center gap-2">
            {images.length > 1 && (
              <Button variant="ghost" onClick={() => step(-1)}>
                <CaretLeft size={16} aria-hidden />
                {t('issues.attachments.previous')}
              </Button>
            )}
            <a
              href={`${image.url}?download=1`}
              download={image.fileName}
              className="inline-flex h-[var(--control-md)] items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border-strong)] px-3 font-semibold text-[var(--ink)] no-underline hover:bg-[var(--surface-2)]"
            >
              <DownloadSimple size={16} aria-hidden />
              {t('issues.attachments.download')}
            </a>
            {images.length > 1 && (
              <Button variant="ghost" onClick={() => step(1)}>
                {t('issues.attachments.next')}
                <CaretRight size={16} aria-hidden />
              </Button>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

/**
 * Attachments of an issue (T-ISS-06): drop files on the section, paste them anywhere on the
 * page or pick them; images appear as a gallery, other files as a list.
 */
export function Attachments({ issueKey, canAttach }: { issueKey: string; canAttach: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const attachments = useQuery(attachmentsQuery(issueKey));
  const meta = useQuery(trackingMetaQuery);
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['issue', issueKey, 'attachments'] });
    await queryClient.invalidateQueries({ queryKey: ['issue', issueKey, 'history'] });
  };

  async function upload(files: File[]) {
    if (files.length === 0) return;
    const max = meta.data?.attachmentMaxBytes ?? Number.POSITIVE_INFINITY;
    const problems: string[] = [];
    const accepted = files.filter((file) => {
      if (file.size <= max) return true;
      problems.push(t('issues.attachments.tooLarge', { name: file.name, max: formatBytes(max) }));
      return false;
    });
    setErrors(problems);
    setUploading((current) => [...current, ...accepted.map((file) => file.name)]);
    for (const file of accepted) {
      try {
        await uploadFile(issueKey, file);
      } catch (error) {
        problems.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`);
        setErrors([...problems]);
      } finally {
        setUploading((current) => {
          const next = [...current];
          next.splice(next.indexOf(file.name), 1);
          return next;
        });
      }
    }
    await refresh();
  }

  // Pasting files (e.g. a screenshot) anywhere on the issue page attaches them.
  const uploadRef = useRef(upload);
  uploadRef.current = upload;
  useEffect(() => {
    if (!canAttach) return;
    const onPaste = (event: ClipboardEvent) => {
      const files = [...(event.clipboardData?.files ?? [])];
      if (files.length === 0) return;
      event.preventDefault();
      void uploadRef.current(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [canAttach]);

  const remove = useMutation({
    mutationFn: (id: string) =>
      unwrap(
        client.DELETE('/api/v1/issues/{key}/attachments/{id}', {
          params: { path: { key: issueKey, id } },
        }),
      ),
    onSuccess: async () => {
      setConfirming(null);
      await refresh();
    },
  });

  const all = attachments.data ?? [];
  const images = all.filter((attachment) => attachment.image);
  const files = all.filter((attachment) => !attachment.image);
  if (all.length === 0 && !canAttach) return null;

  const dropHandlers = canAttach
    ? {
        onDragOver: (event: DragEvent) => {
          if (!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          setDragging(true);
        },
        onDragLeave: (event: DragEvent) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        },
        onDrop: (event: DragEvent) => {
          event.preventDefault();
          setDragging(false);
          void upload([...event.dataTransfer.files]);
        },
      }
    : {};

  return (
    <section
      aria-label={t('issues.attachments.title')}
      {...dropHandlers}
      className={`flex flex-col gap-2 rounded-[var(--radius-md)] ${
        dragging ? 'outline-2 outline-offset-4 outline-[var(--accent)] outline-dashed' : ''
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="tl-label text-[var(--ink-muted)]">
          {t('issues.attachments.title')}
          {all.length > 0 && <span className="ml-1.5 text-[var(--ink-muted)]">{all.length}</span>}
        </h2>
        {canAttach && (
          <>
            <input
              ref={input}
              type="file"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                void upload([...(event.target.files ?? [])]);
                event.target.value = '';
              }}
            />
            <Button size="sm" variant="ghost" onClick={() => input.current?.click()}>
              <Paperclip size={16} aria-hidden />
              {t('issues.attachments.add')}
            </Button>
          </>
        )}
      </div>

      {errors.map((error) => (
        <FormError key={error} message={error} />
      ))}
      {remove.error && <FormError message={remove.error.message} />}
      {uploading.length > 0 && (
        <p aria-live="polite" className="text-[var(--ink-muted)]">
          {t('issues.attachments.uploading', { names: uploading.join(', ') })}
        </p>
      )}
      {canAttach && all.length === 0 && uploading.length === 0 && (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] px-4 py-3 text-[var(--ink-muted)]">
          {t('issues.attachments.drop')}
        </p>
      )}

      {images.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2 p-0">
          {images.map((image, index) => (
            <li key={image.id} className="relative">
              <button
                type="button"
                onClick={() => setViewing(index)}
                title={image.fileName}
                className="block aspect-square w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)]"
              >
                <img
                  src={image.url}
                  alt={image.fileName}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
              {image.canDelete && (
                <button
                  type="button"
                  aria-label={t('issues.attachments.deleteNamed', { name: image.fileName })}
                  title={t('issues.attachments.deleteNamed', { name: image.fileName })}
                  onClick={() => setConfirming(image.id)}
                  className="absolute top-1 right-1 grid size-7 place-items-center rounded-[var(--radius-md)] bg-[var(--surface-1)] text-[var(--ink-muted)] shadow-[var(--shadow-float)] hover:text-[var(--danger)]"
                >
                  <Trash size={14} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="m-0 list-none overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-0">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex min-h-[var(--row-comfortable)] items-center gap-2 border-b border-[var(--border)] px-3 last:border-b-0"
            >
              <FileIcon attachment={file} />
              <a
                href={`${file.url}?download=1`}
                download={file.fileName}
                className="min-w-0 flex-1 truncate text-[var(--ink)] no-underline hover:underline"
              >
                {file.fileName}
              </a>
              <span className="shrink-0 text-xs text-[var(--ink-muted)]">
                {formatBytes(file.size)} · {file.author?.displayName} ·{' '}
                <span title={formatDateTime(file.createdAt)}>{formatRelative(file.createdAt)}</span>
              </span>
              {file.canDelete && (
                <button
                  type="button"
                  aria-label={t('issues.attachments.deleteNamed', { name: file.fileName })}
                  title={t('issues.attachments.deleteNamed', { name: file.fileName })}
                  onClick={() => setConfirming(file.id)}
                  className="grid size-7 place-items-center rounded-[var(--radius-md)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
                >
                  <Trash size={14} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {confirming && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] bg-[var(--danger-soft)] px-3 py-2"
        >
          <span className="flex-1">
            {t('issues.attachments.deleteConfirm', {
              name: all.find((attachment) => attachment.id === confirming)?.fileName ?? '',
            })}
          </span>
          <Button
            size="sm"
            variant="danger"
            disabled={remove.isPending}
            onClick={() => remove.mutate(confirming)}
          >
            {t('issues.attachments.delete')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
            {t('common.cancel')}
          </Button>
        </div>
      )}

      <Gallery
        images={images}
        index={viewing}
        onIndex={setViewing}
        onClose={() => setViewing(null)}
      />
    </section>
  );
}
