import { describe, expect, it } from 'vitest';
import { diffDocs, diffWords, docBlocks } from './diff.js';
import { markdownToDoc } from './markdown.js';

const IMAGE = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

describe('version diff (E-62)', () => {
  it('splits documents into comparable blocks', () => {
    const doc = markdownToDoc(
      [
        '## Ziel',
        '',
        '- eins',
        '  - zwei',
        '',
        '> zitiert',
        '',
        '- [x] erledigt',
        '',
        '| A | B |',
        '| --- | --- |',
        '| 1 | 2 |',
        '',
        `![Bild](attachment:${IMAGE} "Titel")`,
      ].join('\n'),
    );
    expect(docBlocks(doc).map((block) => [block.type, block.text, block.depth])).toEqual([
      ['heading', 'Ziel', 0],
      ['listItem', 'eins', 0],
      ['listItem', 'zwei', 1],
      ['quote', 'zitiert', 0],
      ['taskItem', 'erledigt', 0],
      ['tableRow', 'A | B', 0],
      ['tableRow', '1 | 2', 0],
      ['image', 'Titel · Bild', 0],
    ]);
  });

  it('marks changed words inside a block', () => {
    expect(diffWords('Der Sprint dauert zwei Wochen.', 'Der Sprint dauert drei Wochen.')).toEqual([
      { op: 'same', text: 'Der Sprint dauert ' },
      { op: 'removed', text: 'zwei ' },
      { op: 'added', text: 'drei ' },
      { op: 'same', text: 'Wochen.' },
    ]);
  });

  it('aligns blocks: same, changed, added and removed', () => {
    const before = markdownToDoc(
      [
        '# Plan',
        '',
        'Der Sprint dauert zwei Wochen.',
        '',
        'Alter Absatz ganz anders.',
        '',
        '| A | B |',
        '| --- | --- |',
        '| 1 | 2 |',
      ].join('\n'),
    );
    const after = markdownToDoc(
      [
        '# Plan',
        '',
        'Der Sprint dauert drei Wochen.',
        '',
        '| A | B |',
        '| --- | --- |',
        '| 1 | 3 |',
        '',
        'Neu am Ende.',
      ].join('\n'),
    );
    expect(
      diffDocs(before, after).map((block) =>
        block.op === 'changed' ? ['changed', block.after.text] : [block.op, block.block.text],
      ),
    ).toEqual([
      ['same', 'Plan'],
      ['changed', 'Der Sprint dauert drei Wochen.'],
      ['removed', 'Alter Absatz ganz anders.'],
      ['same', 'A | B'],
      ['changed', '1 | 3'],
      ['added', 'Neu am Ende.'],
    ]);
  });

  it('reports ticking a task as a change', () => {
    const diff = diffDocs(markdownToDoc('- [ ] Review'), markdownToDoc('- [x] Review'));
    expect(diff.map((block) => block.op)).toEqual(['changed']);
  });
});
