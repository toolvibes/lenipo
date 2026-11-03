import {
  CaretCircleDown,
  ChartBar,
  ChartLine,
  CheckCircle,
  CheckSquare,
  CheckSquareOffset,
  ClockCounterClockwise,
  CodeBlock,
  Columns,
  FileArrowDown,
  FileMagnifyingGlass,
  FlowArrow,
  FrameCorners,
  type Icon,
  Image,
  Info,
  Lightbulb,
  ListBullets,
  ListChecks,
  ListDashes,
  ListMagnifyingGlass,
  ListNumbers,
  MagnifyingGlass,
  Minus,
  Paperclip,
  PuzzlePiece,
  Quotes,
  Rectangle,
  Scissors,
  Table,
  Tag,
  TextHOne,
  TextHThree,
  TextHTwo,
  TextT,
  Ticket,
  TreeStructure,
  Warning,
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
  // Macros (E-66): boxes wrap the current block, atoms are configured in place.
  const panel = (
    id: string,
    kind: 'info' | 'note' | 'warning' | 'success',
    icon: Icon,
    keywords: string,
  ) =>
    items.push({
      id,
      label: t(`editor.${id}` as 'editor.panelInfo'),
      keywords,
      icon,
      run: (editor) => editor.chain().focus().setPanel(kind).run(),
    });
  panel('panelInfo', 'info', Info, 'info infobox panel box');
  panel('panelNote', 'note', Lightbulb, 'hinweis note wichtig important panel box');
  panel('panelWarning', 'warning', Warning, 'warnung warning achtung panel box');
  panel('panelSuccess', 'success', CheckCircle, 'erfolg success tipp tip panel box');
  items.push(
    {
      id: 'expand',
      label: t('editor.expand'),
      keywords: 'aufklappen expand details einklappen toggle',
      icon: CaretCircleDown,
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent({ type: 'expand', attrs: { title: '' }, content: [{ type: 'paragraph' }] })
          .run(),
    },
    {
      id: 'status',
      label: t('editor.status'),
      keywords: 'status lozenge label farbe',
      icon: Tag,
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent({ type: 'status', attrs: { text: t('editor.status'), color: 'blue' } })
          .run(),
    },
    {
      id: 'toc',
      label: t('editor.toc'),
      keywords: 'inhaltsverzeichnis toc inhalt contents',
      icon: ListDashes,
      run: (editor) => editor.chain().focus().insertMacro('tableOfContents', { maxLevel: 3 }).run(),
    },
    {
      id: 'children',
      label: t('editor.children'),
      keywords: 'unterseiten children kinder seiten',
      icon: TreeStructure,
      run: (editor) => editor.chain().focus().insertMacro('childPages', { depth: 1 }).run(),
    },
    {
      id: 'issueMacro',
      label: t('editor.issueMacro'),
      keywords: 'vorgang issue jira ticket',
      icon: Ticket,
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent({ type: 'issue', attrs: { key: '' } })
          .run(),
    },
    {
      id: 'issueList',
      label: t('editor.issueList'),
      keywords: 'vorgangsliste issues tql abfrage query liste tabelle',
      icon: ListMagnifyingGlass,
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertMacro('issueList', { query: '', display: 'table', limit: 20 })
          .run(),
    },
    {
      id: 'placeholder',
      label: t('editor.placeholderMacro'),
      keywords: 'platzhalter anweisung hinweis vorlage placeholder instruction',
      icon: TextT,
      run: (editor) => {
        const text = window.prompt(t('editor.placeholderPrompt'), '');
        if (!text) return false;
        return editor.chain().focus().insertContent({ type: 'placeholder', attrs: { text } }).run();
      },
    },
    {
      id: 'columns',
      label: t('editor.columns'),
      keywords: 'spalten columns layout zwei drei',
      icon: Columns,
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'columns',
            attrs: { layout: '1-1' },
            content: [
              { type: 'column', content: [{ type: 'paragraph' }] },
              { type: 'column', content: [{ type: 'paragraph' }] },
            ],
          })
          .run(),
    },
    {
      id: 'section',
      label: t('editor.section'),
      keywords: 'hintergrund abschnitt section farbe',
      icon: Rectangle,
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'section',
            attrs: { tone: 'blue' },
            content: [{ type: 'paragraph' }],
          })
          .run(),
    },
    {
      id: 'excerpt',
      label: t('editor.excerpt'),
      keywords: 'auszug excerpt einbinden',
      icon: Scissors,
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent({ type: 'excerpt', attrs: { name: '' }, content: [{ type: 'paragraph' }] })
          .run(),
    },
    {
      id: 'properties',
      label: t('editor.properties'),
      keywords: 'seiteneigenschaften properties metadaten',
      icon: ListChecks,
      run: (editor) => {
        const cell = (text: string, header = false) => ({
          type: header ? 'tableHeader' : 'tableCell',
          content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
        });
        return editor
          .chain()
          .focus()
          .insertContent({
            type: 'pageProperties',
            content: [
              {
                type: 'table',
                content: [
                  {
                    type: 'tableRow',
                    content: [cell(t('editor.property'), true), cell(t('editor.value'), true)],
                  },
                  { type: 'tableRow', content: [cell('Status'), cell('')] },
                  { type: 'tableRow', content: [cell(t('editor.owner')), cell('')] },
                ],
              },
            ],
          })
          .run();
      },
    },
    {
      id: 'chart',
      label: t('editor.chart'),
      keywords: 'diagramm chart balken kreis linie tabelle',
      icon: ChartBar,
      run: (editor) => {
        const cell = (text: string, header = false) => ({
          type: header ? 'tableHeader' : 'tableCell',
          content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
        });
        return editor
          .chain()
          .focus()
          .insertContent({
            type: 'chart',
            attrs: { type: 'bar', title: '' },
            content: [
              {
                type: 'table',
                content: [
                  { type: 'tableRow', content: [cell('', true), cell('2026', true)] },
                  { type: 'tableRow', content: [cell('A'), cell('3')] },
                  { type: 'tableRow', content: [cell('B'), cell('5')] },
                ],
              },
            ],
          })
          .run();
      },
    },
    {
      id: 'mermaid',
      label: t('editor.mermaid'),
      keywords: 'mermaid diagramm flowchart sequenz',
      icon: FlowArrow,
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'codeBlock',
            attrs: { language: 'mermaid' },
            content: [{ type: 'text', text: 'flowchart LR\n  A[Idee] --> B[Umsetzung]' }],
          })
          .run(),
    },
    {
      id: 'includePage',
      label: t('editor.include'),
      keywords: 'einbinden include seite',
      icon: FileArrowDown,
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent({ type: 'includePage', attrs: { page: '' } })
          .run(),
    },
    {
      id: 'excerptInclude',
      label: t('editor.excerptInclude'),
      keywords: 'auszug einbinden excerpt include',
      icon: FileArrowDown,
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent({ type: 'excerptInclude', attrs: { page: '', name: '' } })
          .run(),
    },
    {
      id: 'propertiesReport',
      label: t('editor.propertiesReport'),
      keywords: 'seiteneigenschaften bericht properties report',
      icon: Table,
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent({ type: 'propertiesReport', attrs: { label: '', space: '' } })
          .run(),
    },
    {
      id: 'contentByLabel',
      label: t('editor.contentByLabel'),
      keywords: 'label inhalt nach label',
      icon: Tag,
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent({ type: 'contentByLabel', attrs: { labels: '', space: '', limit: 10 } })
          .run(),
    },
    {
      id: 'recentlyUpdated',
      label: t('editor.recentlyUpdated'),
      keywords: 'zuletzt aktualisiert recent',
      icon: ClockCounterClockwise,
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent({ type: 'recentlyUpdated', attrs: { space: '', limit: 10 } })
          .run(),
    },
    {
      id: 'taskReport',
      label: t('editor.taskReport'),
      keywords: 'aufgabenbericht aufgaben tasks',
      icon: CheckSquareOffset,
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent({ type: 'taskReport', attrs: { space: '', assignee: 'all' } })
          .run(),
    },
    {
      id: 'attachmentList',
      label: t('editor.attachmentList'),
      keywords: 'anhänge liste attachments galerie gallery',
      icon: Paperclip,
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent({ type: 'attachmentList', attrs: { images: false } })
          .run(),
    },
    {
      id: 'documentPreview',
      label: t('editor.documentPreview'),
      keywords: 'dokumentvorschau vorschau preview',
      icon: FileMagnifyingGlass,
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent({ type: 'documentPreview', attrs: { attachment: '' } })
          .run(),
    },
    {
      id: 'app',
      label: t('editor.appMacro'),
      keywords: 'app erweiterung extension plugin',
      icon: PuzzlePiece,
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'appMacro',
            attrs: { app: '', module: '', config: '', height: 300 },
          })
          .run(),
    },
    {
      id: 'embed',
      label: t('editor.embed'),
      keywords: 'embed iframe einbetten youtube figma grafana',
      icon: FrameCorners,
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent({ type: 'embed', attrs: { url: '', height: 400 } })
          .run(),
    },
    {
      id: 'liveSearch',
      label: t('editor.liveSearch'),
      keywords: 'live suche search',
      icon: MagnifyingGlass,
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent({ type: 'liveSearch', attrs: { space: '' } })
          .run(),
    },
    {
      id: 'report',
      label: t('editor.report'),
      keywords: 'bericht report diagramm chart cfd burnup control zeiterfassung',
      icon: ChartLine,
      run: (editor) =>
        editor
          .chain()
          .focus()
          .insertMacro('report', { kind: 'cfd', query: '', field: '', days: 30, boardId: '' })
          .run(),
    },
  );
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
