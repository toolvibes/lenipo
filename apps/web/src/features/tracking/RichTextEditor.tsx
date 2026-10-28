import type { RichText } from '@tasklore/shared';
import type { Content } from '@tiptap/core';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useTranslation } from 'react-i18next';
import { Toolbar } from '../../collab/Toolbar';
import { Button } from '../../ui/Button';

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
}: RichTextEditorProps) {
  const { t } = useTranslation();
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder })],
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

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] focus-within:border-[var(--accent)]">
      <Toolbar editor={editor} />
      <div
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            submit();
          }
        }}
      >
        <EditorContent editor={editor} />
      </div>
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

/** Read-only rendering of a stored document. */
export function RichTextView({ doc }: { doc: RichText }) {
  const editor = useEditor({ extensions: [StarterKit], content: doc as Content, editable: false }, [
    JSON.stringify(doc),
  ]);
  return (
    <EditorContent
      editor={editor}
      className="[&_.tiptap]:tl-prose [&_.tiptap]:min-h-0 [&_.tiptap]:max-w-none"
    />
  );
}
