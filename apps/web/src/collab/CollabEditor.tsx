import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useTranslation } from 'react-i18next';
import { Toolbar } from './Toolbar';
import type { CollabIdentity, CollabSession } from './useCollabDocument';

interface CollabEditorProps {
  session: CollabSession;
  identity: CollabIdentity;
}

export function CollabEditor({ session, identity }: CollabEditorProps) {
  const { t } = useTranslation();
  const editor = useEditor(
    {
      extensions: [
        // Undo/redo comes from the collaboration extension (per user, Yjs-aware).
        StarterKit.configure({ undoRedo: false }),
        Placeholder.configure({
          placeholder: t('editor.placeholder'),
        }),
        Collaboration.configure({ document: session.doc }),
        CollaborationCaret.configure({ provider: session.provider, user: identity }),
      ],
      editorProps: {
        attributes: { class: 'tl-prose', 'aria-label': t('editor.content') },
      },
    },
    [session],
  );

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
