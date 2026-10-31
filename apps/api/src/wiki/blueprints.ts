import type { RichText } from '@tasklore/shared';

/** Shipped page blueprints (W-TPL-03, E-72): built in code, in the reader's language. */
export const BLUEPRINT_KEYS = [
  'meeting',
  'decision',
  'requirements',
  'retro',
  'project-plan',
  'how-to',
  'post-mortem',
  'release-notes',
] as const;
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
const doc = (...content: Node[]): RichText => ({ type: 'doc', content }) as RichText;
/** Instruction text that disappears when one writes over it (TL-27). */
const hint = (value: string): Node => ({
  type: 'paragraph',
  content: [{ type: 'placeholder', attrs: { text: value } }],
});
/** Page properties for the properties report (W-MAC-09). */
const properties = (header: [string, string], rows: [string, string][]): Node => ({
  type: 'pageProperties',
  content: [table(header, rows)],
});

interface Blueprint {
  name: string;
  description: string;
  /** Title of the index page that lists the pages of this blueprint in a space. */
  index: string;
  /** `{date}` becomes today's date when a page is created. */
  title: string;
  content: () => RichText;
}

const BLUEPRINTS: Record<Locale, Record<BlueprintKey, Blueprint>> = {
  de: {
    meeting: {
      name: 'Besprechungsnotizen',
      index: 'Besprechungsnotizen',
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
      index: 'Entscheidungen',
      description: 'Eine Entscheidung mit Kontext, Optionen und Folgen festhalten.',
      title: 'Entscheidung: ',
      content: () =>
        doc(
          properties(
            ['Eigenschaft', 'Wert'],
            [
              ['Status', 'Offen'],
              ['Datum', '{{date}}'],
              ['Verantwortlich', '{{author}}'],
            ],
          ),
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
      index: 'Anforderungen',
      description: 'Ziel, Anforderungen und die zugehörigen Vorgänge eines Vorhabens.',
      title: 'Anforderungen: ',
      content: () =>
        doc(
          panel('info', 'Ziel in einem Satz: Wer soll was erreichen können?'),
          p('Epic: ', { type: 'issue', attrs: { key: '{{input:Epic}}' } }),
          h(2, 'Hintergrund'),
          empty(),
          h(2, 'Anforderungen'),
          table(['#', 'Anforderung', 'Wichtigkeit', 'Hinweise'], [['1', '', 'Muss', '']]),
          h(2, 'Vorgänge'),
          p('Die Vorgänge des Epics; die Abfrage lässt sich anpassen.'),
          {
            type: 'issueList',
            attrs: { query: 'parent = {{input:Epic}} ORDER BY rank', display: 'table', limit: 20 },
          },
          h(2, 'Offene Fragen'),
          tasks(''),
        ),
    },
    retro: {
      name: 'Retrospektive',
      index: 'Retrospektiven',
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
    'project-plan': {
      name: 'Projektplan',
      index: 'Projektpläne',
      description: 'Ziel, Umfang, Meilensteine und Risiken eines Projekts.',
      title: 'Projektplan: {{input:Projekt}}',
      content: () =>
        doc(
          properties(
            ['Eigenschaft', 'Wert'],
            [
              ['Projekt', '{{input:Projekt}}'],
              ['Verantwortlich', '{{author}}'],
              ['Start', '{{date}}'],
              ['Ende', ''],
            ],
          ),
          h(2, 'Ziel'),
          hint('Was soll das Projekt erreichen, und woran merken wir es?'),
          h(2, 'Umfang'),
          table(['Im Umfang', 'Nicht im Umfang'], [['', '']]),
          h(2, 'Meilensteine'),
          table(['Meilenstein', 'Datum', 'Status'], [['', '', '']]),
          h(2, 'Risiken'),
          table(['Risiko', 'Wahrscheinlichkeit', 'Gegenmaßnahme'], [['', '', '']]),
        ),
    },
    'how-to': {
      name: 'Anleitung',
      index: 'Anleitungen',
      description: 'Schritt für Schritt erklären, wie etwas geht.',
      title: 'So geht’s: ',
      content: () =>
        doc(
          panel('info', 'Worum geht es, und wer braucht diese Anleitung?'),
          h(2, 'Voraussetzungen'),
          bullets(''),
          h(2, 'Schritte'),
          {
            type: 'orderedList',
            attrs: { start: 1 },
            content: [{ type: 'listItem', content: [hint('Erster Schritt')] }],
          },
          h(2, 'Siehe auch'),
          bullets(''),
        ),
    },
    'post-mortem': {
      name: 'Fehleranalyse (Post-Mortem)',
      index: 'Fehleranalysen',
      description:
        'Einen Vorfall nachvollziehen: Ablauf, Ursachen, Maßnahmen – ohne Schuldzuweisung.',
      title: '{date} Fehleranalyse: {{input:Vorfall}}',
      content: () =>
        doc(
          properties(
            ['Eigenschaft', 'Wert'],
            [
              ['Vorfall', '{{input:Vorfall}}'],
              ['Datum', '{{date}}'],
              ['Schwere', ''],
              ['Verantwortlich', '{{author}}'],
            ],
          ),
          h(2, 'Zusammenfassung'),
          hint('Was ist passiert, wen hat es betroffen, wie lange?'),
          h(2, 'Ablauf'),
          table(['Zeit', 'Ereignis'], [['', '']]),
          h(2, 'Ursachen'),
          bullets(''),
          h(2, 'Was lief gut'),
          bullets(''),
          h(2, 'Maßnahmen'),
          tasks('Maßnahme – wer bis wann'),
        ),
    },
    'release-notes': {
      name: 'Release Notes',
      index: 'Release Notes',
      description: 'Neuerungen und Korrekturen einer Version für Nutzerinnen und Nutzer.',
      title: 'Release Notes {{input:Version}}',
      content: () =>
        doc(
          properties(
            ['Eigenschaft', 'Wert'],
            [
              ['Version', '{{input:Version}}'],
              ['Datum', '{{date}}'],
            ],
          ),
          h(2, 'Neu'),
          bullets(''),
          h(2, 'Verbessert'),
          bullets(''),
          h(2, 'Behoben'),
          bullets(''),
          h(2, 'Vorgänge'),
          {
            type: 'issueList',
            attrs: {
              query: 'fixVersion = "{{input:Version}}" ORDER BY issuetype',
              display: 'table',
              limit: 50,
            },
          },
        ),
    },
  },
  en: {
    meeting: {
      name: 'Meeting notes',
      index: 'Meeting notes',
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
      index: 'Decisions',
      description: 'Record a decision with its context, options and consequences.',
      title: 'Decision: ',
      content: () =>
        doc(
          properties(
            ['Property', 'Value'],
            [
              ['Status', 'Open'],
              ['Date', '{{date}}'],
              ['Owner', '{{author}}'],
            ],
          ),
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
      index: 'Requirements',
      description: 'Goal, requirements and the related issues of an initiative.',
      title: 'Requirements: ',
      content: () =>
        doc(
          panel('info', 'Goal in one sentence: who should be able to achieve what?'),
          p('Epic: ', { type: 'issue', attrs: { key: '{{input:Epic}}' } }),
          h(2, 'Background'),
          empty(),
          h(2, 'Requirements'),
          table(['#', 'Requirement', 'Importance', 'Notes'], [['1', '', 'Must', '']]),
          h(2, 'Issues'),
          p('The issues of the epic; the query can be adjusted.'),
          {
            type: 'issueList',
            attrs: { query: 'parent = {{input:Epic}} ORDER BY rank', display: 'table', limit: 20 },
          },
          h(2, 'Open questions'),
          tasks(''),
        ),
    },
    retro: {
      name: 'Retrospective',
      index: 'Retrospectives',
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
    'project-plan': {
      name: 'Project plan',
      index: 'Project plans',
      description: 'Goal, scope, milestones and risks of a project.',
      title: 'Project plan: {{input:Project}}',
      content: () =>
        doc(
          properties(
            ['Property', 'Value'],
            [
              ['Project', '{{input:Project}}'],
              ['Owner', '{{author}}'],
              ['Start', '{{date}}'],
              ['End', ''],
            ],
          ),
          h(2, 'Goal'),
          hint('What should the project achieve, and how do we notice?'),
          h(2, 'Scope'),
          table(['In scope', 'Out of scope'], [['', '']]),
          h(2, 'Milestones'),
          table(['Milestone', 'Date', 'Status'], [['', '', '']]),
          h(2, 'Risks'),
          table(['Risk', 'Likelihood', 'Mitigation'], [['', '', '']]),
        ),
    },
    'how-to': {
      name: 'How-to',
      index: 'How-tos',
      description: 'Explain step by step how something is done.',
      title: 'How to ',
      content: () =>
        doc(
          panel('info', 'What is this about, and who needs this guide?'),
          h(2, 'Prerequisites'),
          bullets(''),
          h(2, 'Steps'),
          {
            type: 'orderedList',
            attrs: { start: 1 },
            content: [{ type: 'listItem', content: [hint('First step')] }],
          },
          h(2, 'See also'),
          bullets(''),
        ),
    },
    'post-mortem': {
      name: 'Post-mortem',
      index: 'Post-mortems',
      description: 'Understand an incident: timeline, causes, actions – without blame.',
      title: '{date} Post-mortem: {{input:Incident}}',
      content: () =>
        doc(
          properties(
            ['Property', 'Value'],
            [
              ['Incident', '{{input:Incident}}'],
              ['Date', '{{date}}'],
              ['Severity', ''],
              ['Owner', '{{author}}'],
            ],
          ),
          h(2, 'Summary'),
          hint('What happened, whom did it affect, for how long?'),
          h(2, 'Timeline'),
          table(['Time', 'Event'], [['', '']]),
          h(2, 'Causes'),
          bullets(''),
          h(2, 'What went well'),
          bullets(''),
          h(2, 'Actions'),
          tasks('Action – who by when'),
        ),
    },
    'release-notes': {
      name: 'Release notes',
      index: 'Release notes',
      description: 'What is new and fixed in a version, for its users.',
      title: 'Release notes {{input:Version}}',
      content: () =>
        doc(
          properties(
            ['Property', 'Value'],
            [
              ['Version', '{{input:Version}}'],
              ['Date', '{{date}}'],
            ],
          ),
          h(2, 'New'),
          bullets(''),
          h(2, 'Improved'),
          bullets(''),
          h(2, 'Fixed'),
          bullets(''),
          h(2, 'Issues'),
          {
            type: 'issueList',
            attrs: {
              query: 'fixVersion = "{{input:Version}}" ORDER BY issuetype',
              display: 'table',
              limit: 50,
            },
          },
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
