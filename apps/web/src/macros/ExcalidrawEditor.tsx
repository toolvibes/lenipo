import '@excalidraw/excalidraw/index.css';
import { Excalidraw, exportToSvg, serializeAsJSON } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';

// Fonts come from our own origin (CSP), copied there by the build (TL-53, E-142).
(window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH = '/excalidraw/';

/** Excalidraw, loaded only when a diagram is edited; hands back the scene and an SVG. */
export default function ExcalidrawEditor({
  scene,
  dark,
  onSave,
  onCancel,
}: {
  scene: string | null;
  dark: boolean;
  onSave: (scene: string, svg: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { t, i18n } = useTranslation();
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const initial = scene ? (JSON.parse(scene) as Record<string, unknown>) : null;

  const save = async () => {
    const current = api.current;
    if (!current) return;
    setSaving(true);
    setError('');
    try {
      const elements = current.getSceneElements();
      const appState = current.getAppState();
      const files = current.getFiles();
      const svg = await exportToSvg({
        elements,
        appState: { ...appState, exportBackground: true, exportWithDarkMode: false },
        files,
      });
      await onSave(
        serializeAsJSON(elements, appState, files, 'local'),
        new XMLSerializer().serializeToString(svg),
      );
    } catch (failure) {
      setError((failure as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2">
        <span className="flex-1 text-sm font-semibold">{t('diagram.title')}</span>
        {error && <span className="text-sm text-[var(--danger)]">{error}</span>}
        <Button size="sm" onClick={onCancel} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button size="sm" variant="primary" onClick={() => void save()} disabled={saving}>
          {t('common.save')}
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <Excalidraw
          excalidrawAPI={(instance) => {
            api.current = instance;
          }}
          initialData={
            initial
              ? {
                  elements: initial.elements as never,
                  appState: { ...(initial.appState as object), collaborators: new Map() } as never,
                  files: initial.files as never,
                }
              : null
          }
          theme={dark ? 'dark' : 'light'}
          langCode={i18n.language.startsWith('de') ? 'de-DE' : 'en'}
        />
      </div>
    </div>
  );
}
