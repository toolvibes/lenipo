import type { ProjectTemplate, StatusCategory } from '@tasklore/shared';
import { v5 as uuidv5 } from 'uuid';
import type { WorkflowDefinition } from './workflow.js';

const NAMESPACE = '6f3c1c0e-8d4b-4a8e-9a57-2b8e4d1c7a10';

/** Stable ids, so built-ins can be created idempotently on every start. */
export function builtInId(kind: string, key: string): string {
  return uuidv5(`tasklore:${kind}:${key}`, NAMESPACE);
}

export const BUILT_IN_ISSUE_TYPES = [
  {
    key: 'epic',
    name: 'Epic',
    icon: 'Lightning',
    hierarchyLevel: 1,
    description: 'Größeres Vorhaben, das mehrere Vorgänge bündelt.',
  },
  {
    key: 'story',
    name: 'Story',
    icon: 'BookmarkSimple',
    hierarchyLevel: 0,
    description: 'Anforderung aus Sicht der Nutzenden.',
  },
  {
    key: 'task',
    name: 'Aufgabe',
    icon: 'CheckSquare',
    hierarchyLevel: 0,
    description: 'Etwas, das erledigt werden muss.',
  },
  {
    key: 'bug',
    name: 'Bug',
    icon: 'Bug',
    hierarchyLevel: 0,
    description: 'Ein Fehler, der behoben werden muss.',
  },
  {
    key: 'subtask',
    name: 'Unteraufgabe',
    icon: 'TreeStructure',
    hierarchyLevel: -1,
    description: 'Teil eines anderen Vorgangs.',
  },
] as const;

export const BUILT_IN_STATUSES: ReadonlyArray<{
  key: string;
  name: string;
  category: StatusCategory;
}> = [
  { key: 'backlog', name: 'Backlog', category: 'todo' },
  { key: 'open', name: 'Offen', category: 'todo' },
  { key: 'selected', name: 'Ausgewählt', category: 'todo' },
  { key: 'in-progress', name: 'In Arbeit', category: 'in_progress' },
  { key: 'review', name: 'Review', category: 'in_progress' },
  { key: 'testing', name: 'In Prüfung', category: 'in_progress' },
  { key: 'done', name: 'Erledigt', category: 'done' },
];

export const BUILT_IN_PRIORITIES = [
  { key: 'highest', name: 'Höchste', sequence: 1, icon: 'CaretDoubleUp', isDefault: false },
  { key: 'high', name: 'Hoch', sequence: 2, icon: 'CaretUp', isDefault: false },
  { key: 'medium', name: 'Mittel', sequence: 3, icon: 'Equals', isDefault: true },
  { key: 'low', name: 'Niedrig', sequence: 4, icon: 'CaretDown', isDefault: false },
  { key: 'lowest', name: 'Niedrigste', sequence: 5, icon: 'CaretDoubleDown', isDefault: false },
] as const;

export const BUILT_IN_RESOLUTIONS = [
  { key: 'done', name: 'Erledigt', isDefault: true },
  { key: 'wont-do', name: 'Wird nicht umgesetzt', isDefault: false },
  { key: 'duplicate', name: 'Duplikat', isDefault: false },
  { key: 'cannot-reproduce', name: 'Nicht reproduzierbar', isDefault: false },
] as const;

/** Built-in link types (E-41); the UI translates them by key. */
export const BUILT_IN_LINK_TYPES = [
  { key: 'blocks', name: 'Blockiert', outward: 'blockiert', inward: 'wird blockiert von' },
  { key: 'duplicate', name: 'Duplikat', outward: 'dupliziert', inward: 'wird dupliziert von' },
  { key: 'relates', name: 'Bezug', outward: 'bezieht sich auf', inward: 'bezieht sich auf' },
  { key: 'clones', name: 'Klon', outward: 'klont', inward: 'wird geklont von' },
] as const;

const status = (key: string) => builtInId('status', key);

/** "Simplified" workflows: every status is reachable from every other, one transition per target. */
function simplified(statusKeys: string[]): WorkflowDefinition {
  const statusIds = statusKeys.map(status);
  const names = new Map(BUILT_IN_STATUSES.map((entry) => [status(entry.key), entry.name]));
  return {
    statusIds,
    initialStatusId: statusIds[0] as string,
    transitions: statusIds.map((to) => ({
      id: `to-${statusKeys[statusIds.indexOf(to)]}`,
      name: names.get(to) ?? to,
      from: '*',
      to,
    })),
  };
}

export const BUILT_IN_WORKFLOWS = [
  {
    key: 'software',
    name: 'Softwareentwicklung',
    definition: simplified(['open', 'in-progress', 'review', 'done']),
  },
  {
    key: 'kanban',
    name: 'Kanban',
    definition: simplified(['backlog', 'selected', 'in-progress', 'done']),
  },
  { key: 'basic', name: 'Einfach', definition: simplified(['open', 'in-progress', 'done']) },
  {
    key: 'bugs',
    name: 'Fehlerverfolgung',
    definition: simplified(['open', 'in-progress', 'testing', 'done']),
  },
] as const;

/** What a project template brings: its workflow and the issue types it hides. */
export const PROJECT_TEMPLATES: Record<
  ProjectTemplate,
  { workflow: string; hiddenIssueTypes: string[] }
> = {
  scrum: { workflow: 'software', hiddenIssueTypes: [] },
  kanban: { workflow: 'kanban', hiddenIssueTypes: [] },
  basic: { workflow: 'basic', hiddenIssueTypes: ['epic', 'story', 'bug'] },
  bugs: { workflow: 'bugs', hiddenIssueTypes: ['epic', 'story'] },
};
