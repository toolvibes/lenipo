import type { RichText } from '@tasklore/shared';

/** Shipped page blueprints (W-TPL-03, E-72): built in code, in the reader's language. */
export const BLUEPRINT_KEYS = ['meeting', 'decision', 'requirements', 'retro'] as const;
export type BlueprintKey = (typeof BLUEPRINT_KEYS)[number];
type Locale = 'de' | 'en';

type Node = Record<string, unknown>;
const text = (value: string): Node => ({ type: 'text', text: value });
const p = (...parts: Array<string | Node>): Node => ({
  type: 'paragraph',
  content: parts.map((part) => (typeof part === 'string' ? text(part) : part)),
});
const empty = (): Node => ({ type: 'paragraph' });
const h = (level: number, value: string): Node => ({
  type: 'heading',
  attrs: { level },
  content: [text(value)],
});
const tasks = (...items: string[]): Node => ({
  type: 'taskList',
  content: items.map((item) => ({
    type: 'taskItem',
    attrs: { checked: false },
    content: [item ? p(item) : empty()],
  })),
});
const bullets = (...items: string[]): Node => ({
  type: 'bulletList',
  content: items.map((item) => ({ type: 'listItem', content: [item ? p(item) : empty()] })),
});
const cell = (type: 'tableHeader' | 'tableCell', value: string): Node => ({
  type,
  content: [value ? p(value) : empty()],
});
const table = (headers: string[], rows: string[][]): Node => ({
  type: 'table',
  content: [
    { type: 'tableRow', content: headers.map((value) => cell('tableHeader', value)) },
    ...rows.map((row) => ({
      type: 'tableRow',
      content: row.map((value) => cell('tableCell', value)),
    })),
  ],
});
const panel = (kind: 'info' | 'note' | 'warning' | 'success', value: string): Node => ({
  type: 'panel',
  attrs: { kind },
  content: [p(value)],
});
const status = (value: string, color: string): Node => ({
  type: 'status',
  attrs: { text: value, color },
});
const doc = (...content: Node[]): RichText => ({ type: 'doc', content }) as RichText;

interface Blueprint {
  name: string;
  description: string;
  /** `{date}` becomes today's date when a page is created. */
  title: string;
  content: () => RichText;
}

const BLUEPRINTS: Record<Locale, Record<BlueprintKey, Blueprint>> = {
  de: {
    meeting: {
      name: 'Besprechungsnotizen',
      description: 'Teilnehmende, Agenda, Notizen und Aufgaben einer Besprechung.',
      title: '{date} Besprechung',
      content: () =>
        doc(
          h(2, 'Teilnehmende'),
          bullets('@Name'),
          h(2, 'Agenda'),
          bullets('Thema'),
          h(2, 'Notizen'),
          empty(),
          h(2, 'Aufgaben'),
          tasks('Aufgabe – wer bis wann'),
        ),
    },
    decision: {
      name: 'Entscheidung (ADR)',
      description: 'Eine Entscheidung mit Kontext, Optionen und Folgen festhalten.',
      title: 'Entscheidung: ',
      content: () =>
        doc(
          p('Status: ', status('OFFEN', 'yellow')),
          h(2, 'Kontext'),
          p('Welches Problem lösen wir, und warum jetzt?'),
          h(2, 'Optionen'),
          table(
            ['Option', 'Vorteile', 'Nachteile'],
            [
              ['', '', ''],
              ['', '', ''],
            ],
          ),
          h(2, 'Entscheidung'),
          empty(),
          h(2, 'Folgen'),
          p('Was wird leichter, was schwerer?'),
        ),
    },
    requirements: {
      name: 'Anforderungen',
      description: 'Ziel, Anforderungen und die zugehörigen Vorgänge eines Vorhabens.',
      title: 'Anforderungen: ',
      content: () =>
        doc(
          panel('info', 'Ziel in einem Satz: Wer soll was erreichen können?'),
          h(2, 'Hintergrund'),
          empty(),
          h(2, 'Anforderungen'),
          table(['#', 'Anforderung', 'Wichtigkeit', 'Hinweise'], [['1', '', 'Muss', '']]),
          h(2, 'Vorgänge'),
          p('Die Abfrage im Makro unten auf das Vorhaben anpassen, z. B. mit labels = …'),
          {
            type: 'issueList',
            attrs: { query: 'labels = vorhaben ORDER BY rank', display: 'table', limit: 20 },
          },
          h(2, 'Offene Fragen'),
          tasks(''),
        ),
    },
    retro: {
      name: 'Retrospektive',
      description: 'Was gut lief, was nicht, und welche Maßnahmen das Team ergreift.',
      title: '{date} Retrospektive',
      content: () =>
        doc(
          h(2, 'Was lief gut?'),
          bullets(''),
          h(2, 'Was lief nicht gut?'),
          bullets(''),
          h(2, 'Maßnahmen'),
          tasks('Maßnahme – wer'),
        ),
    },
  },
  en: {
    meeting: {
      name: 'Meeting notes',
      description: 'Attendees, agenda, notes and action items of a meeting.',
      title: '{date} Meeting',
      content: () =>
        doc(
          h(2, 'Attendees'),
          bullets('@Name'),
          h(2, 'Agenda'),
          bullets('Topic'),
          h(2, 'Notes'),
          empty(),
          h(2, 'Action items'),
          tasks('Task – who by when'),
        ),
    },
    decision: {
      name: 'Decision (ADR)',
      description: 'Record a decision with its context, options and consequences.',
      title: 'Decision: ',
      content: () =>
        doc(
          p('Status: ', status('OPEN', 'yellow')),
          h(2, 'Context'),
          p('Which problem do we solve, and why now?'),
          h(2, 'Options'),
          table(
            ['Option', 'Pros', 'Cons'],
            [
              ['', '', ''],
              ['', '', ''],
            ],
          ),
          h(2, 'Decision'),
          empty(),
          h(2, 'Consequences'),
          p('What becomes easier, what harder?'),
        ),
    },
    requirements: {
      name: 'Requirements',
      description: 'Goal, requirements and the related issues of an initiative.',
      title: 'Requirements: ',
      content: () =>
        doc(
          panel('info', 'Goal in one sentence: who should be able to achieve what?'),
          h(2, 'Background'),
          empty(),
          h(2, 'Requirements'),
          table(['#', 'Requirement', 'Importance', 'Notes'], [['1', '', 'Must', '']]),
          h(2, 'Issues'),
          p('Adjust the query in the macro below to the initiative, e.g. with labels = …'),
          {
            type: 'issueList',
            attrs: { query: 'labels = initiative ORDER BY rank', display: 'table', limit: 20 },
          },
          h(2, 'Open questions'),
          tasks(''),
        ),
    },
    retro: {
      name: 'Retrospective',
      description: 'What went well, what did not, and what the team will change.',
      title: '{date} Retrospective',
      content: () =>
        doc(
          h(2, 'What went well?'),
          bullets(''),
          h(2, 'What did not go well?'),
          bullets(''),
          h(2, 'Actions'),
          tasks('Action – who'),
        ),
    },
  },
};

export function blueprint(key: BlueprintKey, locale: string): Blueprint {
  return BLUEPRINTS[locale === 'en' ? 'en' : 'de'][key];
}

export function isBlueprintKey(value: string): value is BlueprintKey {
  return (BLUEPRINT_KEYS as readonly string[]).includes(value);
}
