import { describe, expect, it } from 'vitest';
import { headingsOf, replaceSection } from './sections.js';

const h = (level: number, text: string) => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
});
const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const doc = (...content: object[]) => ({ type: 'doc' as const, content });

describe('replaceSection', () => {
  const page = doc(
    p('Intro'),
    h(2, 'Ziele'),
    p('alt'),
    h(3, 'Details'),
    p('tief'),
    h(2, 'Risiken'),
    p('bleibt'),
  );

  it('replaces the blocks up to the next heading of the same level', () => {
    const result = replaceSection(page, ' Ziele ', doc(p('neu')));
    expect(result).toEqual({
      doc: doc(p('Intro'), h(2, 'Ziele'), p('neu'), h(2, 'Risiken'), p('bleibt')),
    });
  });

  it('can rename the heading and stops at the end of the document', () => {
    const result = replaceSection(page, 'Risiken', doc(p('keine')), 'Risiken und Annahmen');
    expect(result).toEqual({
      doc: doc(
        p('Intro'),
        h(2, 'Ziele'),
        p('alt'),
        h(3, 'Details'),
        p('tief'),
        h(2, 'Risiken und Annahmen'),
        p('keine'),
      ),
    });
  });

  it('names the headings when it cannot find exactly one', () => {
    expect(replaceSection(page, 'Fehlt', doc())).toEqual({
      error: 'not-found',
      headings: ['Ziele', 'Details', 'Risiken'],
    });
    expect(replaceSection(doc(h(2, 'A'), h(2, 'A')), 'A', doc())).toMatchObject({
      error: 'ambiguous',
    });
    expect(headingsOf(page)).toEqual(['Ziele', 'Details', 'Risiken']);
  });
});
