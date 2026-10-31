import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  bigserial,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { groups, users } from './identity.js';

/** PostgreSQL full-text vector; only ever written by generated columns. */
export const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

/** German and English stems of a text column (decision E-36). */
export function searchVector(column: string, weight: 'A' | 'B') {
  return `setweight(to_tsvector('german'::regconfig, coalesce(${column}, '')), '${weight}') || setweight(to_tsvector('english'::regconfig, coalesce(${column}, '')), '${weight}')`;
}

export const statusCategory = pgEnum('status_category', ['todo', 'in_progress', 'done']);

/** Global issue types (decision E-32); projects can hide some. */
export const issueTypes = pgTable('issue_types', {
  id: uuid().primaryKey(),
  /** Stable machine name; built-in types are translated in the UI by this key. */
  key: text().notNull().unique(),
  name: text().notNull(),
  description: text().notNull().default(''),
  /** Phosphor icon name. */
  icon: text().notNull(),
  /** 1 = epic level, 0 = standard, -1 = sub-task. */
  hierarchyLevel: integer().notNull().default(0),
  /** Display order within a hierarchy level. */
  position: integer().notNull().default(100),
  builtIn: boolean().notNull().default(false),
});

export const statuses = pgTable('statuses', {
  id: uuid().primaryKey(),
  key: text().notNull().unique(),
  name: text().notNull(),
  category: statusCategory().notNull(),
  builtIn: boolean().notNull().default(false),
});

export const priorities = pgTable('priorities', {
  id: uuid().primaryKey(),
  key: text().notNull().unique(),
  name: text().notNull(),
  /** Lower comes first: 1 = highest. */
  sequence: integer().notNull(),
  icon: text().notNull(),
  isDefault: boolean().notNull().default(false),
});

export const resolutions = pgTable('resolutions', {
  id: uuid().primaryKey(),
  key: text().notNull().unique(),
  name: text().notNull(),
  isDefault: boolean().notNull().default(false),
});

export const workflows = pgTable('workflows', {
  id: uuid().primaryKey(),
  key: text().notNull().unique(),
  name: text().notNull(),
  description: text().notNull().default(''),
  builtIn: boolean().notNull().default(false),
  /** Set for a project's own copy, made on its first edit (E-70); shared workflows have none. */
  projectId: uuid(),
});

/** A published workflow version is immutable (decision E-31); drafts come with the editor in phase 4. */
export const workflowVersions = pgTable(
  'workflow_versions',
  {
    id: uuid().primaryKey(),
    workflowId: uuid()
      .notNull()
      .references(() => workflows.id),
    version: integer().notNull(),
    /** WorkflowDefinition: statuses, initial status and transitions. */
    definition: jsonb().notNull(),
    publishedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('workflow_versions_workflow_version_unique').on(table.workflowId, table.version),
  ],
);

export const projects = pgTable(
  'projects',
  {
    id: uuid().primaryKey(),
    /** Upper-case key used in issue keys, e.g. WEB. */
    key: text().notNull(),
    name: text().notNull(),
    description: text().notNull().default(''),
    template: text().notNull(),
    leadId: uuid().references(() => users.id, { onDelete: 'set null' }),
    workflowVersionId: uuid()
      .notNull()
      .references(() => workflowVersions.id),
    /** Last issue number handed out; incremented under a row lock. */
    issueCounter: integer().notNull().default(0),
    /** Null uses the default permission scheme (TL-70, E-82). */
    permissionSchemeId: uuid().references((): AnyPgColumn => permissionSchemes.id, {
      onDelete: 'set null',
    }),
    /** Null uses the default notification scheme (TL-71, E-83). */
    notificationSchemeId: uuid().references((): AnyPgColumn => notificationSchemes.id, {
      onDelete: 'set null',
    }),
    /** Issue security (TL-13, E-94); null: no levels, every issue as browse allows. */
    securitySchemeId: uuid().references((): AnyPgColumn => securitySchemes.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp({ withTimezone: true }),
  },
  (table) => [uniqueIndex('projects_key_unique').on(table.key)],
);

export const projectHiddenIssueTypes = pgTable(
  'project_hidden_issue_types',
  {
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    issueTypeId: uuid()
      .notNull()
      .references(() => issueTypes.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.issueTypeId] })],
);

/**
 * Issue types with a workflow of their own (TL-76, E-87); the others use the project's workflow.
 * The workflow is a project-owned copy, so a new version replaces the row's version.
 */
export const projectTypeWorkflows = pgTable(
  'project_type_workflows',
  {
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    issueTypeId: uuid()
      .notNull()
      .references(() => issueTypes.id, { onDelete: 'cascade' }),
    workflowVersionId: uuid()
      .notNull()
      .references(() => workflowVersions.id),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.issueTypeId] })],
);

/**
 * The shared draft of a workflow edit (TL-77, E-88): one per project and scope, the scope being
 * '' for the standard workflow or an issue type id. `request` is a PublishWorkflowRequest.
 */
export const workflowDrafts = pgTable(
  'workflow_drafts',
  {
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    scope: text().notNull(),
    request: jsonb().notNull(),
    updatedById: uuid().references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.scope] })],
);

export const projectRole = pgEnum('project_role', ['administrators', 'developers', 'users']);

/** Who holds which role in a project: a single user or a whole group. */
export const projectRoleMembers = pgTable(
  'project_role_members',
  {
    id: uuid().primaryKey(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    role: projectRole().notNull(),
    userId: uuid().references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid().references(() => groups.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('project_role_members_project_idx').on(table.projectId),
    index('project_role_members_user_idx').on(table.userId),
    uniqueIndex('project_role_members_unique').on(
      table.projectId,
      table.role,
      table.userId,
      table.groupId,
    ),
  ],
);

/** The default scheme, created by migration with exactly the former fixed rights. */
export const DEFAULT_PERMISSION_SCHEME_ID = '01a00000-0000-7000-8000-00000000c0de';

/**
 * Named permission schemes shared by projects (P-PRM-02, TL-70, E-82): which project role,
 * group or person holds which project permission.
 */
export const permissionSchemes = pgTable(
  'permission_schemes',
  {
    id: uuid().primaryKey(),
    name: text().notNull(),
    description: text().notNull().default(''),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('permission_schemes_name_unique').on(table.name)],
);

/** `assignee` and `reporter` apply per issue: to whoever holds that place in it (TL-72). */
export const permissionGrantee = pgEnum('permission_grantee', [
  'role',
  'group',
  'user',
  'assignee',
  'reporter',
]);

/** The default notification scheme: every event to the watchers, as before (E-83). */
export const DEFAULT_NOTIFICATION_SCHEME_ID = '01a00000-0000-7000-8000-00000000b311';

/**
 * Named notification schemes shared by projects (P-NTF-03, TL-71, E-83): which issue event
 * reaches whom. Mentions always notify; nobody hears about what they may not see.
 */
export const notificationSchemes = pgTable(
  'notification_schemes',
  {
    id: uuid().primaryKey(),
    name: text().notNull(),
    description: text().notNull().default(''),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('notification_schemes_name_unique').on(table.name)],
);

export const notificationEvent = pgEnum('notification_event', [
  'created',
  'assigned',
  'status',
  'updated',
  'commented',
]);

export const notificationRecipient = pgEnum('notification_recipient', [
  'watchers',
  'assignee',
  'reporter',
  'role',
  'group',
  'user',
]);

export const notificationSchemeRules = pgTable(
  'notification_scheme_rules',
  {
    id: uuid().primaryKey(),
    schemeId: uuid()
      .notNull()
      .references(() => notificationSchemes.id, { onDelete: 'cascade' }),
    event: notificationEvent().notNull(),
    recipient: notificationRecipient().notNull(),
    role: projectRole(),
    groupId: uuid().references(() => groups.id, { onDelete: 'cascade' }),
    userId: uuid().references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('notification_scheme_rules_scheme_idx').on(table.schemeId, table.event),
    check(
      'notification_scheme_rules_one_target',
      sql`(recipient = 'role') = (role is not null)
        and (recipient = 'group') = (group_id is not null)
        and (recipient = 'user') = (user_id is not null)`,
    ),
  ],
);

/** Issue security schemes (TL-13, E-94): levels that limit who sees an issue. */
export const securitySchemes = pgTable(
  'security_schemes',
  {
    id: uuid().primaryKey(),
    name: text().notNull(),
    description: text().notNull().default(''),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('security_schemes_name_unique').on(table.name)],
);

export const securityLevels = pgTable(
  'security_levels',
  {
    id: uuid().primaryKey(),
    schemeId: uuid()
      .notNull()
      .references(() => securitySchemes.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text().notNull().default(''),
    position: integer().notNull(),
    /** New issues of the scheme's projects get this level unless they choose another. */
    isDefault: boolean().notNull().default(false),
  },
  (table) => [index('security_levels_scheme_idx').on(table.schemeId)],
);

export const securityLevelGrants = pgTable(
  'security_level_grants',
  {
    id: uuid().primaryKey(),
    levelId: uuid()
      .notNull()
      .references(() => securityLevels.id, { onDelete: 'cascade' }),
    grantee: permissionGrantee().notNull(),
    role: projectRole(),
    groupId: uuid().references(() => groups.id, { onDelete: 'cascade' }),
    userId: uuid().references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('security_level_grants_level_idx').on(table.levelId),
    check(
      'security_level_grants_one_grantee',
      sql`(grantee = 'role') = (role is not null)
        and (grantee = 'group') = (group_id is not null)
        and (grantee = 'user') = (user_id is not null)`,
    ),
  ],
);

export const permissionSchemeGrants = pgTable(
  'permission_scheme_grants',
  {
    id: uuid().primaryKey(),
    schemeId: uuid()
      .notNull()
      .references(() => permissionSchemes.id, { onDelete: 'cascade' }),
    permission: text().notNull(),
    grantee: permissionGrantee().notNull(),
    role: projectRole(),
    groupId: uuid().references(() => groups.id, { onDelete: 'cascade' }),
    userId: uuid().references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('permission_scheme_grants_scheme_idx').on(table.schemeId, table.permission),
    // Only the existing enum values: a new value cannot be used in its own migration.
    check(
      'permission_scheme_grants_one_grantee',
      sql`(grantee = 'role') = (role is not null)
        and (grantee = 'group') = (group_id is not null)
        and (grantee = 'user') = (user_id is not null)`,
    ),
  ],
);

export const issues = pgTable(
  'issues',
  {
    id: uuid().primaryKey(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id),
    number: integer().notNull(),
    key: text().notNull(),
    issueTypeId: uuid()
      .notNull()
      .references(() => issueTypes.id),
    statusId: uuid()
      .notNull()
      .references(() => statuses.id),
    workflowVersionId: uuid()
      .notNull()
      .references(() => workflowVersions.id),
    resolutionId: uuid().references(() => resolutions.id),
    /** Only people the level grants see the issue (TL-13, E-94); null: as browse allows. */
    securityLevelId: uuid().references((): AnyPgColumn => securityLevels.id, {
      onDelete: 'set null',
    }),
    priorityId: uuid()
      .notNull()
      .references(() => priorities.id),
    summary: text().notNull(),
    /** Rich text as a ProseMirror document. */
    description: jsonb(),
    /** Plain text of the description, for search and previews. */
    descriptionText: text().notNull().default(''),
    assigneeId: uuid().references(() => users.id, { onDelete: 'set null' }),
    reporterId: uuid().references(() => users.id, { onDelete: 'set null' }),
    parentId: uuid(),
    labels: text().array().notNull().default(sql`'{}'::text[]`),
    storyPoints: numeric({ precision: 6, scale: 1, mode: 'number' }),
    /** Planned start, for the timeline (E-68). */
    startDate: date({ mode: 'string' }),
    dueDate: date({ mode: 'string' }),
    originalEstimateSeconds: integer(),
    remainingEstimateSeconds: integer(),
    timeSpentSeconds: integer().notNull().default(0),
    /** Custom field values by field id (E-50). */
    customFields: jsonb().notNull().default({}),
    /** Summary (weight A) and description (weight B) for TQL full-text search. */
    searchVector: tsvector()
      .notNull()
      .generatedAlwaysAs(
        sql.raw(`${searchVector('summary', 'A')} || ${searchVector('description_text', 'B')}`),
      ),
    /** Global ordering across boards and backlogs (fractional index). */
    rank: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp({ withTimezone: true }),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    uniqueIndex('issues_key_unique').on(table.key),
    uniqueIndex('issues_project_number_unique').on(table.projectId, table.number),
    index('issues_project_idx').on(table.projectId),
    index('issues_status_idx').on(table.statusId),
    index('issues_assignee_idx').on(table.assigneeId),
    index('issues_parent_idx').on(table.parentId),
    index('issues_rank_idx').on(table.rank),
    index('issues_labels_idx').using('gin', table.labels),
    index('issues_custom_fields_idx').using('gin', table.customFields),
    index('issues_search_idx').using('gin', table.searchVector),
    index('issues_created_idx').on(table.createdAt),
    index('issues_updated_idx').on(table.updatedAt),
  ],
);

/** One change event on an issue (who, when, through what); its field changes are the items. */
export const issueChangeGroups = pgTable(
  'issue_change_groups',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    authorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    via: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('issue_change_groups_issue_idx').on(table.issueId, table.createdAt)],
);

export const issueChangeItems = pgTable(
  'issue_change_items',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    groupId: bigint({ mode: 'number' })
      .notNull()
      .references(() => issueChangeGroups.id, { onDelete: 'cascade' }),
    field: text().notNull(),
    fromValue: text(),
    fromDisplay: text(),
    toValue: text(),
    toDisplay: text(),
  },
  (table) => [
    index('issue_change_items_group_idx').on(table.groupId),
    index('issue_change_items_field_idx').on(table.field),
  ],
);

export const issueComments = pgTable(
  'issue_comments',
  {
    id: uuid().primaryKey(),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    authorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    body: jsonb().notNull(),
    bodyText: text().notNull(),
    searchVector: tsvector()
      .notNull()
      .generatedAlwaysAs(sql.raw(searchVector('body_text', 'A'))),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index('issue_comments_issue_idx').on(table.issueId, table.createdAt),
    index('issue_comments_search_idx').using('gin', table.searchVector),
  ],
);

export const issueWatchers = pgTable(
  'issue_watchers',
  {
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.issueId, table.userId] }),
    index('issue_watchers_user_idx').on(table.userId),
  ],
);

/** Parts of a project, e.g. "Backend" (T-PRJ-06); the default assignee applies on creation (E-40). */
export const projectComponents = pgTable(
  'project_components',
  {
    id: uuid().primaryKey(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text().notNull().default(''),
    leadId: uuid().references(() => users.id, { onDelete: 'set null' }),
    defaultAssigneeId: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('project_components_name_unique').on(table.projectId, sql`lower(${table.name})`),
  ],
);

export const issueComponents = pgTable(
  'issue_components',
  {
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    componentId: uuid()
      .notNull()
      .references(() => projectComponents.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.issueId, table.componentId] }),
    index('issue_components_component_idx').on(table.componentId),
  ],
);

/** Versions of a project (T-REL-01, E-57); archived ones stay on issues but leave pickers. */
export const projectVersions = pgTable(
  'project_versions',
  {
    id: uuid().primaryKey(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text().notNull().default(''),
    startDate: date({ mode: 'string' }),
    releaseDate: date({ mode: 'string' }),
    released: boolean().notNull().default(false),
    archived: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('project_versions_name_unique').on(table.projectId, sql`lower(${table.name})`),
  ],
);

export const versionKind = pgEnum('version_kind', ['fix', 'affects']);

/** Fix and affects versions of issues, in one table (E-57). */
export const issueVersions = pgTable(
  'issue_versions',
  {
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    versionId: uuid()
      .notNull()
      .references(() => projectVersions.id, { onDelete: 'cascade' }),
    kind: versionKind().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.issueId, table.versionId, table.kind] }),
    index('issue_versions_version_idx').on(table.versionId, table.kind),
  ],
);

/** Global link types with a name per direction, e.g. "blocks" / "is blocked by" (E-41). */
export const issueLinkTypes = pgTable('issue_link_types', {
  id: uuid().primaryKey(),
  key: text().notNull().unique(),
  name: text().notNull(),
  outward: text().notNull(),
  inward: text().notNull(),
  builtIn: boolean().notNull().default(false),
});

/** One link between two issues, stored once and shown from both sides. */
export const issueLinks = pgTable(
  'issue_links',
  {
    id: uuid().primaryKey(),
    typeId: uuid()
      .notNull()
      .references(() => issueLinkTypes.id),
    sourceId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    targetId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    createdById: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('issue_links_unique').on(table.typeId, table.sourceId, table.targetId),
    index('issue_links_source_idx').on(table.sourceId),
    index('issue_links_target_idx').on(table.targetId),
    check('issue_links_not_self', sql`${table.sourceId} <> ${table.targetId}`),
  ],
);

/** Files attached to an issue (T-ISS-06); contents live in the file store (E-43). */
export const issueAttachments = pgTable(
  'issue_attachments',
  {
    id: uuid().primaryKey(),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    authorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    fileName: text().notNull(),
    /** Detected from the content for images and PDFs, otherwise as declared by the client. */
    contentType: text().notNull(),
    size: integer().notNull(),
    sha256: text().notNull(),
    /** A raster image recognised by its magic bytes; only these are ever shown inline. */
    image: boolean().notNull().default(false),
    storageKey: text().notNull().unique(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('issue_attachments_issue_idx').on(table.issueId, table.createdAt)],
);

/** Work logged on an issue (T-TIM-02, E-47); the issue keeps the sum in timeSpentSeconds. */
export const issueWorklogs = pgTable(
  'issue_worklogs',
  {
    id: uuid().primaryKey(),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    authorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    /** When the work was done. */
    startedAt: timestamp({ withTimezone: true }).notNull(),
    timeSpentSeconds: integer().notNull(),
    comment: text().notNull().default(''),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('issue_worklogs_issue_idx').on(table.issueId, table.startedAt),
    index('issue_worklogs_author_idx').on(table.authorId, table.startedAt),
    check('issue_worklogs_positive', sql`${table.timeSpentSeconds} > 0`),
  ],
);
