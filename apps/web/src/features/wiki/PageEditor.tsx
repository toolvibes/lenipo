import { ChatCircleText } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { Editor } from '@tiptap/react';
import type { Me, RichText } from '@toolvibes/shared';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CollabEditor } from '../../collab/CollabEditor';
import { PresenceBar } from '../../collab/PresenceBar';
import { StatusBadge } from '../../collab/StatusBadge';
import { useCollabDocument } from '../../collab/useCollabDocument';
import { client, unwrap } from '../../lib/api';
import { presenceColor } from '../../lib/presence';
import { useRealtimeRooms } from '../../lib/realtime';
import { pageCommentsQuery, pageQuery } from '../../lib/wiki';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { openThreads } from './InlineComments';
import { Breadcrumbs } from './WikiPage';

/** JSON with object keys sorted; stored documents come back from `jsonb` in another key order. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) =>
    entry && typeof entry === 'object' && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : entry,
  );
}

/** Did the draft move away from the published version? Compared as editor JSON. */
function useDraftChanged(editor: Editor | null, published: RichText | null): boolean {
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    if (!editor) return;
    const reference = canonical(published ?? { type: 'doc', content: [{ type: 'paragraph' }] });
    const check = () => setChanged(canonical(editor.getJSON()) !== reference);
    check();
    editor.on('update', check);
    return () => {
      editor.off('update', check);
    };
  }, [editor, published]);
  return changed;
}

/**
 * Edits the live draft together with others and publishes it as the next version (W-PAG-03,
 * -04; W-EDT-11; E-59). Only editors get here; the collab service rejects everyone else.
 */
export function PageEditor({ me, spaceKey, id }: { me: Me; spaceKey: string; id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const page = useQuery(pageQuery(id));
  const comments = useQuery(pageCommentsQuery(id));
  useRealtimeRooms([`page:${id}`]);
  const identity = useMemo(() => ({ name: me.displayName, color: presenceColor(me.id) }), [me]);
  const { session, status, synced, unsyncedChanges, peers, authError } = useCollabDocument(
    `page:${id}`,
  );
  const [editor, setEditor] = useState<Editor | null>(null);
  const onEditor = useCallback((next: Editor | null) => setEditor(next), []);
  const [title, setTitle] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const shownTitle = title ?? page.data?.title ?? '';
  const draftChanged = useDraftChanged(editor, (page.data?.content as RichText | null) ?? null);
  const changed =
    draftChanged || (page.data !== undefined && shownTitle.trim() !== page.data.title);

  const publish = useMutation({
    mutationFn: () => {
      if (!editor) throw new Error('Editor not ready');
      return unwrap(
        client.POST('/api/v1/pages/{id}/publish', {
          params: { path: { id } },
          body: {
            title: shownTitle.trim(),
            content: editor.getJSON() as RichText,
            comment: comment.trim(),
          },
        }),
      );
    },
    onSuccess: async (published) => {
      queryClient.setQueryData(pageQuery(id).queryKey, published);
      await queryClient.invalidateQueries({ queryKey: ['space', spaceKey] });
      await navigate({ to: '/spaces/$key/pages/$id', params: { key: spaceKey, id } });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Only the publish button publishes: Enter in the title, a macro or a toolbar field must
    // not, and React lets submits from forms inside the editor bubble up to here.
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (event.target !== event.currentTarget || submitter?.dataset.action !== 'publish') return;
    if (shownTitle.trim()) publish.mutate();
  }

  if (page.error) {
    return (
      <main className="px-6 py-6">
        <p className="m-0 text-[var(--danger)]">{page.error.message}</p>
      </main>
    );
  }
  if (!page.data) return null;
  const openComments = openThreads(comments.data ?? []).length;

  return (
    <form onSubmit={submit} className="flex flex-col">
      {/* A disabled first submit button turns off implicit submission by Enter in any field. */}
      <button type="submit" disabled hidden aria-hidden tabIndex={-1} />
      <div className="sticky top-[var(--sticky-top)] z-10 flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-1)] px-6 py-2">
        <Breadcrumbs page={page.data} current={page.data.title} />
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {openComments > 0 && (
            <Link
              to="/spaces/$key/pages/$id"
              params={{ key: spaceKey, id }}
              className="flex items-center gap-1 text-xs text-[var(--ink-muted)] no-underline hover:underline"
            >
              <ChatCircleText size={14} aria-hidden />
              {t('wiki.comments.openInEditor', { count: openComments })}
            </Link>
          )}
          <StatusBadge status={status} synced={synced} unsyncedChanges={unsyncedChanges} />
          <PresenceBar peers={peers} />
        </div>
      </div>
      <main className="flex flex-col gap-4 px-4 py-5 sm:px-6">
        {authError ? (
          <p className="m-0 rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-soft)] p-4 text-[var(--danger)]">
            {t('collab.accessDenied', { reason: authError })}
          </p>
        ) : (
          <>
            <input
              value={shownTitle}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={255}
              aria-label={t('wiki.pageTitle')}
              placeholder={t('wiki.pageTitle')}
              className="tl-field-plain tl-heading-xl w-full border-0 border-b border-transparent bg-transparent px-0 outline-none focus:border-[var(--accent)]"
            />
            <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)]">
              {session && (
                <CollabEditor
                  session={session}
                  identity={identity}
                  pageId={id}
                  spaceKey={spaceKey}
                  onEditor={onEditor}
                />
              )}
            </div>
          </>
        )}
        {publish.error && <FormError message={publish.error.message} />}
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-60 flex-1 flex-col gap-1">
            <span className="tl-label text-[var(--ink-muted)]">{t('wiki.changeComment')}</span>
            <input
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={500}
              placeholder={t('wiki.changeCommentHint')}
              className="h-[var(--control-md)] rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2"
            />
          </label>
          <span className="text-sm text-[var(--ink-muted)]" aria-live="polite">
            {page.data.version === 0
              ? t('wiki.notPublishedYet')
              : changed
                ? t('wiki.unpublishedChanges')
                : t('wiki.matchesPublished', { number: page.data.version })}
          </span>
          <Link
            to="/spaces/$key/pages/$id"
            params={{ key: spaceKey, id }}
            className="inline-flex h-[var(--control-md)] items-center rounded-[var(--radius-md)] px-3 font-semibold text-[var(--ink)] no-underline hover:bg-[var(--surface-2)]"
          >
            {t('wiki.close')}
          </Link>
          <Button
            type="submit"
            data-action="publish"
            variant="primary"
            disabled={
              !editor ||
              !synced ||
              !shownTitle.trim() ||
              publish.isPending ||
              (!changed && page.data.version > 0)
            }
          >
            {page.data.approval.required && !page.data.approval.canApprove
              ? t('approval.submit')
              : t('wiki.publish')}
          </Button>
        </div>
      </main>
    </form>
  );
}
