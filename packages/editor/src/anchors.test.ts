import { describe, expect, it } from 'vitest';
import {
  anchorFromSelection,
  anchorRange,
  locateAnchor,
  reanchor,
  textBlockTargets,
} from './anchors.js';
import { docBlocks } from './diff.js';
import { markdownToDoc } from './markdown.js';
import { richTextSchema } from './schema.js';

const ID = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';

const DOC = markdownToDoc(
  [
    '# Ablauf',
    '',
    `Der Sprint dauert zwei Wochen, sagt @[Mira Kaya](user:${ID}).`,
    '',
    '- Planung',
    '  - Review am Freitag',
    '',
    '| A | B |',
    '| --- | --- |',
    '| 1 | 2 |',
    '',
    '> Der Sprint endet mit der Retro.',
  ].join('\n'),
);

describe('inline comment anchors (E-63)', () => {
  const node = richTextSchema.nodeFromJSON(DOC);

  it('lists the text blocks in the same order as the diff blocks', () => {
    const targets = textBlockTargets(node);
    const blocks = docBlocks(DOC);
    expect(targets).toHaveLength(blocks.length);
    targets.forEach((target, index) => {
      if (target) {
        expect(
          target.node.textBetween(0, target.node.content.size, undefined, (leaf) =>
            leaf.type.name === 'mention' ? `@${leaf.attrs.label}` : ' ',
          ),
        ).toBe(blocks[index]?.text);
      }
    });
  });

  it('turns a selection into an anchor and back into the same range', () => {
    const target = textBlockTargets(node)[1];
    if (!target) throw new Error('no paragraph');
    const from = target.pos + 'Der Sprint dauert '.length;
    const to = from + 'zwei Wochen'.length;
    const anchor = anchorFromSelection(node, from, to);
    expect(anchor).toEqual({
      exact: 'zwei Wochen',
      prefix: 'Der Sprint dauert ',
      suffix: ', sagt @Mira Kaya.',
      block: 1,
    });
    expect(anchor && anchorRange(node, anchor)).toEqual({ from, to });
    expect(node.textBetween(from, to)).toBe('zwei Wochen');
  });

  it('maps offsets after a mention onto document positions', () => {
    const anchor = { exact: 'Kaya.', prefix: '', suffix: '', block: 1 };
    const range = anchorRange(node, anchor);
    expect(range).not.toBeNull();
    // The mention is one node; a quote that starts inside it starts after it.
    expect(range && node.textBetween(range.from, range.to)).toBe('.');
  });

  it('picks the occurrence whose context fits and follows edits', () => {
    const anchor = { exact: 'Der Sprint', prefix: '', suffix: ' endet', block: 4 };
    expect(locateAnchor(DOC, anchor)).toMatchObject({ block: 6, start: 0 });
    const changed = markdownToDoc(
      [
        '# Neu oben',
        '',
        '# Ablauf',
        '',
        'Der Sprint dauert drei Wochen.',
        '',
        '> Der Sprint endet mit der Retro.',
      ].join('\n'),
    );
    expect(reanchor(changed, anchor)).toEqual({
      exact: 'Der Sprint',
      prefix: '',
      suffix: ' endet mit der Retro.',
      block: 3,
    });
    expect(
      reanchor(changed, { exact: 'zwei Wochen', prefix: '', suffix: '', block: 1 }),
    ).toBeNull();
  });
});
