import type { ProjectTemplate, StatusCategory } from '@toolvibes/shared';
import { v5 as uuidv5 } from 'uuid';
import type { WorkflowDefinition } from './workflow.js';

const NAMESPACE = '6f3c1c0e-8d4b-4a8e-9a57-2b8e4d1c7a10';

/**
 * The ids of the built-ins that exist in installed databases. Issues, workflows and boards point
 * at them, so they never change; a new built-in simply gets a derived id.
 */
const FIXED_IDS: Readonly<Record<string, string>> = {
  'issue-type:epic': '71772c1a-02d0-533a-86a0-f88a3247435b',
  'issue-type:story': '07e73c77-5dc3-5ced-ac17-be149426f9df',
  'issue-type:task': '2ec8d98f-e343-5e35-98f0-e39755466aae',
  'issue-type:bug': 'afb29d29-2f94-5e1c-8068-85ac44c7a149',
  'issue-type:subtask': '956ef9df-c273-51a4-8d78-07282ef86912',
  'status:backlog': 'be0efcf2-b8e6-5005-9d8f-09afb798b893',
  'status:open': 'd7a7d84f-89d7-5b5f-a799-b6a85bb1ce1d',
  'status:selected': '205d43b5-2687-5886-bab4-946fdd4de376',
  'status:in-progress': 'ee215a9b-aa0a-58fb-9294-418a6c69619e',
  'status:review': 'd4f51f16-6d2b-5828-a968-dc22425e6015',
  'status:testing': '9fca4733-d3ab-5bbd-be82-91a1f5fa61ae',
  'status:done': 'd6813351-63e0-5f9f-bc47-1259d79f1300',
  'priority:highest': '86de9361-efa3-5c59-b708-8eadd5b9b316',
  'priority:high': 'b32f0415-a272-5f94-ba5f-b6c2a19121a9',
  'priority:medium': 'bf1cca04-d279-59d9-89a7-ec08c98fa4d7',
  'priority:low': 'd040fe26-8220-5798-b14f-1a8124f3138b',
  'priority:lowest': '2fc0d4e2-51ed-5cd7-ba2c-2a36c5dd9078',
  'resolution:done': 'b8dca4fa-7c0a-5f12-9645-c9b75ff7f6ab',
  'resolution:wont-do': '63f22be5-2b3d-5de4-8061-bec2a0948e5b',
  'resolution:duplicate': 'b599fb07-9548-5ce7-9244-bf9a92a2fce2',
  'resolution:cannot-reproduce': '897a82c4-7e9a-542b-b6c0-57a9346aba1e',
  'link-type:blocks': '35340356-5d74-534a-a851-49ff844ceb2b',
  'link-type:duplicate': 'd8459b59-56a3-5bfb-b8c8-31b6fa07210e',
  'link-type:relates': '0f74ee8f-181e-5089-a5b8-11326664029c',
  'link-type:clones': 'f0bb25a6-6e48-5d0d-a901-ab72e19b9f99',
  'workflow:software': '00f81971-c5d4-52eb-86c5-a612c3d6a3c3',
  'workflow:kanban': 'f5fe6768-faac-5088-bd0d-c940f28f7c63',
  'workflow:basic': '0d601384-d018-50cf-abe2-b9c17f7f115f',
  'workflow:bugs': '339a7693-7f5a-51ed-b67e-5bb8299ad1fc',
  'workflow-version:software:1': '8546f209-000b-52a5-a535-bc977c8f7776',
  'workflow-version:kanban:1': '4239e26f-91c9-5593-babf-57ca54703d19',
  'workflow-version:basic:1': '18ba62b2-57f3-5fe7-b713-65c50536f70c',
  'workflow-version:bugs:1': '50945206-613d-58ef-bc92-1ca1cb1d1b10',
};

/** Stable ids, so built-ins can be created idempotently on every start. */
export function builtInId(kind: string, key: string): string {
  return FIXED_IDS[`${kind}:${key}`] ?? uuidv5(`lenipo:${kind}:${key}`, NAMESPACE);
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

/** The statuses of a template's built-in workflow, for a new board's first columns. */
export function templateStatuses(
  template: 'scrum' | 'kanban',
): Array<{ id: string; name: string }> {
  const workflow = BUILT_IN_WORKFLOWS.find(
    (entry) => entry.key === PROJECT_TEMPLATES[template].workflow,
  );
  const names = new Map(
    BUILT_IN_STATUSES.map((status) => [builtInId('status', status.key), status.name]),
  );
  return (workflow?.definition.statusIds ?? []).map((id) => ({ id, name: names.get(id) ?? id }));
}
