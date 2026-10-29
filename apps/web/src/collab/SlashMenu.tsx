import {
  CheckSquare,
  CodeBlock,
  type Icon,
  Image,
  ListBullets,
  ListNumbers,
  Minus,
  Quotes,
  Table,
  TextHOne,
  TextHThree,
  TextHTwo,
} from '@phosphor-icons/react';
import { type Editor, Extension, type Range } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion';
import type { TFunction } from 'i18next';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface SlashItem {
  id: string;
  label: string;
  /** Further words that find the item, in German and English. */
  keywords: string;
  icon: Icon;
  run: (editor: Editor) => void;
}

/** The blocks offered after "/" (W-EDT-05); images only where uploads are possible. */
export function slashItems(t: TFunction, onImage?: () => void): SlashItem[] {
  const items: SlashItem[] = [
    {
      id: 'heading1',
      label: t('editor.heading1'),
      keywords: 'h1 überschrift heading titel',
      icon: TextHOne,
      run: (editor) => editor.chain().focus().setHeading({ level: 1 }).run(),
    },
    {
      id: 'heading2',
      label: t('editor.heading2'),
      keywords: 'h2 überschrift heading',
      icon: TextHTwo,
      run: (editor) => editor.chain().focus().setHeading({ level: 2 }).run(),
    },
    {
      id: 'heading3',
      label: t('editor.heading3'),
      keywords: 'h3 überschrift heading',
      icon: TextHThree,
      run: (editor) => editor.chain().focus().setHeading({ level: 3 }).run(),
    },
    {
      id: 'bulletList',
      label: t('editor.bulletList'),
      keywords: 'liste aufzählung bullet list ul',
      icon: ListBullets,
      run: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
      id: 'orderedList',
      label: t('editor.orderedList'),
      keywords: 'liste nummeriert numbered ordered ol',
      icon: ListNumbers,
      run: (editor) => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      id: 'taskList',
      label: t('editor.taskList'),
      keywords: 'aufgaben todo checkliste task checkbox',
      icon: CheckSquare,
      run: (editor) => editor.chain().focus().toggleTaskList().run(),
    },
    {
      id: 'table',
      label: t('editor.table'),
      keywords: 'tabelle table grid',
      icon: Table,
      run: (editor) =>
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      id: 'quote',
      label: t('editor.quote'),
      keywords: 'zitat quote blockquote',
      icon: Quotes,
      run: (editor) => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      id: 'codeBlock',
      label: t('editor.codeBlock'),
      keywords: 'code codeblock snippet',
      icon: CodeBlock,
      run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      id: 'divider',
      label: t('editor.divider'),
      keywords: 'trennlinie linie divider hr rule',
      icon: Minus,
      run: (editor) => editor.chain().focus().setHorizontalRule().run(),
    },
  ];
  if (onImage) {
    items.push({
      id: 'image',
      label: t('editor.image'),
      keywords: 'bild image foto grafik datei anhang upload',
      icon: Image,
      run: () => onImage(),
    });
  }
  return items;
}

export function matchItems(items: SlashItem[], query: string): SlashItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(needle));
}

interface SlashListHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const SlashList = forwardRef<SlashListHandle, SuggestionProps<SlashItem>>(function SlashList(
  { items, command },
  ref,
) {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const [itemsSeen, setItemsSeen] = useState(items);
  if (itemsSeen !== items) {
    setItemsSeen(items);
    setActive(0);
  }
  const pick = (index: number) => {
    const item = items[index];
    if (item) command(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false;
      if (event.key === 'ArrowDown') {
        setActive((index) => (index + 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowUp') {
        setActive((index) => (index - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        pick(active);
        return true;
      }
      return false;
    },
  }));

  return (
    <div
      role="listbox"
      aria-label={t('editor.slashMenu')}
      className="max-h-80 w-60 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-1 shadow-[var(--shadow-float)]"
    >
      {items.length === 0 ? (
        <div className="px-2 py-1.5 text-[var(--ink-muted)]">{t('editor.slashNone')}</div>
      ) : (
        items.map((item, index) => (
          <div
            key={item.id}
            role="option"
            aria-selected={index === active}
            tabIndex={-1}
            // Keep the focus in the editor.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => pick(index)}
            onKeyDown={() => {}}
            className={`flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 ${
              index === active ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : ''
            }`}
          >
            <item.icon size={18} aria-hidden />
            <span className="truncate">{item.label}</span>
          </div>
        ))
      )}
    </div>
  );
});

function place(element: HTMLElement, rect: DOMRect | null | undefined) {
  if (!rect) return;
  element.style.position = 'fixed';
  element.style.zIndex = '50';
  element.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - 330)}px`;
  element.style.left = `${Math.min(rect.left, window.innerWidth - 248)}px`;
}

/** Typing "/" at the start of a word opens the block menu (W-EDT-05). */
export const SlashCommands = Extension.create<{ items: (query: string) => SlashItem[] }>({
  name: 'slashCommands',

  addOptions() {
    return { items: () => [] };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        allowSpaces: false,
        items: ({ query }) => this.options.items(query),
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashItem }) => {
          editor.chain().focus().deleteRange(range).run();
          props.run(editor);
        },
        render: () => {
          let renderer: ReactRenderer<SlashListHandle, SuggestionProps<SlashItem>> | null = null;
          const close = () => {
            renderer?.destroy();
            renderer?.element.remove();
            renderer = null;
          };
          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashList, { props, editor: props.editor });
              document.body.appendChild(renderer.element);
              place(renderer.element as HTMLElement, props.clientRect?.());
            },
            onUpdate: (props) => {
              renderer?.updateProps(props);
              if (renderer) place(renderer.element as HTMLElement, props.clientRect?.());
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                close();
                return true;
              }
              return renderer?.ref?.onKeyDown(props) ?? false;
            },
            onExit: close,
          };
        },
      }),
    ];
  },
});
