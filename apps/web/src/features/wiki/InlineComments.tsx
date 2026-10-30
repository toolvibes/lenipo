import { ChatCircleText } from '@phosphor-icons/react';
import { anchorFromSelection, anchorRange } from '@tasklore/editor/anchors';
import { blockExtensions, starterKitOptions } from '@tasklore/editor/schema';
import type { PageComment, RichText, TextAnchor } from '@tasklore/shared';
import { type Content, Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { type MouseEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { macroViews } from '../../macros/views';
import { FormError } from '../../ui/FormError';
import { mentionExtension } from '../tracking/mention';
import { RichTextEditor } from '../tracking/RichTextEditor';
import { ResolveButton, repliesByThread, Thread, useComments } from './comments';

interface Highlight {
  id: string;
  anchor: TextAnchor;
}

/** Marks the quoted text of open inline threads in the read-only page (E-63). */
const CommentHighlights = Extension.create<{ threads: Highlight[]; active: string | null }>({
  name: 'commentHighlights',
  addOptions() {
    return { threads: [], active: null };
  },
  addProseMirrorPlugins() {
    const { threads, active } = this.options;
    return [
      new Plugin({
        props: {
          decorations: (state) =>
            DecorationSet.create(
              state.doc,
              threads.flatMap((thread) => {
                const range = anchorRange(state.doc, thread.anchor);
                if (!range || range.to <= range.from) return [];
                return [
                  Decoration.inline(range.from, range.to, {
                    class: `tl-comment-anchor${thread.id === active ? ' is-active' : ''}`,
                    'data-thread': thread.id,
                  }),
                ];
              }),
            ),
        },
      }),
    ];
  },
});

/** Inline threads still shown in the text: neither resolved nor detached. */
export const openThreads = (comments: PageComment[]) =>
  comments.filter(
    (comment) => !comment.parentId && comment.anchor && !comment.resolved && !comment.detached,
  );

/**
 * The published page with its commented passages. Selecting text inside one block offers
 * "Comment" to those who may comment (W-EDT-11).
 */
export function CommentedText({
  doc,
  spaceKey,
  pageId,
  comments,
  active,
  canComment,
  onOpen,
  onQuote,
}: {
  doc: RichText;
  spaceKey: string;
  pageId: string;
  comments: PageComment[];
  active: string | null;
  canComment: boolean;
  onOpen: (id: string) => void;
  onQuote: (anchor: TextAnchor) => void;
}) {
  const { t } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const [offer, setOffer] = useState<{ anchor: TextAnchor; top: number; left: number } | null>(
    null,
  );
  const threads = openThreads(comments).map((comment) => ({
    id: comment.id,
    anchor: comment.anchor as TextAnchor,
  }));
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure(starterKitOptions),
        ...blockExtensions({ views: macroViews, children: { spaceKey, pageId } }),
        mentionExtension(),
        CommentHighlights.configure({ threads, active }),
      ],
      content: doc as Content,
      editable: false,
      editorProps: { attributes: { class: 'tl-prose tl-prose-read' } },
    },
    [JSON.stringify(doc), JSON.stringify(threads), active],
  );

  useEffect(() => {
    if (!active) return;
    container.current
      ?.querySelector(`[data-thread="${active}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [active]);

  function onMouseUp() {
    const selection = window.getSelection();
    if (!editor || !canComment || !selection || selection.isCollapsed || !container.current) {
      setOffer(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!editor.view.dom.contains(range.commonAncestorContainer)) return setOffer(null);
    const from = editor.view.posAtDOM(range.startContainer, range.startOffset);
    const to = editor.view.posAtDOM(range.endContainer, range.endOffset);
    const anchor = anchorFromSelection(editor.state.doc, from, to);
    if (!anchor) return setOffer(null);
    const box = range.getBoundingClientRect();
    const frame = container.current.getBoundingClientRect();
    setOffer({ anchor, top: box.bottom - frame.top + 6, left: box.left - frame.left });
  }

  function onClick(event: MouseEvent) {
    const thread = (event.target as HTMLElement).closest('[data-thread]');
    if (thread) onOpen(thread.getAttribute('data-thread') ?? '');
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: mouse-only shortcut; threads are also reachable in the side column
    // biome-ignore lint/a11y/useKeyWithClickEvents: see above
    <div ref={container} className="relative" onMouseUp={onMouseUp} onClick={onClick}>
      <EditorContent
        editor={editor}
        className="[&_.tiptap]:tl-prose [&_.tiptap]:min-h-0 [&_.tiptap]:max-w-none"
      />
      {offer && (
        <button
          type="button"
          style={{ top: offer.top, left: offer.left }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onQuote(offer.anchor);
            setOffer(null);
            window.getSelection()?.removeAllRanges();
          }}
          className="absolute z-10 flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2.5 text-sm font-semibold shadow-[var(--shadow-float)] hover:bg-[var(--surface-2)]"
        >
          <ChatCircleText size={16} aria-hidden />
          {t('wiki.comments.comment')}
        </button>
      )}
    </div>
  );
}

function Quote({ text }: { text: string }) {
  return (
    <blockquote className="m-0 border-l-2 border-[var(--accent)] pl-2 text-sm text-[var(--ink-muted)]">
      „{text}“
    </blockquote>
  );
}

/** The inline threads beside the page: open ones in text order, then resolved and detached. */
export function InlineThreads({
  pageId,
  spaceKey,
  comments,
  canComment,
  active,
  onActivate,
  draft,
  onDraftDone,
}: {
  pageId: string;
  spaceKey: string;
  comments: PageComment[];
  canComment: boolean;
  active: string | null;
  onActivate: (id: string | null) => void;
  draft: TextAnchor | null;
  onDraftDone: (id: string | null) => void;
}) {
  const { t } = useTranslation();
  const actions = useComments(pageId);
  const [showResolved, setShowResolved] = useState(false);
  const replies = repliesByThread(comments);
  const roots = comments.filter((comment) => !comment.parentId && comment.anchor);
  const byPosition = (a: PageComment, b: PageComment) =>
    (a.anchor?.block ?? 0) - (b.anchor?.block ?? 0) ||
    (a.anchor?.prefix.length ?? 0) - (b.anchor?.prefix.length ?? 0);
  const open = openThreads(comments).sort(byPosition);
  const resolved = roots.filter((comment) => comment.resolved);
  const detached = roots.filter((comment) => !comment.resolved && comment.detached);

  useEffect(() => {
    if (active) document.getElementById(`thread-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const card = (root: PageComment) => (
    <li
      key={root.id}
      id={`thread-${root.id}`}
      className={`flex flex-col gap-2 rounded-[var(--radius-md)] border bg-[var(--surface-1)] p-3 ${
        root.id === active ? 'border-[var(--accent)]' : 'border-[var(--border)]'
      }`}
    >
      <button
        type="button"
        onClick={() => onActivate(root.id === active ? null : root.id)}
        className="text-left"
        aria-label={t('wiki.comments.showPassage')}
      >
        <Quote text={root.anchor?.exact ?? ''} />
      </button>
      <Thread
        root={root}
        replies={replies.get(root.id) ?? []}
        spaceKey={spaceKey}
        canComment={canComment}
        actions={actions}
        compact
      />
      {canComment && (
        <div className="flex justify-end">
          <ResolveButton comment={root} actions={actions} />
        </div>
      )}
    </li>
  );

  return (
    <aside aria-label={t('wiki.comments.inline')} className="flex flex-col gap-3">
      <h2 className="tl-label m-0 text-[var(--ink-muted)]">
        {t('wiki.comments.inlineCount', { count: open.length })}
      </h2>
      {actions.error && <FormError message={actions.error.message} />}
      {draft && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--surface-1)] p-3">
          <Quote text={draft.exact} />
          <RichTextEditor
            initial={null}
            placeholder={t('wiki.comments.placeholder')}
            submitLabel={t('wiki.comments.send')}
            mentionSpaceKey={spaceKey}
            autoFocus
            busy={actions.create.isPending}
            onCancel={() => onDraftDone(null)}
            onSubmit={(body) =>
              actions.create.mutate(
                { body, anchor: draft },
                { onSuccess: (created) => onDraftDone(created.id) },
              )
            }
          />
        </div>
      )}
      <ul className="m-0 flex list-none flex-col gap-3 p-0">{open.map(card)}</ul>
      {detached.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="tl-label m-0 text-[var(--ink-muted)]">
            {t('wiki.comments.detached', { count: detached.length })}
          </h3>
          <p className="m-0 text-xs text-[var(--ink-muted)]">{t('wiki.comments.detachedHelp')}</p>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">{detached.map(card)}</ul>
        </section>
      )}
      {resolved.length > 0 && (
        <section className="flex flex-col gap-2">
          <button
            type="button"
            aria-expanded={showResolved}
            onClick={() => setShowResolved((value) => !value)}
            className="tl-label text-left text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            {t('wiki.comments.resolvedCount', { count: resolved.length })}
          </button>
          {showResolved && (
            <ul className="m-0 flex list-none flex-col gap-3 p-0 opacity-80">
              {resolved.map(card)}
            </ul>
          )}
        </section>
      )}
    </aside>
  );
}
