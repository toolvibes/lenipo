import { z } from 'zod';
import { CustomField, CustomFieldInputs, CustomFieldValue, ProjectFieldConfig } from './fields.js';
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
  // TL-13, E-94: choose or change an issue's security level.
  'set-issue-security',
] as const;
export const ProjectPermission = z.enum(PROJECT_PERMISSIONS).meta({ id: 'ProjectPermission' });
export type ProjectPermission = z.infer<typeof ProjectPermission>;

export const UserRef = z.object({ id: Id, displayName: z.string() }).meta({ id: 'UserRef' });
export type UserRef = z.infer<typeof UserRef>;

export const PROJECT_ROLES = ['administrators', 'developers', 'users'] as const;
export const ProjectRole = z.enum(PROJECT_ROLES).meta({ id: 'ProjectRole' });
export type ProjectRole = z.infer<typeof ProjectRole>;

/** A person or group holding a role in a project (T-PRJ-07, TL-65). */
export const ProjectMember = z
  .object({
    id: Id,
    role: ProjectRole,
    user: UserRef.nullable(),
    group: z.object({ id: Id, name: z.string() }).nullable(),
    /** The person is an external collaborator (TL-66). */
    external: z.boolean(),
  })
  .meta({ id: 'ProjectMember' });
export type ProjectMember = z.infer<typeof ProjectMember>;

// ---------------------------------------------------------------- permission schemes (E-82)

/** `assignee` and `reporter` hold a permission only on the issues where they are that (TL-72). */
export const PERMISSION_GRANTEES = ['role', 'group', 'user', 'assignee', 'reporter'] as const;
/** What can hold per issue; seeing, creating and administering stay project rights (TL-72). */
export const ISSUE_PERMISSIONS = [
  'edit-issues',
  'transition-issues',
  'assign-issues',
  'comment',
  'delete-issues',
] as const satisfies readonly ProjectPermission[];
export type IssuePermission = (typeof ISSUE_PERMISSIONS)[number];
export const PermissionGrantee = z.enum(PERMISSION_GRANTEES).meta({ id: 'PermissionGrantee' });
export type PermissionGrantee = z.infer<typeof PermissionGrantee>;

/**
 * One right in a scheme: a project role, a group or one person holds a project permission;
 * or the assignee or reporter of each issue holds it on that issue.
 */
export const PermissionGrant = z
  .object({
    permission: ProjectPermission,
    grantee: PermissionGrantee,
    role: ProjectRole.nullable(),
    group: z.object({ id: Id, name: z.string() }).nullable(),
    user: UserRef.nullable(),
  })
  .meta({ id: 'PermissionGrant' });
export type PermissionGrant = z.infer<typeof PermissionGrant>;

export const PermissionGrantInput = z
  .union([
    z.strictObject({ permission: ProjectPermission, role: ProjectRole }),
    z.strictObject({ permission: ProjectPermission, groupId: Id }),
    z.strictObject({ permission: ProjectPermission, userId: Id }),
    // Issue-wise browse would be issue security (TL-13).
    z.strictObject({
      permission: z.enum(ISSUE_PERMISSIONS),
      grantee: z.enum(['assignee', 'reporter']),
    }),
  ])
  .meta({ id: 'PermissionGrantInput' });
export type PermissionGrantInput = z.infer<typeof PermissionGrantInput>;

export const PermissionSchemeSummary = z
  .object({
    id: Id,
    name: z.string(),
    description: z.string(),
    /** Used by every project without a scheme of its own; cannot be deleted. */
    isDefault: z.boolean(),
    projects: z.array(z.object({ key: z.string(), name: z.string() })),
  })
  .meta({ id: 'PermissionSchemeSummary' });
export type PermissionSchemeSummary = z.infer<typeof PermissionSchemeSummary>;

export const PermissionScheme = PermissionSchemeSummary.extend({
  grants: z.array(PermissionGrant),
}).meta({ id: 'PermissionScheme' });
export type PermissionScheme = z.infer<typeof PermissionScheme>;

const SchemeName = z.string().trim().min(1).max(80);

export const CreatePermissionSchemeRequest = z
  .object({
    name: SchemeName,
    description: z.string().max(500).default(''),
    /** Starts with the grants of this scheme; the default scheme if left out. */
    copyFromId: Id.optional(),
  })
  .meta({ id: 'CreatePermissionSchemeRequest' });
export type CreatePermissionSchemeRequest = z.infer<typeof CreatePermissionSchemeRequest>;

export const UpdatePermissionSchemeRequest = z
  .object({
    name: SchemeName,
    description: z.string().max(500),
    /** Replaces all grants of the scheme. */
    grants: z.array(PermissionGrantInput).max(500),
  })
  .partial()
  .meta({ id: 'UpdatePermissionSchemeRequest' });
export type UpdatePermissionSchemeRequest = z.infer<typeof UpdatePermissionSchemeRequest>;

export const SetProjectPermissionSchemeRequest = z
  .object({ schemeId: Id.nullable() })
  .meta({ id: 'SetProjectPermissionSchemeRequest' });
export type SetProjectPermissionSchemeRequest = z.infer<typeof SetProjectPermissionSchemeRequest>;

// ---------------------------------------------------------------- notification schemes (E-83)

export const NOTIFICATION_EVENTS = [
  'created',
  'assigned',
  'status',
  'updated',
  'commented',
] as const;
export const NotificationEvent = z.enum(NOTIFICATION_EVENTS).meta({ id: 'NotificationEvent' });
export type NotificationEvent = z.infer<typeof NotificationEvent>;

export const NOTIFICATION_RECIPIENTS = [
  'watchers',
  'assignee',
  'reporter',
  'role',
  'group',
  'user',
] as const;
export const NotificationRecipient = z
  .enum(NOTIFICATION_RECIPIENTS)
  .meta({ id: 'NotificationRecipient' });
export type NotificationRecipient = z.infer<typeof NotificationRecipient>;

/** One rule of a scheme: an issue event reaches a kind of recipient. */
export const NotificationRule = z
  .object({
    event: NotificationEvent,
    recipient: NotificationRecipient,
    role: ProjectRole.nullable(),
    group: z.object({ id: Id, name: z.string() }).nullable(),
    user: UserRef.nullable(),
  })
  .meta({ id: 'NotificationRule' });
export type NotificationRule = z.infer<typeof NotificationRule>;

export const NotificationRuleInput = z
  .union([
    z.strictObject({
      event: NotificationEvent,
      recipient: z.enum(['watchers', 'assignee', 'reporter']),
    }),
    z.strictObject({ event: NotificationEvent, role: ProjectRole }),
    z.strictObject({ event: NotificationEvent, groupId: Id }),
    z.strictObject({ event: NotificationEvent, userId: Id }),
  ])
  .meta({ id: 'NotificationRuleInput' });
export type NotificationRuleInput = z.infer<typeof NotificationRuleInput>;

export const NotificationSchemeSummary = PermissionSchemeSummary.meta({
  id: 'NotificationSchemeSummary',
});
export type NotificationSchemeSummary = z.infer<typeof NotificationSchemeSummary>;

export const NotificationScheme = PermissionSchemeSummary.extend({
  rules: z.array(NotificationRule),
}).meta({ id: 'NotificationScheme' });
export type NotificationScheme = z.infer<typeof NotificationScheme>;

export const CreateNotificationSchemeRequest = CreatePermissionSchemeRequest.meta({
  id: 'CreateNotificationSchemeRequest',
});
export type CreateNotificationSchemeRequest = z.infer<typeof CreateNotificationSchemeRequest>;

export const UpdateNotificationSchemeRequest = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().max(500),
    /** Replaces all rules of the scheme. */
    rules: z.array(NotificationRuleInput).max(500),
  })
  .partial()
  .meta({ id: 'UpdateNotificationSchemeRequest' });
export type UpdateNotificationSchemeRequest = z.infer<typeof UpdateNotificationSchemeRequest>;

// ---------------------------------------------------------------- issue security (TL-13, E-94)

/** Who sees issues of a security level: a role, a group, a person, the reporter or assignee. */
export const SecurityGrantInput = z
  .union([
    z.strictObject({ role: ProjectRole }),
    z.strictObject({ groupId: Id }),
    z.strictObject({ userId: Id }),
    z.strictObject({ grantee: z.enum(['assignee', 'reporter']) }),
  ])
  .meta({ id: 'SecurityGrantInput' });
export type SecurityGrantInput = z.infer<typeof SecurityGrantInput>;

export const SecurityGrant = z
  .object({
    grantee: PermissionGrantee,
    role: ProjectRole.nullable(),
    group: z.object({ id: Id, name: z.string() }).nullable(),
    user: UserRef.nullable(),
  })
  .meta({ id: 'SecurityGrant' });
export type SecurityGrant = z.infer<typeof SecurityGrant>;

export const SecurityLevel = z
  .object({ id: Id, name: z.string(), description: z.string(), grants: z.array(SecurityGrant) })
  .meta({ id: 'SecurityLevel' });
export type SecurityLevel = z.infer<typeof SecurityLevel>;

export const SecuritySchemeSummary = z
  .object({
    id: Id,
    name: z.string(),
    description: z.string(),
    projects: z.array(z.object({ key: z.string(), name: z.string() })),
  })
  .meta({ id: 'SecuritySchemeSummary' });
export type SecuritySchemeSummary = z.infer<typeof SecuritySchemeSummary>;

export const SecurityScheme = SecuritySchemeSummary.extend({
  levels: z.array(SecurityLevel),
  /** New issues get this level unless they choose another (or none). */
  defaultLevelId: Id.nullable(),
}).meta({ id: 'SecurityScheme' });
export type SecurityScheme = z.infer<typeof SecurityScheme>;

export const CreateSecuritySchemeRequest = z
  .object({ name: SchemeName, description: z.string().max(500).default('') })
  .meta({ id: 'CreateSecuritySchemeRequest' });
export type CreateSecuritySchemeRequest = z.infer<typeof CreateSecuritySchemeRequest>;

export const UpdateSecuritySchemeRequest = z
  .object({
    name: SchemeName,
    description: z.string().max(500),
    /** Replaces the levels; entries with an id keep it, so issues stay on their level. */
    levels: z
      .array(
        z.object({
          id: Id.optional(),
          name: z.string().trim().min(1).max(60),
          description: z.string().max(500).default(''),
          grants: z.array(SecurityGrantInput).max(100),
        }),
      )
      .max(30),
    /** Index into `levels`, or null for no default. */
    defaultLevel: z.number().int().min(0).nullable(),
  })
  .partial()
  .meta({ id: 'UpdateSecuritySchemeRequest' });
export type UpdateSecuritySchemeRequest = z.infer<typeof UpdateSecuritySchemeRequest>;

export const SetProjectSecuritySchemeRequest = z
  .object({ schemeId: Id.nullable() })
  .meta({ id: 'SetProjectSecuritySchemeRequest' });
export type SetProjectSecuritySchemeRequest = z.infer<typeof SetProjectSecuritySchemeRequest>;

export const AddProjectMemberRequest = z
  .union([
    // shareSpace: the same level in the spaces linked to the project (TL-68, E-131).
    z.strictObject({ role: ProjectRole, userId: Id, shareSpace: z.boolean().optional() }),
    z.strictObject({ role: ProjectRole, groupId: Id, shareSpace: z.boolean().optional() }),
  ])
  .meta({ id: 'AddProjectMemberRequest' });
export type AddProjectMemberRequest = z.infer<typeof AddProjectMemberRequest>;

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

/** A ProseMirror document as produced by the Lenipo editor. Structure is validated by the editor schema. */
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
  /** The permission scheme the project uses (E-82). */
  permissionScheme: z.object({ id: Id, name: z.string() }),
  /** The notification scheme the project uses (E-83). */
  notificationScheme: z.object({ id: Id, name: z.string() }),
  /** The issue security scheme, if any (TL-13, E-94), and its levels to choose from. */
  securityScheme: z.object({ id: Id, name: z.string() }).nullable(),
  securityLevels: z.array(z.object({ id: Id, name: z.string() })),
  /** The level new issues get unless another is chosen. */
  securityDefaultLevelId: Id.nullable(),
  issueTypes: z.array(IssueTypeInfo),
  statuses: z.array(StatusInfo),
  permissions: z.array(ProjectPermission),
  /** Custom fields the project's forms show, in display order (E-50); hidden ones left out. */
  customFieldIds: z.array(Id),
  /** Every switched-on field with its configuration, hidden ones included (TL-12, E-89). */
  customFieldSettings: z.array(ProjectFieldConfig),
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
/** Versions by id or name (case-insensitive) within the issue's project (E-57). */
const VersionNames = z.array(z.string().trim().min(1).max(100)).max(20);

export const CreateIssueRequest = z
  .object({
    projectKey: ProjectKey,
    /** A level of the project's security scheme; left out: the scheme's default (E-94). */
    securityLevelId: Id.nullable().optional(),
    issueType: z.string().min(1),
    summary: Summary,
    description: RichTextInput.nullable().default(null),
    priority: z.string().min(1).optional(),
    assigneeId: Id.nullable().default(null),
    parentKey: z.string().nullable().default(null),
    labels: Labels.default([]),
    storyPoints: StoryPoints.default(null),
    startDate: DueDate.default(null),
    dueDate: DueDate.default(null),
    components: ComponentNames.default([]),
    fixVersions: VersionNames.default([]),
    affectsVersions: VersionNames.default([]),
    customFields: CustomFieldInputs.default({}),
  })
  .meta({ id: 'CreateIssueRequest' });
export type CreateIssueRequest = z.infer<typeof CreateIssueRequest>;

export const UpdateIssueRequest = z
  .object({
    /** Needs the permission `set-issue-security`; subtasks follow their parent (E-94). */
    securityLevelId: Id.nullable(),
    summary: Summary,
    description: RichTextInput.nullable(),
    issueType: z.string().min(1),
    priority: z.string().min(1),
    assigneeId: Id.nullable(),
    parentKey: z.string().nullable(),
    labels: Labels,
    storyPoints: StoryPoints,
    startDate: DueDate,
    dueDate: DueDate,
    components: ComponentNames,
    fixVersions: VersionNames,
    affectsVersions: VersionNames,
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

/** A version as issues show it (E-57). */
export const VersionRef = z
  .object({ id: Id, name: z.string(), released: z.boolean() })
  .meta({ id: 'VersionRef' });
export type VersionRef = z.infer<typeof VersionRef>;

export const SprintState = z.enum(['future', 'active', 'closed']);
export type SprintState = z.infer<typeof SprintState>;

/** The open sprint an issue is planned in (E-55). */
export const SprintRef = z
  .object({ id: Id, name: z.string(), state: SprintState })
  .meta({ id: 'SprintRef' });
export type SprintRef = z.infer<typeof SprintRef>;

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
    /** Planned start (E-68). */
    startDate: z.iso.date().nullable(),
    dueDate: z.iso.date().nullable(),
    createdAt: z.iso.datetime(),
    /** When the issue got a resolution, e.g. for the calendar (T-VIEW-02). */
    resolvedAt: z.iso.datetime().nullable(),
    components: z.array(ComponentRef),
    timeTracking: TimeTracking,
    /** Values of the custom fields the project uses, by field id (E-50). */
    customFields: z.record(Id, CustomFieldValue),
    /** The parent (epic or story), e.g. for swimlanes (T-BRD-06). */
    parent: IssueRef.nullable(),
    /** The open (future or active) sprint the issue is in (E-55). */
    sprint: SprintRef.nullable(),
    /** Versions that ship the issue and versions it affects (E-57). */
    fixVersions: z.array(VersionRef),
    affectsVersions: z.array(VersionRef),
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
  /** Only people the level grants see the issue (TL-13, E-94). */
  securityLevel: z.object({ id: Id, name: z.string() }).nullable(),
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

/** Whether moving into a status asks for a comment (TL-85, E-127). */
export const TRANSITION_COMMENT = ['none', 'optional', 'required'] as const;

export const Transition = z
  .object({
    id: z.string(),
    name: z.string(),
    to: StatusInfo,
    setsResolution: z.boolean(),
    /** Fields the move needs filled: `TRANSITION_FIELDS` keys or custom field ids (TL-85). */
    requiredFields: z.array(z.string()),
    comment: z.enum(TRANSITION_COMMENT),
    /** Ask in a dialog before moving, even when nothing is missing. */
    screen: z.boolean(),
  })
  .meta({ id: 'Transition' });
export type Transition = z.infer<typeof Transition>;

export const TransitionRequest = z
  .object({
    transitionId: z.string().min(1),
    resolution: z.string().min(1).optional(),
    /** Field values from the transition screen, set together with the move (TL-85, E-127). */
    fields: UpdateIssueRequest.optional(),
    /** A comment written in the transition screen. */
    comment: RichTextInput.optional(),
  })
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

// ---------------------------------------------------------------- versions (E-57)

export const Version = z
  .object({
    id: Id,
    name: z.string(),
    description: z.string(),
    startDate: z.iso.date().nullable(),
    releaseDate: z.iso.date().nullable(),
    released: z.boolean(),
    archived: z.boolean(),
    /** Issues with this fix version, and how many of them are not done. */
    issueCount: z.number().int(),
    openCount: z.number().int(),
  })
  .meta({ id: 'Version' });
export type Version = z.infer<typeof Version>;

const VersionName = z.string().trim().min(1).max(100);

export const CreateVersionRequest = z
  .object({
    name: VersionName,
    description: z.string().max(1_000).default(''),
    startDate: z.iso.date().nullable().default(null),
    releaseDate: z.iso.date().nullable().default(null),
  })
  .meta({ id: 'CreateVersionRequest' });
export type CreateVersionRequest = z.infer<typeof CreateVersionRequest>;

export const UpdateVersionRequest = z
  .object({
    name: VersionName,
    description: z.string().max(1_000),
    startDate: z.iso.date().nullable(),
    releaseDate: z.iso.date().nullable(),
    /** false takes a release back. */
    released: z.literal(false),
    archived: z.boolean(),
  })
  .partial()
  .meta({ id: 'UpdateVersionRequest' });
export type UpdateVersionRequest = z.infer<typeof UpdateVersionRequest>;

export const ReleaseVersionRequest = z
  .object({
    /** Defaults to today. */
    releaseDate: z.iso.date().optional(),
    /** Open issues with this fix version move to this unreleased version; null keeps them. */
    moveOpenTo: Id.nullable().default(null),
  })
  .meta({ id: 'ReleaseVersionRequest' });
export type ReleaseVersionRequest = z.infer<typeof ReleaseVersionRequest>;

// ---------------------------------------------------------------- workflow editor (E-70)

/** System fields a transition can require; custom fields are named by their id (TL-11). */
export const TRANSITION_FIELDS = [
  'assignee',
  'description',
  'dueDate',
  'startDate',
  'storyPoints',
  'labels',
  'components',
  'fixVersions',
] as const;

/** Fields a transition can clear afterwards (TL-75, E-86); labels can also be added or removed. */
export const TRANSITION_CLEARABLE = [
  'dueDate',
  'startDate',
  'storyPoints',
  'labels',
  'components',
  'fixVersions',
  'sprint',
] as const;

/**
 * One field change after a transition: "clear" a system or custom field, "add"/"remove" a label,
 * or "set" a custom field to a value in the form the issue API takes.
 */
export const TransitionFieldAction = z
  .object({
    /** A `TRANSITION_CLEARABLE` key or a custom field id. */
    field: z.string().min(1).max(64),
    action: z.enum(['clear', 'set', 'add', 'remove']),
    value: z
      .union([z.string().max(10_000), z.number(), z.boolean(), z.array(Id).max(100)])
      .optional(),
  })
  .meta({ id: 'TransitionFieldAction' });
export type TransitionFieldAction = z.infer<typeof TransitionFieldAction>;

/**
 * Rules for moving into one status (TL-11, E-85, E-86): conditions decide whether the transition
 * is offered at all, validators are checked when it runs, and post-functions follow it.
 */
export const TransitionRules = z
  .object({
    /** Only the issue's assignee may move it here. */
    onlyAssignee: z.boolean().default(false),
    /** Only members of these project roles (global administrators always); empty: everybody. */
    roles: z.array(ProjectRole).max(PROJECT_ROLES.length).default([]),
    /** Every subtask is done first. */
    subtasksDone: z.boolean().default(false),
    /** Every issue that blocks this one is done first (TL-75). */
    blockersDone: z.boolean().default(false),
    /** A `TRANSITION_FIELDS` key or a custom field id each; empty values block the move. */
    requiredFields: z.array(z.string().min(1).max(64)).max(30).default([]),
    /** The due date is set and not in the past (TL-75). */
    dueNotPast: z.boolean().default(false),
    /** Afterwards: keep the assignee, take the issue, give it to the reporter, or unassign it. */
    assign: z.enum(['keep', 'caller', 'reporter', 'nobody']).default('keep'),
    /** Afterwards, in this order (TL-75). */
    fieldActions: z.array(TransitionFieldAction).max(20).default([]),
    /** Afterwards the person moving the issue watches it (TL-75). */
    watch: z.boolean().default(false),
    /** Show a dialog when moving here, with the required fields and the comment (TL-85). */
    screen: z.boolean().default(false),
    /** Ask for a comment when moving here: not, as an option, or as a must (TL-85). */
    comment: z.enum(TRANSITION_COMMENT).default('none'),
  })
  .meta({ id: 'TransitionRules' });
export type TransitionRules = z.infer<typeof TransitionRules>;
export type TransitionRulesInput = z.input<typeof TransitionRules>;

export const WorkflowMode = z.enum(['free', 'defined']);
export type WorkflowMode = z.infer<typeof WorkflowMode>;

export const ProjectWorkflow = z
  .object({
    versionId: Id,
    version: z.number().int(),
    name: z.string(),
    /** The project edits its own copy; false while it still uses a shared workflow. */
    ownedByProject: z.boolean(),
    /** The issue type shown (TL-76, E-87); null for the project's standard workflow. */
    issueType: z.string().nullable(),
    /** The issue type has no workflow of its own and uses the standard one. */
    inherited: z.boolean(),
    /** Keys of the issue types with a workflow of their own. */
    ownTypes: z.array(z.string()),
    /** The saved draft of this workflow, if any (TL-77). */
    get draft() {
      return WorkflowDraft.nullable();
    },
    /** "free": every status reachable from every other; "defined": only `transitions`. */
    mode: WorkflowMode,
    statuses: z.array(StatusInfo),
    initialStatusId: Id,
    /** Allowed moves in "defined" mode; empty in "free" mode. */
    transitions: z.array(z.object({ from: Id, to: Id })),
    /** Rules for moving into a status, by its id; statuses without rules are missing. */
    rules: z.record(Id, TransitionRules),
    /** Issues of the project per status, for moving them off removed statuses. */
    usage: z.record(Id, z.number().int()),
    /** Every status there is, to pick from. */
    available: z.array(StatusInfo),
  })
  .meta({ id: 'ProjectWorkflow' });
export type ProjectWorkflow = z.infer<typeof ProjectWorkflow>;

export const PublishWorkflowRequest = z
  .object({
    /** The version the edit started from; another publish in between answers 409. */
    baseVersionId: Id,
    /** Publishes the workflow of this issue type (key); the first time gives it its own. */
    issueType: z.string().min(1).optional(),
    /** In board order; without id, a status of that name is reused or created. */
    statuses: z
      .array(
        z.object({
          id: Id.nullable(),
          name: z.string().trim().min(1).max(60),
          category: StatusCategory,
          /** Rules for moving into this status. */
          rules: TransitionRules.optional(),
        }),
      )
      .min(1)
      .max(30),
    /** Index into `statuses`. */
    initial: z.number().int().min(0),
    mode: WorkflowMode,
    /** Pairs of indexes into `statuses`, for "defined" mode. */
    transitions: z
      .array(z.object({ from: z.number().int().min(0), to: z.number().int().min(0) }))
      .max(900)
      .default([]),
    /** Removed status id → index of the status its issues move to. */
    migrate: z.record(Id, z.number().int().min(0)).default({}),
  })
  .meta({ id: 'PublishWorkflowRequest' });
export type PublishWorkflowRequest = z.infer<typeof PublishWorkflowRequest>;

/**
 * The shared, saved edit of a workflow (TL-77, E-88): one per project and issue type, saved while
 * editing. `stale` once someone published a newer version; publishing it then answers 409.
 */
export const WorkflowDraft = z
  .object({
    request: PublishWorkflowRequest,
    updatedBy: UserRef.nullable(),
    updatedAt: z.iso.datetime(),
    stale: z.boolean(),
  })
  .meta({ id: 'WorkflowDraft' });
export type WorkflowDraft = z.infer<typeof WorkflowDraft>;

// ---------------------------------------------------------------- issue lookup (E-73)

export const IssueLookupRequest = z
  .object({ keys: z.array(z.string().max(32)).max(200) })
  .meta({ id: 'IssueLookupRequest' });
export type IssueLookupRequest = z.infer<typeof IssueLookupRequest>;

/** Only issues the caller may see; unknown and hidden keys are both simply missing. */
export const IssueLookup = z
  .object({
    key: z.string(),
    summary: z.string(),
    issueType: IssueTypeInfo,
    status: StatusInfo,
  })
  .meta({ id: 'IssueLookup' });
export type IssueLookup = z.infer<typeof IssueLookup>;

// ---------------------------------------------------------------- bulk change and clone (TL-16, E-97)

/** One change for many issues (T-ISS-11); each issue is handled on its own. */
export const BulkAction = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal('edit'),
      /** Left out: no change; null unassigns. */
      assigneeId: Id.nullable().optional(),
      priority: z.string().min(1).optional(),
      addLabels: Labels.default([]),
      removeLabels: Labels.default([]),
    }),
    z.object({
      type: z.literal('transition'),
      statusId: Id,
      resolution: z.string().min(1).optional(),
    }),
    /** Into a sprint, or the backlog with null. */
    z.object({ type: z.literal('sprint'), sprintId: Id.nullable() }),
    z.object({ type: z.literal('delete') }),
    /** Into another project (TL-86, E-99); type and status as proposed unless given. */
    z.object({
      type: z.literal('move'),
      projectKey: ProjectKey,
      issueType: z.string().min(1).optional(),
      statusId: Id.optional(),
    }),
    z.object({ type: z.literal('watch') }),
    z.object({ type: z.literal('unwatch') }),
  ])
  .meta({ id: 'BulkAction' });
export type BulkAction = z.infer<typeof BulkAction>;

export const BulkRequest = z
  .object({ issueKeys: z.array(z.string().min(1).max(30)).min(1).max(200), action: BulkAction })
  .meta({ id: 'BulkRequest' });
export type BulkRequest = z.infer<typeof BulkRequest>;

export const BulkResult = z
  .object({
    results: z.array(z.object({ key: z.string(), ok: z.boolean(), error: z.string().nullable() })),
  })
  .meta({ id: 'BulkResult' });
export type BulkResult = z.infer<typeof BulkResult>;

/**
 * Up to 100 issues in one call (D-API-10, TL-41, E-122). Each goes through the same checks as
 * a single one; with `atomic` all or none are created.
 */
export const BulkCreateRequest = z
  .object({
    issues: z.array(CreateIssueRequest).min(1).max(100),
    atomic: z.boolean().default(false),
  })
  .meta({ id: 'BulkCreateRequest' });
export type BulkCreateRequest = z.infer<typeof BulkCreateRequest>;

/** Different changes to up to 100 issues; with `atomic` all or none are made. */
export const BulkUpdateRequest = z
  .object({
    updates: z
      .array(z.object({ key: z.string().min(1).max(30), fields: UpdateIssueRequest }))
      .min(1)
      .max(100),
    atomic: z.boolean().default(false),
  })
  .meta({ id: 'BulkUpdateRequest' });
export type BulkUpdateRequest = z.infer<typeof BulkUpdateRequest>;

/** One line per item, in the order sent; `key` is the created or changed issue. */
export const BulkItemsResult = z
  .object({
    results: z.array(
      z.object({
        index: z.number().int(),
        ok: z.boolean(),
        key: z.string().nullable(),
        error: z.string().nullable(),
      }),
    ),
  })
  .meta({ id: 'BulkItemsResult' });
export type BulkItemsResult = z.infer<typeof BulkItemsResult>;

/** An issue in its project's trash (TL-61, E-126), until retention deletes it for good. */
export const TrashedIssue = z
  .object({
    key: z.string(),
    summary: z.string(),
    deletedAt: z.iso.datetime(),
    deletedBy: UserRef.nullable(),
    /** Subtasks that went to the trash with it and come back with it. */
    subtasks: z.number().int(),
  })
  .meta({ id: 'TrashedIssue' });
export type TrashedIssue = z.infer<typeof TrashedIssue>;

/** A copy of an issue (T-ISS-10): fields, security level and a "clones" link to the original. */
export const CloneIssueRequest = z
  .object({
    summary: Summary.optional(),
    includeSubtasks: z.boolean().default(false),
  })
  .meta({ id: 'CloneIssueRequest' });
export type CloneIssueRequest = z.infer<typeof CloneIssueRequest>;

/**
 * Moves an issue with its subtasks to another project (T-ISS-10, TL-86, E-99). Without
 * `issueType` it keeps its type if the target offers it; without `statusId` it keeps its status
 * if the target workflow has it, else one of the same category, else the initial one.
 */
export const MoveIssueRequest = z
  .object({
    projectKey: ProjectKey,
    issueType: z.string().min(1).optional(),
    statusId: Id.optional(),
  })
  .meta({ id: 'MoveIssueRequest' });
export type MoveIssueRequest = z.infer<typeof MoveIssueRequest>;
