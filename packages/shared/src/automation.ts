import { z } from 'zod';
import { GIT_EVENTS } from './git.js';
import { TqlText } from './search.js';

/**
 * Automation rules (TL-22, E-103): a trigger, then components run in order: conditions stop
 * the rule when they fail, if/else blocks and branches nest further components, actions
 * change things. Texts may hold smart values such as {{issue.key}} or {{now.plusDays(3)}}.
 */

/** The built-in actor rules act as; shown in histories as "Automatisierung". */
export const AUTOMATION_ACTOR_ID = '01a00000-0000-7000-8000-00000000a070';

const Template = z.string().max(10_000);
const Short = z.string().trim().max(200);

export const AutomationTrigger = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('issue-created') }),
    z.object({ type: z.literal('issue-updated') }),
    z.object({
      type: z.literal('issue-transitioned'),
      /** Status names; empty means any. */
      from: Short.default(''),
      to: Short.default(''),
    }),
    z.object({
      type: z.literal('field-changed'),
      /** History field names, e.g. priority, assignee, dueDate, labels. */
      fields: z.array(z.string().trim().min(1).max(40)).min(1).max(20),
    }),
    z.object({ type: z.literal('comment-added') }),
    z.object({ type: z.literal('sprint-started') }),
    z.object({ type: z.literal('sprint-completed') }),
    z.object({ type: z.literal('version-released') }),
    z.object({
      type: z.literal('schedule'),
      /** Five fields: minute hour day-of-month month day-of-week, in the owner's time zone. */
      cron: z.string().trim().min(9).max(100),
      /** Runs once per matching issue; empty runs once without an issue. */
      query: TqlText.default(''),
    }),
    z.object({ type: z.literal('incoming-webhook') }),
    /** Branches, commits, pull requests and builds that name an issue (TL-89, E-116). */
    z.object({ type: z.literal('git'), event: z.enum(GIT_EVENTS) }),
  ])
  .meta({ id: 'AutomationTrigger' });
export type AutomationTrigger = z.infer<typeof AutomationTrigger>;
export type AutomationTriggerType = AutomationTrigger['type'];

export const COMPARE_OPERATORS = [
  'equals',
  'not-equals',
  'contains',
  'not-contains',
  'empty',
  'not-empty',
  'greater',
  'less',
] as const;

export const AutomationCondition = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('tql'),
    query: TqlText,
    /** matches: the issue matches; some/none: the query finds issues or none. */
    mode: z.enum(['matches', 'some', 'none']).default('matches'),
  }),
  z.object({
    type: z.literal('compare'),
    /** Usually a smart value, e.g. {{issue.priority.name}}. */
    left: Template,
    operator: z.enum(COMPARE_OPERATORS),
    right: Template.default(''),
  }),
  z.object({
    type: z.literal('user'),
    who: z.enum(['initiator', 'assignee', 'reporter']),
    check: z.enum(['is', 'is-not', 'in-group', 'not-in-group', 'empty', 'not-empty']),
    /** A user id for is/is-not, a group name for the group checks. */
    value: Short.default(''),
  }),
]);
export type AutomationCondition = z.infer<typeof AutomationCondition>;

export const SET_FIELDS = [
  'summary',
  'description',
  'priority',
  'dueDate',
  'startDate',
  'storyPoints',
  'labels-add',
  'labels-remove',
] as const;

export const AutomationAction = z.discriminatedUnion('type', [
  z.object({ type: z.literal('set-field'), field: z.enum(SET_FIELDS), value: Template }),
  z.object({ type: z.literal('transition'), to: Short }),
  z.object({
    type: z.literal('assign'),
    to: z.enum(['initiator', 'reporter', 'unassigned', 'user']),
    userId: z.string().max(40).default(''),
  }),
  z.object({ type: z.literal('comment'), body: Template }),
  /**
   * Asks the configured language model (TL-49, E-139); the answer is `{{ai.response}}` for the
   * following actions. The action itself changes nothing.
   */
  z.object({ type: z.literal('ai'), prompt: Template }),
  /**
   * JavaScript in an isolated interpreter without network or files (TL-50, E-140); what it
   * returns is `{{script.result}}` for the following actions.
   */
  z.object({ type: z.literal('script'), code: z.string().max(20_000) }),
  z.object({
    type: z.literal('create-issue'),
    /** Empty: the project of the current issue or of the rule. */
    projectKey: z.string().trim().max(10).default(''),
    issueType: z.string().trim().min(1).max(40),
    summary: Template,
    description: Template.default(''),
    /** As a subtask of the current issue. */
    subtask: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('clone-issue'),
    summary: Template.default(''),
    includeSubtasks: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('link'),
    linkType: Short,
    direction: z.enum(['outward', 'inward']).default('outward'),
    /** An issue key, usually with smart values. */
    target: Template,
  }),
  z.object({
    type: z.literal('email'),
    /** People of the issue, plus addresses separated by commas. */
    to: z
      .array(z.enum(['assignee', 'reporter', 'watchers', 'initiator']))
      .max(4)
      .default([]),
    addresses: z.string().max(1_000).default(''),
    subject: Template,
    body: Template,
  }),
  z.object({
    type: z.literal('webhook'),
    url: z.url({ protocol: /^https?$/ }).max(2_000),
    /** JSON with smart values; empty sends the issue and the rule. */
    body: Template.default(''),
  }),
  z.object({
    type: z.literal('create-page'),
    spaceKey: z.string().trim().min(1).max(20),
    parentId: z.string().max(40).default(''),
    title: Template,
    content: Template.default(''),
  }),
]);
export type AutomationAction = z.infer<typeof AutomationAction>;

export interface AutomationIf {
  type: 'if';
  match: 'all' | 'any';
  conditions: AutomationCondition[];
  onTrue: AutomationComponent[];
  onFalse: AutomationComponent[];
}
export interface AutomationBranch {
  type: 'branch';
  over: 'subtasks' | 'parent' | 'linked' | 'query';
  query: string;
  components: AutomationComponent[];
}
export type AutomationComponent =
  | AutomationCondition
  | AutomationAction
  | AutomationIf
  | AutomationBranch;

export const AutomationComponent: z.ZodType<AutomationComponent> = z.lazy(() =>
  z.union([
    AutomationCondition,
    AutomationAction,
    z.object({
      type: z.literal('if'),
      match: z.enum(['all', 'any']).default('all'),
      conditions: z.array(AutomationCondition).min(1).max(20),
      onTrue: z.array(AutomationComponent).max(50),
      onFalse: z.array(AutomationComponent).max(50).default([]),
    }),
    z.object({
      type: z.literal('branch'),
      over: z.enum(['subtasks', 'parent', 'linked', 'query']),
      query: TqlText.default(''),
      components: z.array(AutomationComponent).max(50),
    }),
  ]),
) as z.ZodType<AutomationComponent>;

export const AutomationRuleInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(1_000).default(''),
    enabled: z.boolean().default(true),
    /** Null: a global rule for every project. */
    projectKey: z.string().trim().max(10).nullable().default(null),
    trigger: AutomationTrigger,
    components: z.array(AutomationComponent).max(100),
    /** Whether changes made by this rule may trigger it again (loop protection, E-103). */
    allowSelfTrigger: z.boolean().default(false),
  })
  .meta({ id: 'AutomationRuleInput' });
export type AutomationRuleInput = z.infer<typeof AutomationRuleInput>;

export const RUN_STATUSES = ['success', 'no-match', 'error', 'loop', 'throttled'] as const;
export const AutomationRunStatus = z.enum(RUN_STATUSES);
export type AutomationRunStatus = z.infer<typeof AutomationRunStatus>;

export const AutomationRule = z
  .object({
    id: z.uuid(),
    name: z.string(),
    description: z.string(),
    enabled: z.boolean(),
    project: z.object({ key: z.string(), name: z.string() }).nullable(),
    trigger: AutomationTrigger,
    components: z.array(z.unknown()),
    allowSelfTrigger: z.boolean(),
    owner: z.object({ id: z.uuid(), displayName: z.string() }).nullable(),
    /** Set when the rule switched itself off, e.g. after too many runs. */
    disabledReason: z.string().nullable(),
    /** For incoming webhooks: the address to call, with its secret. Owners only. */
    webhookUrl: z.string().nullable(),
    lastRun: z.object({ at: z.iso.datetime(), status: AutomationRunStatus }).nullable(),
    canEdit: z.boolean(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'AutomationRule' });
export type AutomationRule = Omit<z.infer<typeof AutomationRule>, 'components'> & {
  components: AutomationComponent[];
};

export const AutomationRunLine = z.object({
  level: z.enum(['info', 'error']),
  message: z.string(),
});
export type AutomationRunLine = z.infer<typeof AutomationRunLine>;

export const AutomationRun = z
  .object({
    id: z.uuid(),
    startedAt: z.iso.datetime(),
    durationMs: z.number().int(),
    status: AutomationRunStatus,
    trigger: z.string(),
    issueKey: z.string().nullable(),
    log: z.array(AutomationRunLine),
  })
  .meta({ id: 'AutomationRun' });
export type AutomationRun = z.infer<typeof AutomationRun>;

export const AutomationRuleQuery = z.object({
  /** Rules of this project; without it the global rules. */
  project: z.string().trim().max(10).optional(),
});
export type AutomationRuleQuery = z.infer<typeof AutomationRuleQuery>;

/** Body of an incoming webhook: optionally the issues to run the rule for. */
export const IncomingWebhookRequest = z
  .looseObject({ issues: z.array(z.string().min(1).max(30)).max(100).optional() })
  .meta({ id: 'IncomingWebhookRequest' });
export type IncomingWebhookRequest = z.infer<typeof IncomingWebhookRequest>;

/** Ready-made rules (T-AUT-06); names and descriptions come from the web app's texts. */
export const AUTOMATION_TEMPLATES: Array<{
  key: string;
  trigger: AutomationTrigger;
  components: AutomationComponent[];
}> = [
  {
    key: 'close-parent',
    trigger: { type: 'issue-transitioned', from: '', to: '' },
    components: [
      { type: 'tql', query: 'statusCategory = done AND parent is not EMPTY', mode: 'matches' },
      {
        type: 'branch',
        over: 'parent',
        query: '',
        components: [
          {
            type: 'tql',
            query: 'parent = {{issue.key}} AND statusCategory != done',
            mode: 'none',
          },
          { type: 'transition', to: 'Erledigt' },
        ],
      },
    ],
  },
  {
    key: 'parent-in-progress',
    trigger: { type: 'issue-transitioned', from: '', to: 'In Arbeit' },
    components: [
      {
        type: 'branch',
        over: 'parent',
        query: '',
        components: [
          { type: 'tql', query: 'statusCategory = todo', mode: 'matches' },
          { type: 'transition', to: 'In Arbeit' },
        ],
      },
    ],
  },
  {
    key: 'assign-creator',
    trigger: { type: 'issue-created' },
    components: [
      { type: 'user', who: 'assignee', check: 'empty', value: '' },
      { type: 'assign', to: 'initiator', userId: '' },
    ],
  },
  {
    key: 'overdue-reminder',
    trigger: {
      type: 'schedule',
      cron: '0 8 * * 1-5',
      query: 'due < startOfDay() AND statusCategory != done',
    },
    components: [
      {
        type: 'comment',
        body: 'Dieser Vorgang ist seit {{issue.dueDate}} überfällig. Bitte Fälligkeit prüfen.',
      },
    ],
  },
  {
    key: 'released-comment',
    trigger: { type: 'version-released' },
    components: [
      {
        type: 'branch',
        over: 'query',
        query: 'fixVersion = "{{version.name}}"',
        components: [{ type: 'comment', body: 'Ausgeliefert mit Version {{version.name}}.' }],
      },
    ],
  },
  {
    key: 'epic-page',
    trigger: { type: 'issue-created' },
    components: [
      { type: 'tql', query: 'type = Epic', mode: 'matches' },
      {
        type: 'create-page',
        spaceKey: '',
        parentId: '',
        title: '{{issue.key}} {{issue.summary}}',
        content:
          '## Ziel\n\nZu {{issue.key}}: {{issue.summary}}\n\n## Umfang\n\n::issues{query="parent = {{issue.key}}"}',
      },
    ],
  },
];
