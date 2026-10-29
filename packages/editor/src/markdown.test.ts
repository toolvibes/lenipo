import { describe, expect, it } from 'vitest';
import { docToMarkdown, markdownToDoc, reviewMentions } from './markdown.js';

const ID = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

const SAMPLE = [
  '# Login schlägt fehl',
  '',
  'Nach **5 Minuten** erscheint eine *leere* Seite, siehe ~~alt~~ [Ticket](https://example.org/t/1 "Titel") und `token`.',
  '',
  `> Zitat mit @[Mira Kaya](user:${ID})`,
  '',
  '- erster Punkt',
  '- zweiter Punkt',
  '  - eingerückt',
  '',
  '3. drei',
  '4. vier',
  '',
  '```ts',
  'const a = 1;',
  '```',
  '',
  '---',
  '',
  'Zeile eins  ',
  'Zeile zwei',
].join('\n');

describe('Markdown', () => {
  it('keeps everything Markdown can express on a round trip', () => {
    const doc = markdownToDoc(SAMPLE);
    const again = markdownToDoc(docToMarkdown(doc));
    expect(again).toEqual(doc);
    expect(docToMarkdown(again)).toBe(docToMarkdown(doc));
  });

  it('reads the editor nodes and marks', () => {
    const doc = markdownToDoc(SAMPLE);
    const types = new Set<string>();
    const marks = new Set<string>();
    const walk = (node: {
      type?: string;
      marks?: Array<{ type: string }>;
      content?: unknown[];
    }) => {
      if (node.type) types.add(node.type);
      for (const mark of node.marks ?? []) marks.add(mark.type);
      for (const child of node.content ?? []) walk(child as typeof node);
    };
    walk(doc as never);
    expect([...types].sort()).toEqual(
      [
        'blockquote',
        'bulletList',
        'codeBlock',
        'doc',
        'hardBreak',
        'heading',
        'horizontalRule',
        'listItem',
        'mention',
        'orderedList',
        'paragraph',
        'text',
      ].sort(),
    );
    expect([...marks].sort()).toEqual(['bold', 'code', 'italic', 'link', 'strike']);
    expect(JSON.stringify(doc)).toContain(`"id":"${ID}","label":"Mira Kaya"`);
    expect(JSON.stringify(doc)).toContain('"language":"ts"');
    expect(JSON.stringify(doc)).toContain('"start":3');
  });

  it('writes mentions as @[Name](user:id) and escapes their labels', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hallo ' },
            { type: 'mention', attrs: { id: ID, label: 'A [B]' } },
          ],
        },
      ],
    };
    const markdown = docToMarkdown(doc);
    expect(markdown).toBe(`Hallo @[A [B\\]](user:${ID})`);
    expect(markdownToDoc(markdown)).toMatchObject(doc);
  });

  it('keeps raw HTML and images as text', () => {
    const doc = markdownToDoc('<script>alert(1)</script>\n\n![Bild](https://example.org/a.png)');
    const text = JSON.stringify(doc);
    expect(text).not.toContain('"type":"image"');
    expect(text).toContain('<script>alert(1)</script>');
  });

  it('refuses javascript links', () => {
    expect(JSON.stringify(markdownToDoc('[x](javascript:alert(1))'))).not.toContain('"link"');
  });

  it('gives empty input and empty documents back as empty', () => {
    expect(docToMarkdown(null)).toBe('');
    expect(docToMarkdown(markdownToDoc(''))).toBe('');
  });
});

describe('mentions', () => {
  it('reads @email as a mention without id, but not inside words', () => {
    const doc = markdownToDoc('Bitte @mira@example.org prüfen, nicht foo@bar.de');
    const text = JSON.stringify(doc);
    expect(text).toContain('"type":"mention","attrs":{"id":null,"label":"mira@example.org"');
    expect(text).toContain('nicht foo@bar.de');
  });

  it('keeps, resolves or drops mentions as decided', async () => {
    const doc = markdownToDoc(`a @mira@example.org b @[Olaf](user:${ID}) c`);
    const reviewed = await reviewMentions(doc, async (mention) =>
      mention.label === 'mira@example.org' ? { id: ID, label: 'Mira Kaya' } : null,
    );
    expect(reviewed).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'a ' },
            { type: 'mention', attrs: expect.objectContaining({ id: ID, label: 'Mira Kaya' }) },
            { type: 'text', text: ' b @Olaf c' },
          ],
        },
      ],
    });
  });
});
