import {
  Code,
  CodeBlock,
  type Icon,
  ListBullets,
  ListNumbers,
  Quotes,
  TextB,
  TextHOne,
  TextHTwo,
  TextItalic,
  TextStrikethrough,
} from '@phosphor-icons/react';
import { type Editor, useEditorState } from '@tiptap/react';
import { useTranslation } from 'react-i18next';

interface ToolbarButtonProps {
  icon: Icon;
  title: string;
  active: boolean;
  onClick: () => void;
}

function ToolbarButton({ icon: IconComponent, title, active, onClick }: ToolbarButtonProps) {
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

function Separator() {
  return <span className="mx-1 h-5 w-px bg-[var(--border)]" />;
}

export function Toolbar({ editor }: { editor: Editor }) {
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
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <div
      role="toolbar"
      aria-label={t('editor.toolbar')}
      className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] px-3 py-1.5"
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
        icon={CodeBlock}
        title={t('editor.codeBlock')}
        active={state.codeBlock}
        onClick={() => chain().toggleCodeBlock().run()}
      />
    </div>
  );
}
