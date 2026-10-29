import { z } from 'zod';
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

export const TrackingMeta = z
  .object({
    issueTypes: z.array(IssueTypeInfo),
    statuses: z.array(StatusInfo),
    priorities: z.array(PriorityInfo),
    resolutions: z.array(ResolutionInfo),
    linkTypes: z.array(IssueLinkTypeInfo),
  })
  .meta({ id: 'TrackingMeta' });
export type TrackingMeta = z.infer<typeof TrackingMeta>;

/** A ProseMirror document as produced by the Tasklore editor. Structure is validated by the editor schema. */
export const RichText = z
  .looseObject({ type: z.literal('doc'), content: z.array(z.unknown()).optional() })
  .meta({ id: 'RichText' });
export type RichText = z.infer<typeof RichText>;

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
  })
  .meta({ id: 'ProjectSummary' });
export type ProjectSummary = z.infer<typeof ProjectSummary>;

export const ProjectDetails = ProjectSummary.extend({
  issueTypes: z.array(IssueTypeInfo),
  statuses: z.array(StatusInfo),
  permissions: z.array(ProjectPermission),
}).meta({ id: 'ProjectDetails' });
export type ProjectDetails = z.infer<typeof ProjectDetails>;

const Summary = z.string().trim().min(1, 'Zusammenfassung fehlt').max(255);
const Labels = z
  .array(z.string().trim().min(1).max(64).regex(/^\S+$/, 'Labels ohne Leerzeichen'))
  .max(30);
const StoryPoints = z.number().min(0).max(1000).nullable();
/** Components by id or name (case-insensitive) within the issue's project. */
const ComponentNames = z.array(z.string().trim().min(1).max(100)).max(20);
const DueDate = z.iso.date().nullable();

export const CreateIssueRequest = z
  .object({
    projectKey: ProjectKey,
    issueType: z.string().min(1),
    summary: Summary,
    description: RichText.nullable().default(null),
    priority: z.string().min(1).optional(),
    assigneeId: Id.nullable().default(null),
    parentKey: z.string().nullable().default(null),
    labels: Labels.default([]),
    storyPoints: StoryPoints.default(null),
    dueDate: DueDate.default(null),
    components: ComponentNames.default([]),
  })
  .meta({ id: 'CreateIssueRequest' });
export type CreateIssueRequest = z.infer<typeof CreateIssueRequest>;

export const UpdateIssueRequest = z
  .object({
    summary: Summary,
    description: RichText.nullable(),
    issueType: z.string().min(1),
    priority: z.string().min(1),
    assigneeId: Id.nullable(),
    parentKey: z.string().nullable(),
    labels: Labels,
    storyPoints: StoryPoints,
    dueDate: DueDate,
    components: ComponentNames,
  })
  .partial()
  .meta({ id: 'UpdateIssueRequest' });
export type UpdateIssueRequest = z.infer<typeof UpdateIssueRequest>;

export const IssueRef = z.object({ key: z.string(), summary: z.string() }).meta({ id: 'IssueRef' });
export type IssueRef = z.infer<typeof IssueRef>;

export const IssueSummary = z
  .object({
    id: Id,
    key: z.string(),
    summary: z.string(),
    issueType: IssueTypeInfo,
    status: StatusInfo,
    priority: PriorityInfo,
    assignee: UserRef.nullable(),
    storyPoints: z.number().nullable(),
    labels: z.array(z.string()),
    rank: z.string(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'IssueSummary' });
export type IssueSummary = z.infer<typeof IssueSummary>;

export const ComponentRef = z.object({ id: Id, name: z.string() }).meta({ id: 'ComponentRef' });
export type ComponentRef = z.infer<typeof ComponentRef>;

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
  project: z.object({ key: z.string(), name: z.string() }),
  description: RichText.nullable(),
  resolution: ResolutionInfo.nullable(),
  reporter: UserRef.nullable(),
  parent: IssueRef.nullable(),
  children: z.array(IssueSummary),
  dueDate: z.iso.date().nullable(),
  createdAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
  watching: z.boolean(),
  watcherCount: z.number().int(),
  components: z.array(ComponentRef),
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
    body: RichText,
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
  .object({ body: RichText })
  .meta({ id: 'CreateCommentRequest' });
export type CreateCommentRequest = z.infer<typeof CreateCommentRequest>;

export const UpdateCommentRequest = z
  .object({ body: RichText })
  .meta({ id: 'UpdateCommentRequest' });
export type UpdateCommentRequest = z.infer<typeof UpdateCommentRequest>;

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
