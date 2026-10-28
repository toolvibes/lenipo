import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { CollabIdentity } from './identity';
import { Toolbar } from './Toolbar';
import type { CollabSession } from './useCollabDocument';

interface CollabEditorProps {
  session: CollabSession;
  identity: CollabIdentity;
}

export function CollabEditor({ session, identity }: CollabEditorProps) {
  const editor = useEditor(
    {
      extensions: [
        // Undo/redo comes from the collaboration extension (per user, Yjs-aware).
        StarterKit.configure({ undoRedo: false }),
        Placeholder.configure({ placeholder: 'Schreib los, andere sehen es sofort …' }),
        Collaboration.configure({ document: session.doc }),
        CollaborationCaret.configure({ provider: session.provider, user: identity }),
      ],
      editorProps: {
        attributes: { class: 'tl-prose', 'aria-label': 'Dokumentinhalt' },
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
      <div className="px-6 py-6 sm:px-10">
        <EditorContent editor={editor} />
      </div>
    </>
  );
}
