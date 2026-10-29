import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { Placeholder } from '@tiptap/extensions';
import { type Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { mentionExtension } from '../features/tracking/mention';
import { Toolbar } from './Toolbar';
import type { CollabIdentity, CollabSession } from './useCollabDocument';

interface CollabEditorProps {
  session: CollabSession;
  identity: CollabIdentity;
  /** Hands out the editor, e.g. to publish its document. */
  onEditor?: (editor: Editor | null) => void;
}

/** The Yjs fragment holding the draft; the server seeds the same one (E-59). */
const DRAFT_FIELD = 'default';

export function CollabEditor({ session, identity, onEditor }: CollabEditorProps) {
  const { t } = useTranslation();
  const editor = useEditor(
    {
      extensions: [
        // Undo/redo comes from the collaboration extension (per user, Yjs-aware).
        StarterKit.configure({ undoRedo: false }),
        // Same schema as stored pages (packages/editor), so publishing never loses content.
        mentionExtension(),
        Placeholder.configure({
          placeholder: t('editor.placeholder'),
        }),
        Collaboration.configure({ document: session.doc, field: DRAFT_FIELD }),
        CollaborationCaret.configure({ provider: session.provider, user: identity }),
      ],
      editorProps: {
        attributes: { class: 'tl-prose', 'aria-label': t('editor.content') },
      },
    },
    [session],
  );

  useEffect(() => {
    onEditor?.(editor);
    return () => onEditor?.(null);
  }, [editor, onEditor]);

  if (!editor) {
    return null;
  }

  return (
    <>
      <Toolbar editor={editor} />
      <div className="px-6 py-8 sm:px-12">
        <EditorContent editor={editor} />
      </div>
    </>
  );
}
