import type { Attachment, Problem } from '@tasklore/shared';
import { type Editor, Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';

/** Uploads one file to a page as multipart/form-data (the typed client only speaks JSON). */
export async function uploadPageFile(pageId: string, file: File): Promise<Attachment> {
  const form = new FormData();
  form.append('file', file, file.name);
  const response = await fetch(`/api/v1/pages/${pageId}/attachments`, {
    method: 'POST',
    body: form,
    credentials: 'same-origin',
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as Problem | null;
    throw new Error(problem?.detail ?? problem?.title ?? response.statusText);
  }
  return response.json() as Promise<Attachment>;
}

/** Puts an uploaded file into the text: images as image blocks, other files as a link. */
export function insertAttachment(editor: Editor, attachment: Attachment, at?: number) {
  const content = attachment.image
    ? { type: 'image', attrs: { attachmentId: attachment.id, alt: attachment.fileName } }
    : {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: attachment.fileName,
            marks: [{ type: 'link', attrs: { href: `${attachment.url}?download=1` } }],
          },
        ],
      };
  const chain = editor.chain().focus();
  (at === undefined ? chain.insertContent(content) : chain.insertContentAt(at, content)).run();
}

/** Files pasted or dropped into the editor are handed to `onFiles` instead of the browser. */
export const FileInput = Extension.create<{
  onFiles: ((files: File[], at?: number) => void) | null;
}>({
  name: 'fileInput',

  addOptions() {
    return { onFiles: null };
  },

  addProseMirrorPlugins() {
    const onFiles = this.options.onFiles;
    if (!onFiles) return [];
    return [
      new Plugin({
        props: {
          handlePaste: (_view, event) => {
            const files = [...(event.clipboardData?.files ?? [])];
            if (files.length === 0) return false;
            onFiles(files);
            return true;
          },
          handleDrop: (view, event, _slice, moved) => {
            const files = [...(event.dataTransfer?.files ?? [])];
            if (moved || files.length === 0) return false;
            event.preventDefault();
            const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
            onFiles(files, at);
            return true;
          },
        },
      }),
    ];
  },
});
