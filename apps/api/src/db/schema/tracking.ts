import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
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
const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

/** German and English stems of a text column (decision E-36). */
function searchVector(column: string, weight: 'A' | 'B') {
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
    dueDate: date({ mode: 'string' }),
    originalEstimateSeconds: integer(),
    remainingEstimateSeconds: integer(),
    timeSpentSeconds: integer().notNull().default(0),
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
