import { describe, expect, it } from 'vitest';
import { docToMarkdown, markdownToDoc } from './markdown.js';
import { imageAttachmentIds, isValidDoc } from './schema.js';

const IMAGE = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

const BLOCKS = [
  '## Plan',
  '',
  '- [x] Entwurf schreiben',
  '- [ ] Review mit **Mira**',
  '  - [ ] Unterpunkt',
  '',
  '| Name | Rolle |',
  '| --- | --- |',
  '| Mira | Design \\| UX |',
  '| Olaf | `api` |',
  '',
  `![Architektur](attachment:${IMAGE} "Bild 1: \\"Überblick\\"")`,
  '',
  '- normal',
  '- [ ] gemischt bleibt eine Liste',
].join('\n');

describe('tables, task lists and images (E-61)', () => {
  it('reads them from Markdown', () => {
    const doc = markdownToDoc(BLOCKS) as { content: Array<{ type: string; attrs?: unknown }> };
    expect(doc.content.map((node) => node.type)).toEqual([
      'heading',
      'taskList',
      'table',
      'image',
      'bulletList',
    ]);
    expect(doc.content[3]?.attrs).toEqual({
      attachmentId: IMAGE,
      alt: 'Architektur',
      width: null,
      align: 'center',
      caption: 'Bild 1: "Überblick"',
    });
    expect(isValidDoc(doc)).toBe(true);
    expect(imageAttachmentIds(doc)).toEqual([IMAGE]);
  });

  it('keeps them on a round trip', () => {
    const doc = markdownToDoc(BLOCKS);
    const markdown = docToMarkdown(doc);
    expect(markdown).toContain('- [x] Entwurf schreiben');
    expect(markdown).toContain('| Mira | Design \\| UX |');
    expect(markdownToDoc(markdown)).toEqual(doc);
  });

  it('checks image and table attributes', () => {
    const image = (attrs: Record<string, unknown>) => ({
      type: 'doc',
      content: [{ type: 'image', attrs: { attachmentId: IMAGE, ...attrs } }],
    });
    expect(isValidDoc(image({ width: 50, align: 'left' }))).toBe(true);
    expect(isValidDoc(image({ width: 5 }))).toBe(false);
    expect(isValidDoc(image({ align: 'top' }))).toBe(false);
    expect(isValidDoc(image({ attachmentId: 'https://evil.example/x.png' }))).toBe(false);
    const cell = (attrs: Record<string, unknown>) => ({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [{ type: 'tableCell', attrs, content: [{ type: 'paragraph' }] }],
            },
          ],
        },
      ],
    });
    expect(isValidDoc(cell({ colwidth: [120] }))).toBe(true);
    expect(isValidDoc(cell({ colspan: 0 }))).toBe(false);
  });

  it('writes plain images and other Markdown images as text', () => {
    const doc = markdownToDoc('![Tracker](https://evil.example/pixel.png)') as {
      content: Array<{ type: string }>;
    };
    expect(doc.content[0]?.type).toBe('paragraph');
    expect(imageAttachmentIds(doc)).toEqual([]);
  });
});
