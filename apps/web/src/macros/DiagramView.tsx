import * as RadixDialog from '@radix-ui/react-dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { uploadPageFile } from '../collab/uploads';
import { pageAttachmentsQuery } from '../lib/wiki';
import { Button } from '../ui/Button';

const ExcalidrawEditor = lazy(() => import('./ExcalidrawEditor'));

/** An attachment's content as a blob URL; SVG shown through <img> runs no script. */
function useBlobUrl(url: string | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!url) {
      setBlobUrl(null);
      return;
    }
    let revoked = false;
    let created: string | null = null;
    void fetch(url, { credentials: 'same-origin' })
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (!blob || revoked) return;
        created = URL.createObjectURL(new Blob([blob], { type: 'image/svg+xml' }));
        setBlobUrl(created);
      });
    return () => {
      revoked = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [url]);
  return blobUrl;
}

/**
 * A drawn diagram (W-EDT-15, TL-53, E-142): the Excalidraw scene and an SVG of it are page
 * attachments; readers and exports see the SVG, editors open Excalidraw in a full-screen dialog.
 */
export function DiagramView({ node, updateAttributes, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const pageId =
    (
      editor.extensionManager.extensions.find((extension) => extension.name === 'childPages')
        ?.options as { pageId?: string | null } | undefined
    )?.pageId ?? null;
  const attachments = useQuery({ ...pageAttachmentsQuery(pageId ?? ''), enabled: !!pageId });
  const urlOf = (id: string) => attachments.data?.find((entry) => entry.id === id)?.url ?? null;
  const svgUrl = useBlobUrl(node.attrs.svg ? urlOf(String(node.attrs.svg)) : null);
  const [editing, setEditing] = useState(false);
  const [scene, setScene] = useState<string | null>(null);

  const open = async () => {
    const url = node.attrs.scene ? urlOf(String(node.attrs.scene)) : null;
    setScene(
      url
        ? await fetch(url, { credentials: 'same-origin' }).then((response) => response.text())
        : null,
    );
    setEditing(true);
  };
  const save = async (json: string, svg: string) => {
    if (!pageId) throw new Error(t('diagram.noPage'));
    const [sceneFile, svgFile] = await Promise.all([
      uploadPageFile(pageId, new File([json], 'diagramm.excalidraw', { type: 'application/json' })),
      uploadPageFile(pageId, new File([svg], 'diagramm.svg', { type: 'image/svg+xml' })),
    ]);
    await queryClient.invalidateQueries({ queryKey: ['page', pageId, 'attachments'] });
    updateAttributes({ scene: sceneFile.id, svg: svgFile.id });
    setEditing(false);
  };
  const dark = document.documentElement.dataset.theme === 'dark';

  return (
    <NodeViewWrapper className="tl-macro" contentEditable={false}>
      {svgUrl ? (
        <img
          src={svgUrl}
          alt={t('diagram.alt')}
          className="max-w-full rounded-[var(--radius-md)] bg-white"
        />
      ) : (
        <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('diagram.empty')}</p>
      )}
      {editor.isEditable && (
        <div className="mt-2">
          <Button size="sm" onClick={() => void open()} disabled={!pageId}>
            {t('diagram.edit')}
          </Button>
        </div>
      )}
      <RadixDialog.Root open={editing} onOpenChange={setEditing}>
        <RadixDialog.Portal>
          <RadixDialog.Content
            aria-describedby={undefined}
            // Escape belongs to Excalidraw (leave text, drop a selection), never closes the drawing.
            onEscapeKeyDown={(event) => event.preventDefault()}
            className="fixed inset-0 z-50 flex flex-col bg-[var(--surface-1)]"
          >
            <RadixDialog.Title className="sr-only">{t('diagram.title')}</RadixDialog.Title>
            <Suspense fallback={<p className="m-0 p-6">{t('common.loading')}</p>}>
              {editing && (
                <ExcalidrawEditor
                  scene={scene}
                  dark={dark}
                  onSave={save}
                  onCancel={() => setEditing(false)}
                />
              )}
            </Suspense>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </NodeViewWrapper>
  );
}
