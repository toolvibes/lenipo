import {
  CheckSquare,
  Code,
  CodeBlock,
  type Icon,
  ListBullets,
  ListNumbers,
  Paperclip,
  Quotes,
  Table,
  TextB,
  TextHOne,
  TextHTwo,
  TextItalic,
  TextStrikethrough,
} from '@phosphor-icons/react';
import { type Editor, useEditorState } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import { ImageBar, PanelBar, TableBar } from './BlockBars';

interface ToolbarButtonProps {
  icon: Icon;
  title: string;
  active: boolean;
  onClick: () => void;
}

export function ToolbarButton({ icon: IconComponent, title, active, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`grid size-7 place-items-center rounded-[var(--radius-md)] transition-colors ${
        active
          ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
          : 'text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
      }`}
    >
      <IconComponent size={16} weight={active ? 'bold' : 'regular'} />
    </button>
  );
}

export function Separator() {
  return <span className="mx-1 h-5 w-px bg-[var(--border)]" />;
}

/** Formatting for the editor; `onInsertFile` adds the upload button (wiki pages, E-61). */
export function Toolbar({ editor, onInsertFile }: { editor: Editor; onInsertFile?: () => void }) {
  const { t } = useTranslation();
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      blockquote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'),
      taskList: e.isActive('taskList'),
      table: e.isActive('table'),
      image: e.isActive('image'),
      panel: e.isActive('panel'),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <div className="border-b border-[var(--border)] bg-[var(--surface-1)]">
      <div
        role="toolbar"
        aria-label={t('editor.toolbar')}
        className="flex flex-wrap items-center gap-1 px-3 py-1.5"
      >
        <ToolbarButton
          icon={TextHOne}
          title={t('editor.heading1')}
          active={state.h1}
          onClick={() => chain().toggleHeading({ level: 1 }).run()}
        />
        <ToolbarButton
          icon={TextHTwo}
          title={t('editor.heading2')}
          active={state.h2}
          onClick={() => chain().toggleHeading({ level: 2 }).run()}
        />
        <Separator />
        <ToolbarButton
          icon={TextB}
          title={t('editor.bold')}
          active={state.bold}
          onClick={() => chain().toggleBold().run()}
        />
        <ToolbarButton
          icon={TextItalic}
          title={t('editor.italic')}
          active={state.italic}
          onClick={() => chain().toggleItalic().run()}
        />
        <ToolbarButton
          icon={TextStrikethrough}
          title={t('editor.strike')}
          active={state.strike}
          onClick={() => chain().toggleStrike().run()}
        />
        <ToolbarButton
          icon={Code}
          title={t('editor.code')}
          active={state.code}
          onClick={() => chain().toggleCode().run()}
        />
        <Separator />
        <ToolbarButton
          icon={ListBullets}
          title={t('editor.bulletList')}
          active={state.bulletList}
          onClick={() => chain().toggleBulletList().run()}
        />
        <ToolbarButton
          icon={ListNumbers}
          title={t('editor.orderedList')}
          active={state.orderedList}
          onClick={() => chain().toggleOrderedList().run()}
        />
        <ToolbarButton
          icon={Quotes}
          title={t('editor.quote')}
          active={state.blockquote}
          onClick={() => chain().toggleBlockquote().run()}
        />
        <ToolbarButton
          icon={CheckSquare}
          title={t('editor.taskList')}
          active={state.taskList}
          onClick={() => chain().toggleTaskList().run()}
        />
        <ToolbarButton
          icon={CodeBlock}
          title={t('editor.codeBlock')}
          active={state.codeBlock}
          onClick={() => chain().toggleCodeBlock().run()}
        />
        <Separator />
        <ToolbarButton
          icon={Table}
          title={t('editor.table')}
          active={state.table}
          onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        />
        {onInsertFile && (
          <ToolbarButton
            icon={Paperclip}
            title={t('editor.insertFile')}
            active={false}
            onClick={onInsertFile}
          />
        )}
      </div>
      {state.table && <TableBar editor={editor} />}
      {state.image && <ImageBar editor={editor} />}
      {state.panel && <PanelBar editor={editor} />}
    </div>
  );
}
