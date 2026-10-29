import { ChatCircle, CheckCircle, PencilSimple, Trash } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PageComment, RichText, TextAnchor } from '@tasklore/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { formatDateTime, formatRelative } from '../../lib/format';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { RichTextEditor, RichTextView, storedDoc } from '../tracking/RichTextEditor';
import { Avatar } from '../tracking/UserPicker';

/** Writing, editing, deleting and resolving comments of one page (E-63). */
export function useComments(pageId: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['page', pageId, 'comments'] });
  const path = (commentId: string) => ({ params: { path: { id: pageId, commentId } } });
  const create = useMutation({
    mutationFn: (body: { body: RichText; parentId?: string; anchor?: TextAnchor }) =>
      unwrap(
        client.POST('/api/v1/pages/{id}/comments', { params: { path: { id: pageId } }, body }),
      ),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: RichText }) =>
      unwrap(
        client.PATCH('/api/v1/pages/{id}/comments/{commentId}', { ...path(id), body: { body } }),
      ),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      unwrap(client.DELETE('/api/v1/pages/{id}/comments/{commentId}', path(id))),
    onSuccess: refresh,
  });
  const resolve = useMutation({
    mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) =>
      unwrap(
        resolved
          ? client.PUT('/api/v1/pages/{id}/comments/{commentId}/resolved', path(id))
          : client.DELETE('/api/v1/pages/{id}/comments/{commentId}/resolved', path(id)),
      ),
    onSuccess: refresh,
  });
  const error = create.error ?? update.error ?? remove.error ?? resolve.error;
  return { create, update, remove, resolve, error };
}

type Actions = ReturnType<typeof useComments>;

function CommentItem({
  comment,
  spaceKey,
  actions,
  compact,
}: {
  comment: PageComment;
  spaceKey: string;
  actions: Actions;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const iconButton =
    'grid size-7 place-items-center rounded-[var(--radius-sm)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]';
  return (
    <div className="flex gap-2.5">
      {comment.author ? (
        <Avatar user={comment.author} size={compact ? 22 : 28} />
      ) : (
        <span className="size-7 shrink-0" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">
            {comment.author?.displayName ?? t('wiki.unknownAuthor')}
          </span>
          <span
            className="text-xs text-[var(--ink-muted)]"
            title={formatDateTime(comment.createdAt)}
          >
            {formatRelative(comment.createdAt)}
            {comment.edited && ` · ${t('wiki.comments.edited')}`}
          </span>
          <span className="ml-auto flex">
            {comment.canEdit && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label={t('wiki.comments.edit')}
                title={t('wiki.comments.edit')}
                className={iconButton}
              >
                <PencilSimple size={14} aria-hidden />
              </button>
            )}
            {comment.canDelete && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(t('wiki.comments.deleteConfirm')))
                    actions.remove.mutate(comment.id);
                }}
                aria-label={t('wiki.comments.delete')}
                title={t('wiki.comments.delete')}
                className={`${iconButton} hover:text-[var(--danger)]`}
              >
                <Trash size={14} aria-hidden />
              </button>
            )}
          </span>
        </div>
        {comment.deleted || !comment.body ? (
          <p className="m-0 text-sm text-[var(--ink-muted)] italic">{t('wiki.comments.deleted')}</p>
        ) : editing ? (
          <RichTextEditor
            initial={storedDoc(comment.body)}
            placeholder={t('wiki.comments.placeholder')}
            submitLabel={t('common.save')}
            mentionSpaceKey={spaceKey}
            autoFocus
            busy={actions.update.isPending}
            onCancel={() => setEditing(false)}
            onSubmit={(body) =>
              actions.update.mutate(
                { id: comment.id, body },
                { onSuccess: () => setEditing(false) },
              )
            }
          />
        ) : (
          <div className="text-sm">
            <RichTextView doc={storedDoc(comment.body)} />
          </div>
        )}
      </div>
    </div>
  );
}

/** A comment with its answers and, for those who may comment, a reply box. */
export function Thread({
  root,
  replies,
  spaceKey,
  canComment,
  actions,
  compact,
}: {
  root: PageComment;
  replies: PageComment[];
  spaceKey: string;
  canComment: boolean;
  actions: Actions;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [replying, setReplying] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <CommentItem comment={root} spaceKey={spaceKey} actions={actions} compact={compact} />
      {replies.length > 0 && (
        <div className="ml-5 flex flex-col gap-3 border-l border-[var(--border)] pl-4">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              spaceKey={spaceKey}
              actions={actions}
              compact={compact}
            />
          ))}
        </div>
      )}
      {canComment &&
        (replying ? (
          <div className="ml-5">
            <RichTextEditor
              initial={null}
              placeholder={t('wiki.comments.replyPlaceholder')}
              submitLabel={t('wiki.comments.reply')}
              mentionSpaceKey={spaceKey}
              autoFocus
              clearOnSubmit
              busy={actions.create.isPending}
              onCancel={() => setReplying(false)}
              onSubmit={(body) =>
                actions.create.mutate(
                  { body, parentId: root.id },
                  { onSuccess: () => setReplying(false) },
                )
              }
            />
          </div>
        ) : (
          <div className="ml-5">
            <Button size="sm" variant="ghost" onClick={() => setReplying(true)}>
              {t('wiki.comments.reply')}
            </Button>
          </div>
        ))}
    </div>
  );
}

/** Answers by thread, in the order they were written. */
export function repliesByThread(comments: PageComment[]): Map<string, PageComment[]> {
  const replies = new Map<string, PageComment[]>();
  for (const comment of comments) {
    if (!comment.parentId) continue;
    replies.set(comment.parentId, [...(replies.get(comment.parentId) ?? []), comment]);
  }
  return replies;
}

/** Comments on the page as a whole, below its text and attachments (W-EDT-12). */
export function PageComments({
  pageId,
  spaceKey,
  comments,
  canComment,
}: {
  pageId: string;
  spaceKey: string;
  comments: PageComment[];
  canComment: boolean;
}) {
  const { t } = useTranslation();
  const actions = useComments(pageId);
  const roots = comments.filter((comment) => !comment.parentId && !comment.anchor);
  const replies = repliesByThread(comments);
  if (roots.length === 0 && !canComment) return null;
  return (
    <section
      aria-labelledby="page-comments"
      className="flex max-w-[var(--prose-measure)] flex-col gap-4 border-t border-[var(--border)] pt-4"
    >
      <h2 id="page-comments" className="tl-heading-md m-0 flex items-center gap-2">
        <ChatCircle size={18} aria-hidden />
        {t('wiki.comments.title', { count: roots.length })}
      </h2>
      {actions.error && <FormError message={actions.error.message} />}
      {roots.map((root) => (
        <Thread
          key={root.id}
          root={root}
          replies={replies.get(root.id) ?? []}
          spaceKey={spaceKey}
          canComment={canComment}
          actions={actions}
        />
      ))}
      {canComment && (
        <RichTextEditor
          initial={null}
          placeholder={t('wiki.comments.placeholder')}
          submitLabel={t('wiki.comments.send')}
          mentionSpaceKey={spaceKey}
          clearOnSubmit
          busy={actions.create.isPending}
          onSubmit={(body) => actions.create.mutate({ body })}
        />
      )}
    </section>
  );
}

/** Resolve or reopen an inline thread. */
export function ResolveButton({ comment, actions }: { comment: PageComment; actions: Actions }) {
  const { t } = useTranslation();
  const resolved = comment.resolved !== null;
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={actions.resolve.isPending}
      onClick={() => actions.resolve.mutate({ id: comment.id, resolved: !resolved })}
    >
      <CheckCircle size={14} weight={resolved ? 'regular' : 'fill'} aria-hidden />
      {resolved ? t('wiki.comments.reopen') : t('wiki.comments.resolve')}
    </Button>
  );
}
