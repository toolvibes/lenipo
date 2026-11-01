import type { HtmlNode } from '@toolvibes/editor';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

export interface DocxImage {
  data: Buffer;
  type: 'png' | 'jpg' | 'gif';
  width: number;
  height: number;
}

/** Rows of a data macro (an issue list) resolved by the caller: headings first. */
export type MacroTable = string[][];

export interface DocxPage {
  title: string;
  /** Space and parent pages, shown above the title. */
  path: string;
  /** Version, author and date. */
  meta: string;
  content: unknown;
}

export interface DocxOptions {
  images: Map<string, DocxImage>;
  /** A table for a data macro, a sentence for others, or null for the default note. */
  macro: (node: HtmlNode, page: number) => MacroTable | string | null;
  note: (name: string) => string;
  /** Running header, e.g. space and page title. */
  header: string;
  /** "Page" in the reader's language, for the footer. */
  pageWord: string;
  /** A table of contents (Word fills it in when the file is opened). */
  contents: string | null;
}

/** Width and height of a PNG, GIF or JPEG, or null for other formats (WebP stays text). */
export function imageSize(
  data: Buffer,
): { type: DocxImage['type']; width: number; height: number } | null {
  if (data.length > 24 && data.readUInt32BE(0) === 0x89504e47) {
    return { type: 'png', width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  if (data.length > 10 && data.toString('ascii', 0, 3) === 'GIF') {
    return { type: 'gif', width: data.readUInt16LE(6), height: data.readUInt16LE(8) };
  }
  if (data.length > 4 && data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < data.length) {
      if (data[offset] !== 0xff) return null;
      const marker = data[offset + 1] as number;
      const length = data.readUInt16BE(offset + 2);
      // Start-of-frame markers, except the ones for huffman tables and arithmetic coding.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return {
          type: 'jpg',
          height: data.readUInt16BE(offset + 5),
          width: data.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
  }
  return null;
}

const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

const PANEL_FILLS: Record<string, string> = {
  info: 'E8F0FB',
  note: 'F1ECFA',
  warning: 'FDF3DC',
  success: 'E6F4EA',
};

const MAX_IMAGE_WIDTH = 600;

type Inline = TextRun | ExternalHyperlink | ImageRun;
type Block = Paragraph | Table | TableOfContents;

interface Style {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  underline?: boolean;
  code?: boolean;
  href?: string;
}

/** Wiki pages as one Word document (W-EXP-02, E-111); each page starts on a new sheet. */
export async function toDocx(pages: DocxPage[], options: DocxOptions): Promise<Buffer> {
  let lists = 0;
  let current = 0;

  const run = (text: string, style: Style): TextRun =>
    new TextRun({
      text,
      bold: style.bold,
      italics: style.italics,
      strike: style.strike,
      underline: style.underline ? {} : undefined,
      font: style.code ? 'Consolas' : undefined,
      shading: style.code ? { type: ShadingType.CLEAR, fill: 'F2F2F2', color: 'auto' } : undefined,
      style: style.href ? 'Hyperlink' : undefined,
    });

  const inline = (nodes: HtmlNode[] = [], base: Style = {}): Inline[] =>
    nodes.flatMap((node): Inline[] => {
      const attrs = node.attrs ?? {};
      switch (node.type) {
        case 'text': {
          const style: Style = { ...base };
          for (const mark of node.marks ?? []) {
            if (mark.type === 'bold') style.bold = true;
            if (mark.type === 'italic') style.italics = true;
            if (mark.type === 'strike') style.strike = true;
            if (mark.type === 'underline') style.underline = true;
            if (mark.type === 'code') style.code = true;
            if (mark.type === 'link' && /^(https?:|mailto:)/i.test(String(mark.attrs?.href))) {
              style.href = String(mark.attrs?.href);
            }
          }
          const text = run(node.text ?? '', style);
          return style.href
            ? [new ExternalHyperlink({ link: style.href, children: [text] })]
            : [text];
        }
        case 'hardBreak':
          return [new TextRun({ text: '', break: 1 })];
        case 'mention':
          return [run(`@${String(attrs.label ?? '')}`, { ...base, bold: true })];
        case 'status':
          return [
            run(` ${String(attrs.text ?? '').toUpperCase()} `, { ...base, bold: true, code: true }),
          ];
        case 'issue':
          return [run(String(attrs.key ?? ''), { ...base, code: true })];
        case 'placeholder':
          return [];
        default:
          return inline(node.content, base);
      }
    });

  const paragraph = (
    children: Inline[],
    extra: Partial<ConstructorParameters<typeof Paragraph>[0] & object> = {},
  ) => new Paragraph({ ...extra, children });

  /** A shaded single-cell table around blocks: panels, sections, expandable sections. */
  const box = (children: Block[], fill: string): Table =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill, color: 'auto' },
              margins: { top: 120, bottom: 120, left: 160, right: 160 },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                left: { style: BorderStyle.SINGLE, size: 18, color: '8A8A8A' },
              },
              children: cellContent(children),
            }),
          ],
        }),
      ],
    });

  const cellContent = (blocks: Block[]): Array<Paragraph | Table> => {
    const allowed = blocks.filter(
      (block): block is Paragraph | Table => !(block instanceof TableOfContents),
    );
    return allowed.length > 0 ? allowed : [new Paragraph({})];
  };

  const textTable = (rows: MacroTable): Table =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rows.map(
        (row, index) =>
          new TableRow({
            tableHeader: index === 0,
            children: row.map(
              (text) =>
                new TableCell({
                  children: [paragraph([run(text, { bold: index === 0 })])],
                }),
            ),
          }),
      ),
    });

  const note = (text: string) => paragraph([run(text, { italics: true })]);

  const blocks = (
    nodes: HtmlNode[] = [],
    level = 0,
    list?: { ordered: boolean; instance: number },
  ): Block[] =>
    nodes.flatMap((node): Block[] => {
      const attrs = node.attrs ?? {};
      switch (node.type) {
        case 'paragraph':
          return [paragraph(inline(node.content))];
        case 'heading': {
          const depth = Math.min(6, Math.max(1, Number(attrs.level ?? 1)));
          return [paragraph(inline(node.content), { heading: HEADINGS[depth - 1] })];
        }
        case 'blockquote':
          return [box(blocks(node.content, level), 'FFFFFF')];
        case 'horizontalRule':
          return [
            new Paragraph({
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'BFBFBF', space: 1 } },
            }),
          ];
        case 'bulletList':
        case 'orderedList':
        case 'taskList': {
          const ordered = node.type === 'orderedList';
          lists += 1;
          const nested = { ordered, instance: lists };
          return (node.content ?? []).flatMap((item) => blocks([item], level, nested));
        }
        case 'listItem':
        case 'taskItem': {
          const [first, ...rest] = node.content ?? [];
          const check = node.type === 'taskItem' ? [run(attrs.checked ? '☑ ' : '☐ ', {})] : [];
          const marker =
            list?.ordered === true
              ? {
                  numbering: {
                    reference: 'ordered',
                    level: Math.min(level, 8),
                    instance: list.instance,
                  },
                }
              : { bullet: { level: Math.min(level, 8) } };
          const head =
            first?.type === 'paragraph'
              ? [paragraph([...check, ...inline(first.content)], marker)]
              : [paragraph(check, marker), ...blocks(first ? [first] : [], level + 1)];
          return [...head, ...blocks(rest, level + 1)];
        }
        case 'codeBlock': {
          const lines = (node.content ?? [])
            .map((child) => child.text ?? '')
            .join('')
            .split('\n');
          return [
            ...(attrs.title ? [paragraph([run(String(attrs.title), { bold: true })])] : []),
            box(
              lines.map((line) =>
                paragraph([run(line, { code: true })], { spacing: { after: 0 } }),
              ),
              'F5F5F5',
            ),
          ];
        }
        case 'table':
          return [
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: (node.content ?? []).map(
                (row) =>
                  new TableRow({
                    children: (row.content ?? []).map((cell) => {
                      const header = cell.type === 'tableHeader';
                      const span = (value: unknown) =>
                        Number(value ?? 1) > 1 ? Number(value) : undefined;
                      return new TableCell({
                        columnSpan: span(cell.attrs?.colspan),
                        rowSpan: span(cell.attrs?.rowspan),
                        shading: header
                          ? { type: ShadingType.CLEAR, fill: 'F2F2F2', color: 'auto' }
                          : undefined,
                        children: cellContent(blocks(cell.content)),
                      });
                    }),
                  }),
              ),
            }),
          ];
        case 'image': {
          const image = options.images.get(String(attrs.attachmentId ?? ''));
          const caption = attrs.caption
            ? [paragraph([run(String(attrs.caption), { italics: true })])]
            : [];
          if (!image) return [note(String(attrs.alt || options.note('image'))), ...caption];
          const share = attrs.width ? Number(attrs.width) / 100 : 1;
          const width = Math.min(image.width, Math.round(MAX_IMAGE_WIDTH * share));
          const height = Math.round((image.height * width) / Math.max(1, image.width));
          const align =
            attrs.align === 'center'
              ? AlignmentType.CENTER
              : attrs.align === 'right'
                ? AlignmentType.RIGHT
                : undefined;
          return [
            paragraph(
              [
                new ImageRun({
                  type: image.type,
                  data: image.data,
                  transformation: { width, height },
                  altText: {
                    name: String(attrs.alt ?? ''),
                    description: String(attrs.alt ?? ''),
                    title: '',
                  },
                }),
              ],
              { alignment: align },
            ),
            ...caption,
          ];
        }
        case 'panel':
          return [box(blocks(node.content), PANEL_FILLS[String(attrs.kind)] ?? 'F2F2F2')];
        case 'expand':
          return [
            box(
              [
                paragraph([run(String(attrs.title ?? ''), { bold: true })]),
                ...blocks(node.content),
              ],
              'FAFAFA',
            ),
          ];
        case 'section':
          return [box(blocks(node.content), 'F7F7F7')];
        case 'columns':
          return [
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: (node.content ?? []).map(
                    (column) =>
                      new TableCell({
                        borders: {
                          top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                          bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                          left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                          right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                        },
                        children: cellContent(blocks(column.content)),
                      }),
                  ),
                }),
              ],
            }),
          ];
        case 'column':
        case 'excerpt':
        case 'pageProperties':
          return blocks(node.content, level);
        case 'chart':
          return [
            ...(attrs.title ? [paragraph([run(String(attrs.title), { bold: true })])] : []),
            ...blocks(node.content, level),
          ];
        case 'placeholder':
        case 'tableOfContents':
          // Word builds the contents of the whole document; see `contents`.
          return [];
        default: {
          const resolved = options.macro(node, current);
          if (Array.isArray(resolved)) return [textTable(resolved)];
          if (typeof resolved === 'string') return [note(resolved)];
          if (node.content) return blocks(node.content, level);
          return [note(options.note(node.type ?? ''))];
        }
      }
    });

  const children: Block[] = [];
  if (options.contents) {
    children.push(
      new TableOfContents(options.contents, { hyperlink: true, headingStyleRange: '1-3' }),
    );
  }
  pages.forEach((page, index) => {
    current = index;
    children.push(
      paragraph([run(page.path, { italics: true })], {
        pageBreakBefore: index > 0 || options.contents !== null,
      }),
      paragraph([new TextRun(page.title)], { heading: HeadingLevel.TITLE }),
      paragraph([run(page.meta, { italics: true })]),
      ...blocks((page.content as HtmlNode | null)?.content),
    );
  });

  const levels = Array.from({ length: 9 }, (_, level) => ({
    level,
    format: LevelFormat.DECIMAL,
    text: `%${level + 1}.`,
    alignment: AlignmentType.START,
    style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
  }));
  const document = new Document({
    title: pages[0]?.title,
    features: { updateFields: options.contents !== null },
    numbering: { config: [{ reference: 'ordered', levels }] },
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              paragraph([new TextRun({ text: options.header, size: 16, color: '808080' })], {
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              paragraph(
                [
                  new TextRun({
                    size: 16,
                    color: '808080',
                    children: [
                      `${options.pageWord} `,
                      PageNumber.CURRENT,
                      ' / ',
                      PageNumber.TOTAL_PAGES,
                    ],
                  }),
                ],
                { alignment: AlignmentType.CENTER },
              ),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(document);
}
