import { describe, expect, it } from 'vitest';
import { docToMarkdown, markdownToDoc } from './markdown.js';
import { isValidDoc } from './schema.js';

const MACROS = [
  '::toc{maxLevel=2}',
  '',
  '> [!WARNING]',
  '> Nicht am Freitag deployen.',
  '>',
  '> - auch nicht nachts',
  '',
  ':::expand Details zur Freigabe',
  'Erst **Review**, dann Merge.',
  '',
  '```ts title="deploy.ts" lineNumbers collapsed',
  'const ok = true;',
  '```',
  ':::',
  '',
  'Stand: :status[In Arbeit]{color=blue} siehe :issue[WEB-12].',
  '',
  '::issues{query="project = WEB AND status != Erledigt" display=count limit=5}',
  '',
  '::children',
].join('\n');

type Json = { type: string; attrs?: Record<string, unknown>; content?: Json[] };

describe('macros in Markdown (E-66)', () => {
  it('reads every macro', () => {
    const doc = markdownToDoc(MACROS) as Json;
    expect(doc.content?.map((node) => node.type)).toEqual([
      'tableOfContents',
      'panel',
      'expand',
      'paragraph',
      'issueList',
      'childPages',
    ]);
    const [toc, panel, expand, paragraph, list] = doc.content as Json[];
    expect(toc?.attrs).toEqual({ maxLevel: 2 });
    expect(panel?.attrs).toEqual({ kind: 'warning' });
    expect(panel?.content?.map((node) => node.type)).toEqual(['paragraph', 'bulletList']);
    expect(expand?.attrs).toEqual({ title: 'Details zur Freigabe' });
    expect(expand?.content?.[1]).toMatchObject({
      type: 'codeBlock',
      attrs: { language: 'ts', title: 'deploy.ts', lineNumbers: true, collapsed: true },
    });
    expect(paragraph?.content?.filter((node) => node.type !== 'text')).toEqual([
      { type: 'status', attrs: { text: 'In Arbeit', color: 'blue' } },
      { type: 'issue', attrs: { key: 'WEB-12' } },
    ]);
    expect(list?.attrs).toEqual({
      query: 'project = WEB AND status != Erledigt',
      display: 'count',
      limit: 5,
    });
    expect(isValidDoc(doc)).toBe(true);
  });

  it('keeps them on a round trip', () => {
    const doc = markdownToDoc(MACROS);
    const markdown = docToMarkdown(doc);
    expect(markdown).toContain('> [!WARNING]\n> Nicht am Freitag deployen.');
    expect(markdown).toContain('```ts title="deploy.ts" lineNumbers collapsed');
    expect(markdownToDoc(markdown)).toEqual(doc);
  });

  it('maps all GitHub alert kinds and leaves ordinary quotes alone', () => {
    const kinds = ['NOTE', 'TIP', 'IMPORTANT', 'CAUTION'].map(
      (kind) => (markdownToDoc(`> [!${kind}]\n> Text`) as Json).content?.[0]?.attrs?.kind,
    );
    expect(kinds).toEqual(['info', 'success', 'note', 'warning']);
    expect((markdownToDoc('> Nur ein Zitat') as Json).content?.[0]?.type).toBe('blockquote');
  });

  it('rejects macros with bad attributes', () => {
    const doc = (node: Json) => ({ type: 'doc', content: [node] });
    expect(isValidDoc(doc({ type: 'tableOfContents', attrs: { maxLevel: 9 } }))).toBe(false);
    expect(
      isValidDoc(doc({ type: 'paragraph', content: [{ type: 'issue', attrs: { key: 'web 1' } }] })),
    ).toBe(false);
    expect(
      isValidDoc(
        doc({
          type: 'paragraph',
          content: [{ type: 'status', attrs: { text: 'x', color: 'pink' } }],
        }),
      ),
    ).toBe(false);
    expect(
      isValidDoc(
        doc({ type: 'panel', attrs: { kind: 'error' }, content: [{ type: 'paragraph' }] }),
      ),
    ).toBe(false);
  });
});
