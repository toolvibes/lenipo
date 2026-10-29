import { blockExtensions } from '@tasklore/editor/schema';
import type { RichText, RichTextOutput } from '@tasklore/shared';
import { type Content, Extension } from '@tiptap/core';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Toolbar } from '../../collab/Toolbar';
import { Button } from '../../ui/Button';
import { mentionExtension } from './mention';

/**
 * The document of a rich text field. The web app always reads JSON; Markdown text (E-51) would
 * only arrive from a client that asked for it, and is shown as one paragraph to be safe.
 */
export function storedDoc(value: RichTextOutput): RichText;
export function storedDoc(value: RichTextOutput | null): RichText | null;
export function storedDoc(value: RichTextOutput | null): RichText | null {
  if (typeof value !== 'string') return value;
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }],
  };
}

interface RichTextEditorProps {
  initial: RichText | null;
  placeholder: string;
  submitLabel: string;
  onSubmit: (doc: RichText) => void;
  onCancel?: () => void;
  busy?: boolean;
  /** Empties the editor after submitting (comment composer). */
  clearOnSubmit?: boolean;
  autoFocus?: boolean;
  /** Enables @-mentions of the people in this project. */
  mentionProjectKey?: string;
  /** Enables @-mentions of the people who can see this wiki space. */
  mentionSpaceKey?: string;
}

/** Rich text for descriptions and comments; the same document format as wiki pages. */
export function RichTextEditor({
  initial,
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
  busy = false,
  clearOnSubmit = false,
  autoFocus = false,
  mentionProjectKey,
  mentionSpaceKey,
}: RichTextEditorProps) {
  const { t } = useTranslation();
  // The shortcut extension is created once, so it calls the latest submit through a ref.
  const submitRef = useRef(() => {});
  const editor = useEditor({
    extensions: [
      StarterKit,
      ...blockExtensions({ resizableTables: true }),
      Placeholder.configure({ placeholder }),
      mentionExtension(
        mentionProjectKey
          ? { project: mentionProjectKey }
          : mentionSpaceKey
            ? { space: mentionSpaceKey }
            : undefined,
      ),
      Extension.create({
        name: 'submitShortcut',
        addKeyboardShortcuts: () => ({
          'Mod-Enter': () => {
            submitRef.current();
            return true;
          },
        }),
      }),
    ],
    // RichText is a ProseMirror document produced by this same editor schema.
    content: (initial ?? undefined) as Content | undefined,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: { class: 'tl-prose !min-h-24 px-4 py-3', 'aria-label': placeholder },
    },
  });
  if (!editor) return null;

  function submit() {
    if (!editor) return;
    onSubmit(editor.getJSON() as RichText);
    if (clearOnSubmit) editor.commands.clearContent();
  }
  submitRef.current = submit;

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] focus-within:border-[var(--accent)]">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      <div className="flex justify-end gap-2 border-t border-[var(--border)] px-3 py-2">
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        )}
        <Button size="sm" variant="primary" onClick={submit} disabled={busy}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

/**
 * Read-only rendering of a stored document. `page` uses the same typography as the
 * collaborative editor, so a wiki page reads as it was written.
 */
export function RichTextView({
  doc,
  variant = 'compact',
}: {
  doc: RichText;
  variant?: 'compact' | 'page';
}) {
  const editor = useEditor(
    {
      extensions: [StarterKit, ...blockExtensions(), mentionExtension()],
      content: doc as Content,
      editable: false,
      ...(variant === 'page'
        ? { editorProps: { attributes: { class: 'tl-prose tl-prose-read' } } }
        : {}),
    },
    [JSON.stringify(doc), variant],
  );
  return (
    <EditorContent
      editor={editor}
      className="[&_.tiptap]:tl-prose [&_.tiptap]:min-h-0 [&_.tiptap]:max-w-none"
    />
  );
}
