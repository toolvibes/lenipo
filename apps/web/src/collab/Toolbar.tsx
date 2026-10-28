import { type Editor, useEditorState } from '@tiptap/react';

interface ToolbarButtonProps {
  label: string;
  title: string;
  active?: boolean;
  onClick: () => void;
}

function ToolbarButton({ label, title, active = false, onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`min-w-8 rounded-md px-2 py-1 text-sm font-medium transition-colors ${
        active
          ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
          : 'text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]'
      }`}
    >
      {label}
    </button>
  );
}

export function Toolbar({ editor }: { editor: Editor }) {
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
      aria-label="Formatierung"
      className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] px-3 py-2"
    >
      <ToolbarButton
        label="H1"
        title="Überschrift 1"
        active={state.h1}
        onClick={() => chain().toggleHeading({ level: 1 }).run()}
      />
      <ToolbarButton
        label="H2"
        title="Überschrift 2"
        active={state.h2}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      />
      <span className="mx-1 h-5 w-px bg-[var(--border)]" />
      <ToolbarButton
        label="B"
        title="Fett"
        active={state.bold}
        onClick={() => chain().toggleBold().run()}
      />
      <ToolbarButton
        label="I"
        title="Kursiv"
        active={state.italic}
        onClick={() => chain().toggleItalic().run()}
      />
      <ToolbarButton
        label="S"
        title="Durchgestrichen"
        active={state.strike}
        onClick={() => chain().toggleStrike().run()}
      />
      <ToolbarButton
        label="</>"
        title="Code"
        active={state.code}
        onClick={() => chain().toggleCode().run()}
      />
      <span className="mx-1 h-5 w-px bg-[var(--border)]" />
      <ToolbarButton
        label="• Liste"
        title="Aufzählung"
        active={state.bulletList}
        onClick={() => chain().toggleBulletList().run()}
      />
      <ToolbarButton
        label="1. Liste"
        title="Nummerierte Liste"
        active={state.orderedList}
        onClick={() => chain().toggleOrderedList().run()}
      />
      <ToolbarButton
        label="Zitat"
        title="Zitat"
        active={state.blockquote}
        onClick={() => chain().toggleBlockquote().run()}
      />
      <ToolbarButton
        label="Codeblock"
        title="Codeblock"
        active={state.codeBlock}
        onClick={() => chain().toggleCodeBlock().run()}
      />
    </div>
  );
}
