import { describe, expect, it } from 'vitest';
import { docToHtml, documentHeadings } from './html.js';
import { markdownToDoc } from './markdown.js';

const ID = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

describe('HTML export', () => {
  it('escapes text and keeps only safe links', () => {
    const doc = markdownToDoc(
      [
        '# Über <script>',
        '',
        'Text mit **fett** und [gut](https://example.org) und [böse](javascript:alert(1)).',
      ].join('\n'),
    );
    // markdown-it refuses such links already; stored documents may still carry one.
    doc.content?.push({
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Klick',
          marks: [{ type: 'link', attrs: { href: 'JavaScript:alert(1)' } }],
        },
      ],
    });
    const html = docToHtml(doc);
    expect(html).toContain('<p>Klick</p>');
    expect(html).toContain('<h1 id="uber-script">Über &lt;script&gt;</h1>');
    expect(html).toContain('<strong>fett</strong>');
    expect(html).toContain('<a href="https://example.org">gut</a>');
    expect(html).not.toContain('href="JavaScript');
  });

  it('numbers repeated headings and builds the table of contents from them', () => {
    const doc = markdownToDoc(
      ['::toc{maxLevel=2}', '', '## Ziel', '', '## Ziel', '', '### Tief'].join('\n'),
    );
    expect(documentHeadings(doc).map((heading) => heading.id)).toEqual(['ziel', 'ziel-2', 'tief']);
    const html = docToHtml(doc);
    expect(html).toContain('<a href="#ziel-2">Ziel</a>');
    expect(html).not.toContain('href="#tief"');
  });

  it('resolves images and macros through the caller', () => {
    const doc = markdownToDoc(
      [
        `![Plan](attachment:${ID} "Skizze")`,
        '',
        '::issues{query="project = WEB"}',
        '',
        '::recent',
      ].join('\n'),
    );
    const html = docToHtml(doc, {
      imageSrc: (id) => `attachments/${id}.png`,
      macro: (node) =>
        node.type === 'issueList' ? '<table><tr><td>WEB-1</td></tr></table>' : null,
      macroNote: (name) => `Makro ${name}`,
    });
    expect(html).toContain(`<img src="attachments/${ID}.png" alt="Plan">`);
    expect(html).toContain('<figcaption>Skizze</figcaption>');
    expect(html).toContain('<td>WEB-1</td>');
    expect(html).toContain('Makro recentlyUpdated');
  });
});
