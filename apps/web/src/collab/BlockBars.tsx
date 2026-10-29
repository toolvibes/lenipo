import {
  ArrowsInLineHorizontal,
  Columns,
  Rows,
  TextAlignCenter,
  TextAlignLeft,
  TextAlignRight,
  Trash,
} from '@phosphor-icons/react';
import type { ImageAlignment } from '@tasklore/editor/schema';
import { type Editor, useEditorState } from '@tiptap/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Separator, ToolbarButton } from './Toolbar';

const bar = 'flex flex-wrap items-center gap-1 border-t border-[var(--border)] px-3 py-1.5';

function TextButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="h-7 rounded-[var(--radius-md)] px-2 text-sm text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
    >
      {label}
    </button>
  );
}

/** Rows, columns and the header row of the table around the cursor (W-EDT-06). */
export function TableBar({ editor }: { editor: Editor }) {
  const { t } = useTranslation();
  const chain = () => editor.chain().focus();
  return (
    <div role="toolbar" aria-label={t('editor.tableTools')} className={bar}>
      <span className="tl-label mr-1 text-[var(--ink-muted)]">{t('editor.table')}</span>
      <ToolbarButton
        icon={Rows}
        title={t('editor.addRow')}
        active={false}
        onClick={() => chain().addRowAfter().run()}
      />
      <ToolbarButton
        icon={Columns}
        title={t('editor.addColumn')}
        active={false}
        onClick={() => chain().addColumnAfter().run()}
      />
      <TextButton label={t('editor.deleteRow')} onClick={() => chain().deleteRow().run()} />
      <TextButton label={t('editor.deleteColumn')} onClick={() => chain().deleteColumn().run()} />
      <TextButton label={t('editor.headerRow')} onClick={() => chain().toggleHeaderRow().run()} />
      <TextButton label={t('editor.mergeCells')} onClick={() => chain().mergeOrSplit().run()} />
      <Separator />
      <ToolbarButton
        icon={Trash}
        title={t('editor.deleteTable')}
        active={false}
        onClick={() => chain().deleteTable().run()}
      />
    </div>
  );
}

const WIDTHS = [25, 50, 75, null] as const;
const ALIGNMENTS = [
  { value: 'left', icon: TextAlignLeft, label: 'editor.alignLeft' },
  { value: 'center', icon: TextAlignCenter, label: 'editor.alignCenter' },
  { value: 'right', icon: TextAlignRight, label: 'editor.alignRight' },
] as const satisfies ReadonlyArray<{ value: ImageAlignment; icon: unknown; label: string }>;

/** Size, alignment, caption and alternative text of the selected image (W-EDT-08). */
export function ImageBar({ editor }: { editor: Editor }) {
  const { t } = useTranslation();
  const attrs = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e.getAttributes('image') as {
        width: number | null;
        align: ImageAlignment;
        caption: string;
        alt: string | null;
      },
  });
  const [caption, setCaption] = useState(attrs.caption ?? '');
  const [alt, setAlt] = useState(attrs.alt ?? '');
  useEffect(() => setCaption(attrs.caption ?? ''), [attrs.caption]);
  useEffect(() => setAlt(attrs.alt ?? ''), [attrs.alt]);
  const update = (values: Record<string, unknown>) =>
    editor.chain().updateAttributes('image', values).run();
  const field =
    'h-7 min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-sm';

  return (
    <div role="toolbar" aria-label={t('editor.imageTools')} className={bar}>
      <span className="tl-label mr-1 text-[var(--ink-muted)]">{t('editor.image')}</span>
      {ALIGNMENTS.map(({ value, icon, label }) => (
        <ToolbarButton
          key={value}
          icon={icon}
          title={t(label)}
          active={attrs.align === value}
          onClick={() => update({ align: value })}
        />
      ))}
      <Separator />
      <ArrowsInLineHorizontal size={16} aria-hidden className="text-[var(--ink-muted)]" />
      {WIDTHS.map((width) => (
        <button
          key={width ?? 'full'}
          type="button"
          aria-pressed={attrs.width === width}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => update({ width })}
          className="h-7 rounded-[var(--radius-md)] px-2 text-sm text-[var(--ink-muted)] hover:bg-[var(--surface-2)] aria-pressed:bg-[var(--accent-soft)] aria-pressed:text-[var(--accent)]"
        >
          {width ? `${width} %` : t('editor.fullWidth')}
        </button>
      ))}
      <Separator />
      <input
        aria-label={t('editor.caption')}
        placeholder={t('editor.caption')}
        value={caption}
        maxLength={500}
        onChange={(event) => setCaption(event.target.value)}
        onBlur={() => update({ caption: caption.trim() })}
        onKeyDown={(event) => {
          // The bar sits inside the page form; Enter must not publish the page.
          if (event.key !== 'Enter') return;
          event.preventDefault();
          update({ caption: caption.trim() });
          editor.commands.focus();
        }}
        className={field}
      />
      <input
        aria-label={t('editor.altText')}
        placeholder={t('editor.altText')}
        value={alt}
        maxLength={500}
        onChange={(event) => setAlt(event.target.value)}
        onBlur={() => update({ alt: alt.trim() || null })}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          update({ alt: alt.trim() || null });
          editor.commands.focus();
        }}
        className={field}
      />
    </div>
  );
}
