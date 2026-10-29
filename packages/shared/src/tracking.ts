import { z } from 'zod';
import { CustomField, CustomFieldInputs, CustomFieldValue } from './fields.js';
import { Id } from './identity.js';

export const StatusCategory = z
  .enum(['todo', 'in_progress', 'done'])
  .meta({ id: 'StatusCategory' });
export type StatusCategory = z.infer<typeof StatusCategory>;

export const PROJECT_TEMPLATES = ['scrum', 'kanban', 'basic', 'bugs'] as const;
export const ProjectTemplate = z.enum(PROJECT_TEMPLATES).meta({ id: 'ProjectTemplate' });
export type ProjectTemplate = z.infer<typeof ProjectTemplate>;

export const PROJECT_PERMISSIONS = [
  'browse',
  'create-issues',
  'edit-issues',
  'transition-issues',
  'assign-issues',
  'comment',
  'delete-issues',
  'administer',
] as const;
export const ProjectPermission = z.enum(PROJECT_PERMISSIONS).meta({ id: 'ProjectPermission' });
export type ProjectPermission = z.infer<typeof ProjectPermission>;

export const UserRef = z.object({ id: Id, displayName: z.string() }).meta({ id: 'UserRef' });
export type UserRef = z.infer<typeof UserRef>;

export const UserLookup = UserRef.extend({ email: z.string() }).meta({ id: 'UserLookup' });
export type UserLookup = z.infer<typeof UserLookup>;

export const IssueTypeInfo = z
  .object({
    id: Id,
    key: z.string(),
    name: z.string(),
    icon: z.string(),
    hierarchyLevel: z.number().int(),
  })
  .meta({ id: 'IssueTypeInfo' });
export type IssueTypeInfo = z.infer<typeof IssueTypeInfo>;

export const StatusInfo = z
  .object({ id: Id, key: z.string(), name: z.string(), category: StatusCategory })
  .meta({ id: 'StatusInfo' });
export type StatusInfo = z.infer<typeof StatusInfo>;

export const PriorityInfo = z
  .object({
    id: Id,
    key: z.string(),
    name: z.string(),
    icon: z.string(),
    sequence: z.number().int(),
  })
  .meta({ id: 'PriorityInfo' });
export type PriorityInfo = z.infer<typeof PriorityInfo>;

export const ResolutionInfo = z
  .object({ id: Id, key: z.string(), name: z.string() })
  .meta({ id: 'ResolutionInfo' });
export type ResolutionInfo = z.infer<typeof ResolutionInfo>;

/** A link type with one phrase per direction, e.g. "blocks" / "is blocked by" (E-41). */
export const IssueLinkTypeInfo = z
  .object({ id: Id, key: z.string(), name: z.string(), outward: z.string(), inward: z.string() })
  .meta({ id: 'IssueLinkTypeInfo' });
export type IssueLinkTypeInfo = z.infer<typeof IssueLinkTypeInfo>;

/** Length of a working day and week for durations like "1d" or "1w" (E-47). */
export const WorkingTime = z
  .object({
    hoursPerDay: z.number().min(1).max(24),
    daysPerWeek: z.number().int().min(1).max(7),
  })
  .meta({ id: 'WorkingTime' });
export type WorkingTime = z.infer<typeof WorkingTime>;

export const TrackingMeta = z
  .object({
    issueTypes: z.array(IssueTypeInfo),
    statuses: z.array(StatusInfo),
    priorities: z.array(PriorityInfo),
    resolutions: z.array(ResolutionInfo),
    linkTypes: z.array(IssueLinkTypeInfo),
    /** Largest attachment the server accepts, in bytes. */
    attachmentMaxBytes: z.number().int(),
    workingTime: WorkingTime,
    /** All custom fields, archived ones included (E-50). */
    customFields: z.array(CustomField),
  })
  .meta({ id: 'TrackingMeta' });
export type TrackingMeta = z.infer<typeof TrackingMeta>;

/** A ProseMirror document as produced by the Tasklore editor. Structure is validated by the editor schema. */
export const RichText = z
  .looseObject({ type: z.literal('doc'), content: z.array(z.unknown()).optional() })
  .meta({ id: 'RichText' });
export type RichText = z.infer<typeof RichText>;

/** Rich text as written: a document or Markdown (D-API-09, E-51). */
export const RichTextInput = z
  .union([RichText, z.strictObject({ markdown: z.string().max(200_000) })])
  .meta({ id: 'RichTextInput' });
export type RichTextInput = z.infer<typeof RichTextInput>;

/** Rich text in a response: the document, or Markdown text with `?format=markdown` (E-51). */
export const RichTextOutput = z.union([RichText, z.string()]).meta({ id: 'RichTextOutput' });
export type RichTextOutput = z.infer<typeof RichTextOutput>;

export const ContentFormat = z.enum(['json', 'markdown']);
export type ContentFormat = z.infer<typeof ContentFormat>;

export const FormatQuery = z.object({ format: ContentFormat.default('json') });
export type FormatQuery = z.infer<typeof FormatQuery>;

export const ProjectKey = z
  .string()
  .trim()
  .regex(
    /^[A-Z][A-Z0-9]{1,9}$/,
    '2–10 Zeichen: Großbuchstaben und Ziffern, beginnend mit einem Buchstaben',
  );

export const CreateProjectRequest = z
  .object({
    key: ProjectKey,
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(2000).default(''),
    template: ProjectTemplate,
  })
  .meta({ id: 'CreateProjectRequest' });
export type CreateProjectRequest = z.infer<typeof CreateProjectRequest>;

export const ProjectSummary = z
  .object({
    id: Id,
    key: z.string(),
    name: z.string(),
    description: z.string(),
    template: ProjectTemplate,
    lead: UserRef.nullable(),
    issueCount: z.number().int(),
    createdAt: z.iso.datetime(),
    /** Starred by the caller (P-GEN-05). */
    favourite: z.boolean(),
  })
  .meta({ id: 'ProjectSummary' });
export type ProjectSummary = z.infer<typeof ProjectSummary>;

export const ProjectDetails = ProjectSummary.extend({
  issueTypes: z.array(IssueTypeInfo),
  statuses: z.array(StatusInfo),
  permissions: z.array(ProjectPermission),
  /** Custom fields switched on for this project, in display order (E-50). */
  customFieldIds: z.array(Id),
}).meta({ id: 'ProjectDetails' });
export type ProjectDetails = z.infer<typeof ProjectDetails>;

const Summary = z.string().trim().min(1, 'Zusammenfassung fehlt').max(255);
const Labels = z
  .array(z.string().trim().min(1).max(64).regex(/^\S+$/, 'Labels ohne Leerzeichen'))
  .max(30);
const StoryPoints = z.number().min(0).max(1000).nullable();
/** A duration such as "1w 2d 3h 30m", read with the instance's working time (E-47). */
const DurationText = z.string().trim().min(1).max(50);

/** Components by id or name (case-insensitive) within the issue's project. */
const ComponentNames = z.array(z.string().trim().min(1).max(100)).max(20);
const DueDate = z.iso.date().nullable();

export const CreateIssueRequest = z
  .object({
    projectKey: ProjectKey,
    issueType: z.string().min(1),
    summary: Summary,
    description: RichTextInput.nullable().default(null),
    priority: z.string().min(1).optional(),
    assigneeId: Id.nullable().default(null),
    parentKey: z.string().nullable().default(null),
    labels: Labels.default([]),
    storyPoints: StoryPoints.default(null),
    dueDate: DueDate.default(null),
    components: ComponentNames.default([]),
    customFields: CustomFieldInputs.default({}),
  })
  .meta({ id: 'CreateIssueRequest' });
export type CreateIssueRequest = z.infer<typeof CreateIssueRequest>;

export const UpdateIssueRequest = z
  .object({
    summary: Summary,
    description: RichTextInput.nullable(),
    issueType: z.string().min(1),
    priority: z.string().min(1),
    assigneeId: Id.nullable(),
    parentKey: z.string().nullable(),
    labels: Labels,
    storyPoints: StoryPoints,
    dueDate: DueDate,
    components: ComponentNames,
    originalEstimate: DurationText.nullable(),
    remainingEstimate: DurationText.nullable(),
    /** Only the given fields change; null clears one (E-50). */
    customFields: CustomFieldInputs,
  })
  .partial()
  .meta({ id: 'UpdateIssueRequest' });
export type UpdateIssueRequest = z.infer<typeof UpdateIssueRequest>;

export const ComponentRef = z.object({ id: Id, name: z.string() }).meta({ id: 'ComponentRef' });
export type ComponentRef = z.infer<typeof ComponentRef>;

export const TimeTracking = z
  .object({
    originalEstimateSeconds: z.number().int().nullable(),
    remainingEstimateSeconds: z.number().int().nullable(),
    timeSpentSeconds: z.number().int(),
  })
  .meta({ id: 'TimeTracking' });
export type TimeTracking = z.infer<typeof TimeTracking>;

export const IssueRef = z.object({ key: z.string(), summary: z.string() }).meta({ id: 'IssueRef' });
export type IssueRef = z.infer<typeof IssueRef>;

export const IssueSummary = z
  .object({
    id: Id,
    key: z.string(),
    project: z.object({ key: z.string(), name: z.string() }),
    summary: z.string(),
    issueType: IssueTypeInfo,
    status: StatusInfo,
    priority: PriorityInfo,
    assignee: UserRef.nullable(),
    storyPoints: z.number().nullable(),
    labels: z.array(z.string()),
    rank: z.string(),
    updatedAt: z.iso.datetime(),
    // For the columns of result lists (T-QRY-08, E-48).
    reporter: UserRef.nullable(),
    resolution: ResolutionInfo.nullable(),
    dueDate: z.iso.date().nullable(),
    createdAt: z.iso.datetime(),
    components: z.array(ComponentRef),
    timeTracking: TimeTracking,
    /** Values of the custom fields the project uses, by field id (E-50). */
    customFields: z.record(Id, CustomFieldValue),
    /** The parent (epic or story), e.g. for swimlanes (T-BRD-06). */
    parent: IssueRef.nullable(),
    /** What the caller may change in lists (E-49); the API checks again on every change. */
    canEdit: z.boolean(),
    canAssign: z.boolean(),
    canTransition: z.boolean(),
  })
  .meta({ id: 'IssueSummary' });
export type IssueSummary = z.infer<typeof IssueSummary>;

export const LinkedIssue = IssueSummary.pick({
  id: true,
  key: true,
  summary: true,
  issueType: true,
  status: true,
  priority: true,
}).meta({ id: 'LinkedIssue' });
export type LinkedIssue = z.infer<typeof LinkedIssue>;

/** A link as seen from one issue: `direction` says which phrase of the type applies. */
export const IssueLink = z
  .object({
    id: Id,
    type: IssueLinkTypeInfo,
    direction: z.enum(['outward', 'inward']),
    issue: LinkedIssue,
  })
  .meta({ id: 'IssueLink' });
export type IssueLink = z.infer<typeof IssueLink>;

export const CreateIssueLinkRequest = z
  .object({
    /** Link type by key or name, e.g. "blocks". */
    type: z.string().min(1),
    /** "outward": this issue blocks the other one; "inward": it is blocked by it. */
    direction: z.enum(['outward', 'inward']).default('outward'),
    issueKey: z.string().min(1).max(30),
  })
  .meta({ id: 'CreateIssueLinkRequest' });
export type CreateIssueLinkRequest = z.infer<typeof CreateIssueLinkRequest>;

export const Component = z
  .object({
    id: Id,
    name: z.string(),
    description: z.string(),
    lead: UserRef.nullable(),
    defaultAssignee: UserRef.nullable(),
    issueCount: z.number().int(),
  })
  .meta({ id: 'Component' });
export type Component = z.infer<typeof Component>;

export const CreateComponentRequest = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(1_000).default(''),
    leadId: Id.nullable().default(null),
    defaultAssigneeId: Id.nullable().default(null),
  })
  .meta({ id: 'CreateComponentRequest' });
export type CreateComponentRequest = z.infer<typeof CreateComponentRequest>;

export const UpdateComponentRequest = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(1_000),
    leadId: Id.nullable(),
    defaultAssigneeId: Id.nullable(),
  })
  .partial()
  .meta({ id: 'UpdateComponentRequest' });
export type UpdateComponentRequest = z.infer<typeof UpdateComponentRequest>;

export const Issue = IssueSummary.extend({
  description: RichTextOutput.nullable(),
  children: z.array(IssueSummary),
  resolvedAt: z.iso.datetime().nullable(),
  watching: z.boolean(),
  watcherCount: z.number().int(),
  /** Links to issues the caller can see. */
  links: z.array(IssueLink),
}).meta({ id: 'Issue' });
export type Issue = z.infer<typeof Issue>;

export const IssueList = z
  .object({ issues: z.array(IssueSummary), total: z.number().int() })
  .meta({ id: 'IssueList' });
export type IssueList = z.infer<typeof IssueList>;

export const Transition = z
  .object({ id: z.string(), name: z.string(), to: StatusInfo, setsResolution: z.boolean() })
  .meta({ id: 'Transition' });
export type Transition = z.infer<typeof Transition>;

export const TransitionRequest = z
  .object({ transitionId: z.string().min(1), resolution: z.string().min(1).optional() })
  .meta({ id: 'TransitionRequest' });
export type TransitionRequest = z.infer<typeof TransitionRequest>;

export const Comment = z
  .object({
    id: Id,
    author: UserRef.nullable(),
    body: RichTextOutput,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    /** Changed after it was written (E-42). */
    edited: z.boolean(),
    canEdit: z.boolean(),
    canDelete: z.boolean(),
  })
  .meta({ id: 'Comment' });
export type Comment = z.infer<typeof Comment>;

export const CreateCommentRequest = z
  .object({ body: RichTextInput })
  .meta({ id: 'CreateCommentRequest' });
export type CreateCommentRequest = z.infer<typeof CreateCommentRequest>;

export const UpdateCommentRequest = z
  .object({ body: RichTextInput })
  .meta({ id: 'UpdateCommentRequest' });
export type UpdateCommentRequest = z.infer<typeof UpdateCommentRequest>;

/** A file attached to an issue; `url` serves its content (inline only for verified images). */
export const Attachment = z
  .object({
    id: Id,
    fileName: z.string(),
    contentType: z.string(),
    size: z.number().int(),
    image: z.boolean(),
    author: UserRef.nullable(),
    createdAt: z.iso.datetime(),
    url: z.string(),
    canDelete: z.boolean(),
  })
  .meta({ id: 'Attachment' });
export type Attachment = z.infer<typeof Attachment>;

/** Logged work on an issue (T-TIM-02). */
export const Worklog = z
  .object({
    id: Id,
    author: UserRef.nullable(),
    /** When the work was done. */
    started: z.iso.datetime(),
    timeSpentSeconds: z.number().int(),
    comment: z.string(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    canEdit: z.boolean(),
    canDelete: z.boolean(),
  })
  .meta({ id: 'Worklog' });
export type Worklog = z.infer<typeof Worklog>;

/** How logging work changes the remaining estimate (E-47). */
export const RemainingAdjustment = z
  .discriminatedUnion('mode', [
    z.object({ mode: z.literal('auto') }),
    z.object({ mode: z.literal('leave') }),
    z.object({ mode: z.literal('set'), value: DurationText }),
  ])
  .meta({ id: 'RemainingAdjustment' });
export type RemainingAdjustment = z.infer<typeof RemainingAdjustment>;

export const CreateWorklogRequest = z
  .object({
    timeSpent: DurationText,
    /** Defaults to now. */
    started: z.iso.datetime({ offset: true }).optional(),
    comment: z.string().max(2_000).default(''),
    remaining: RemainingAdjustment.default({ mode: 'auto' }),
  })
  .meta({ id: 'CreateWorklogRequest' });
export type CreateWorklogRequest = z.infer<typeof CreateWorklogRequest>;

export const UpdateWorklogRequest = z
  .object({
    timeSpent: DurationText,
    started: z.iso.datetime({ offset: true }),
    comment: z.string().max(2_000),
  })
  .partial()
  .meta({ id: 'UpdateWorklogRequest' });
export type UpdateWorklogRequest = z.infer<typeof UpdateWorklogRequest>;

export const ChangeGroup = z
  .object({
    id: z.number().int(),
    author: UserRef.nullable(),
    via: z.string(),
    createdAt: z.iso.datetime(),
    items: z.array(
      z.object({ field: z.string(), from: z.string().nullable(), to: z.string().nullable() }),
    ),
  })
  .meta({ id: 'ChangeGroup' });
export type ChangeGroup = z.infer<typeof ChangeGroup>;
