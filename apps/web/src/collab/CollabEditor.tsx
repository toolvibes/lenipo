import { useQueryClient } from '@tanstack/react-query';
import { blockExtensions, starterKitOptions } from '@tasklore/editor/schema';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { Placeholder } from '@tiptap/extensions';
import { type Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mentionExtension } from '../features/tracking/mention';
import { macroViews } from '../macros/views';
import { FormError } from '../ui/FormError';
import { matchItems, SlashCommands, slashItems } from './SlashMenu';
import { Toolbar } from './Toolbar';
import { FileInput, insertAttachment, uploadPageFile } from './uploads';
import type { CollabIdentity, CollabSession } from './useCollabDocument';

interface CollabEditorProps {
  session: CollabSession;
  identity: CollabIdentity;
  /** The page whose draft this is; files pasted, dropped or picked become its attachments. */
  pageId: string;
  spaceKey: string;
  /** Hands out the editor, e.g. to publish its document. */
  onEditor?: (editor: Editor | null) => void;
}

/** The Yjs fragment holding the draft; the server seeds the same one (E-59). */
const DRAFT_FIELD = 'default';

export function CollabEditor({ session, identity, pageId, spaceKey, onEditor }: CollabEditorProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Extensions are created once; they reach the current editor and page through refs.
  const upload = useRef<(files: File[], at?: number) => Promise<void>>(async () => {});
  upload.current = async (files: File[], at?: number) => {
    setUploadError(null);
    for (const file of files) {
      setUploading((count) => count + 1);
      try {
        const attachment = await uploadPageFile(pageId, file);
        if (editorRef.current) insertAttachment(editorRef.current, attachment, at);
      } catch (error) {
        setUploadError(t('editor.uploadFailed', { name: file.name, message: String(error) }));
      } finally {
        setUploading((count) => count - 1);
      }
    }
    await queryClient.invalidateQueries({ queryKey: ['page', pageId, 'attachments'] });
  };
  const pickFile = () => fileInput.current?.click();

  const editor = useEditor(
    {
      extensions: [
        // Undo/redo comes from the collaboration extension (per user, Yjs-aware).
        StarterKit.configure({ ...starterKitOptions, undoRedo: false }),
        // Same schema as stored pages (packages/editor), so publishing never loses content.
        ...blockExtensions({
          resizableTables: true,
          views: macroViews,
          children: { spaceKey, pageId },
        }),
        mentionExtension(),
        Placeholder.configure({
          placeholder: t('editor.placeholder'),
        }),
        SlashCommands.configure({
          items: (query) => matchItems(slashItems(t, pickFile), query),
        }),
        FileInput.configure({ onFiles: (files, at) => void upload.current(files, at) }),
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
    editorRef.current = editor;
    onEditor?.(editor);
    return () => onEditor?.(null);
  }, [editor, onEditor]);

  if (!editor) {
    return null;
  }

  return (
    <>
      <Toolbar editor={editor} onInsertFile={pickFile} />
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = '';
          if (files.length > 0) void upload.current(files);
        }}
      />
      {(uploading > 0 || uploadError) && (
        <div className="px-6 pt-3 sm:px-12">
          {uploading > 0 && (
            <p role="status" className="m-0 text-sm text-[var(--ink-muted)]">
              {t('editor.uploading')}
            </p>
          )}
          {uploadError && <FormError message={uploadError} />}
        </div>
      )}
      <div className="px-6 py-8 sm:px-12">
        <EditorContent editor={editor} />
      </div>
    </>
  );
}
