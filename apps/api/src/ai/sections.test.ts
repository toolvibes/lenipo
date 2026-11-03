import { describe, expect, it } from 'vitest';
import { sectionsOf } from './sections.js';

const heading = (level: number, text: string) => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
});
const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });

describe('page sections for embeddings (TL-108)', () => {
  it('splits at headings up to level 3 and keeps the intro', () => {
    const sections = sectionsOf({
      type: 'doc',
      content: [
        paragraph('Einleitung'),
        heading(2, 'Backup'),
        paragraph('Täglich um 2 Uhr.'),
        heading(4, 'Details'),
        paragraph('Drei Kopien.'),
        heading(2, 'Leer'),
        heading(2, 'Updates'),
        paragraph('Neue Version einspielen.'),
      ],
    });
    expect(sections).toEqual([
      { heading: '', text: 'Einleitung' },
      { heading: 'Backup', text: 'Täglich um 2 Uhr.\nDetails\nDrei Kopien.' },
      { heading: 'Leer', text: 'Leer' },
      { heading: 'Updates', text: 'Neue Version einspielen.' },
    ]);
  });

  it('cuts long sections at paragraphs', () => {
    const long = 'x'.repeat(1_000);
    const sections = sectionsOf({
      type: 'doc',
      content: [heading(2, 'Lang'), paragraph(long), paragraph(long), paragraph('y'.repeat(4_000))],
    });
    expect(sections.length).toBeGreaterThan(3);
    expect(sections.every((section) => section.text.length <= 1_600)).toBe(true);
    expect(sections.every((section) => section.heading === 'Lang')).toBe(true);
  });
});
