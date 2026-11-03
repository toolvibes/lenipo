import { CheckCircle, Hourglass, XCircle } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Page, RichText } from '@toolvibes/shared';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { pageQuery } from '../../lib/wiki';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { RichTextView } from '../tracking/RichTextEditor';

/**
 * The approval state of a page (W-PAG-12, TL-51, E-135): a version waiting for approval, with
 * approve and reject for approvers, or the last rejection with its comment.
 */
export function ApprovalBanner({ page }: { page: Page }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showing, setShowing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const { pending, rejected, canApprove } = page.approval;
  const path = { params: { path: { id: page.id } } };
  const settle = (updated: Page) => {
    queryClient.setQueryData(pageQuery(page.id).queryKey, updated);
    void queryClient.invalidateQueries({ queryKey: ['space', page.space.key] });
  };
  const approve = useMutation({
    mutationFn: () => unwrap(client.POST('/api/v1/pages/{id}/approval/approve', path)),
    onSuccess: settle,
  });

  if (pending) {
    return (
      <section
        aria-label={t('approval.pendingTitle')}
        className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--warning-soft)] px-3 py-2.5 text-[13.5px]"
      >
        <p className="m-0 flex items-start gap-2">
          <Hourglass size={18} aria-hidden className="mt-0.5 shrink-0 text-[var(--warning)]" />
          <span>
            {t('approval.pending', {
              name: pending.author?.displayName ?? t('wiki.unknownAuthor'),
              when: formatRelative(pending.submittedAt),
            })}
            {pending.comment && (
              <span className="block text-[var(--ink-muted)]">„{pending.comment}“</span>
            )}
          </span>
        </p>
        {approve.error && <FormError message={approve.error.message} />}
        <div className="flex flex-wrap gap-2">
          {pending.content && (
            <Button size="sm" onClick={() => setShowing(!showing)} aria-expanded={showing}>
              {showing ? t('approval.hide') : t('approval.show')}
            </Button>
          )}
          {canApprove && (
            <>
              <Button
                size="sm"
                variant="primary"
                disabled={approve.isPending}
                onClick={() => approve.mutate()}
              >
                <CheckCircle size={16} aria-hidden />
                {t('approval.approve')}
              </Button>
              <Button size="sm" variant="danger" onClick={() => setRejecting(true)}>
                <XCircle size={16} aria-hidden />
                {t('approval.reject')}
              </Button>
            </>
          )}
        </div>
        {showing && pending.content && (
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-3">
            <h2 className="tl-heading-md m-0 mb-2">{pending.title}</h2>
            <RichTextView
              doc={pending.content as RichText}
              variant="page"
              page={{ spaceKey: page.space.key, pageId: page.id }}
            />
          </div>
        )}
        <RejectDialog page={page} open={rejecting} onOpenChange={setRejecting} onDone={settle} />
      </section>
    );
  }
  if (rejected && (page.canEdit || canApprove)) {
    return (
      <p className="m-0 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--danger-soft)] px-3 py-2.5 text-[13.5px]">
        <XCircle size={18} aria-hidden className="mt-0.5 shrink-0 text-[var(--danger)]" />
        <span>
          {t('approval.rejected', {
            name: rejected.by?.displayName ?? t('wiki.unknownAuthor'),
            when: formatRelative(rejected.at),
          })}
          <span className="block text-[var(--ink-muted)]">„{rejected.comment}“</span>
        </span>
      </p>
    );
  }
  return null;
}

function RejectDialog({
  page,
  open,
  onOpenChange,
  onDone,
}: {
  page: Page;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (page: Page) => void;
}) {
  const { t } = useTranslation();
  const [comment, setComment] = useState('');
  const reject = useMutation({
    mutationFn: () =>
      unwrap(
        client.POST('/api/v1/pages/{id}/approval/reject', {
          params: { path: { id: page.id } },
          body: { comment: comment.trim() },
        }),
      ),
    onSuccess: (updated) => {
      onDone(updated);
      setComment('');
      onOpenChange(false);
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (comment.trim()) reject.mutate();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('approval.rejectTitle')} width={480}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {reject.error && <FormError message={reject.error.message} />}
        <label className="flex flex-col gap-1">
          <span className="tl-field-label">{t('approval.rejectComment')}</span>
          <textarea
            rows={4}
            required
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] p-2 text-[var(--ink)]"
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="danger" disabled={reject.isPending || !comment.trim()}>
            {t('approval.reject')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Approvers choose per page whether new versions wait for approval. */
export function useApprovalMode(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mode: Page['approval']['mode']) =>
      unwrap(
        client.PUT('/api/v1/pages/{id}/approval-mode', {
          params: { path: { id: pageId } },
          body: { mode },
        }),
      ),
    onSuccess: (updated) => queryClient.setQueryData(pageQuery(pageId).queryKey, updated),
  });
}
