import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { groups, users } from './identity.js';
import { issues, projects, searchVector, tsvector } from './tracking.js';

export const spaceRole = pgEnum('space_role', [
  'administrators',
  'editors',
  'commenters',
  'viewers',
  // Approve page versions (TL-51, E-135); new enum values go last.
  'approvers',
]);

/** A wiki space (W-SPC-01, E-59): a page tree with its own permissions. */
export const spaces = pgTable(
  'spaces',
  {
    id: uuid().primaryKey(),
    /** Upper-case key, e.g. DOCS. */
    key: text().notNull(),
    name: text().notNull(),
    description: text().notNull().default(''),
    /** The page shown when opening the space; set to the first page created. */
    homePageId: uuid(),
    createdById: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp({ withTimezone: true }),
    /** team, project, documentation or personal (TL-29, E-110). */
    type: text().notNull().default('team'),
    /** New page versions need approval unless the page says otherwise (TL-51, E-135). */
    approvalRequired: boolean().notNull().default(false),
    /** The tracking project this space documents; a project may have several (E-60). */
    projectId: uuid().references(() => projects.id, { onDelete: 'set null' }),
  },
  (table) => [
    uniqueIndex('spaces_key_unique').on(table.key),
    index('spaces_project_idx').on(table.projectId),
  ],
);

/** Who holds which role in a space: a single user or a whole group (W-SPC-03). */
export const spaceRoleMembers = pgTable(
  'space_role_members',
  {
    id: uuid().primaryKey(),
    spaceId: uuid()
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    role: spaceRole().notNull(),
    userId: uuid().references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid().references(() => groups.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('space_role_members_space_idx').on(table.spaceId),
    index('space_role_members_user_idx').on(table.userId),
    // Either user or group is null; nulls must count as equal for this to hold.
    unique('space_role_members_unique')
      .on(table.spaceId, table.role, table.userId, table.groupId)
      .nullsNotDistinct(),
  ],
);

/**
 * A wiki page. Its live draft is the collaborative document `page:<id>`; readers see the
 * latest row in `page_versions` (E-59). Pages without a version are drafts for editors only.
 */
export const pages = pgTable(
  'pages',
  {
    id: uuid().primaryKey(),
    spaceId: uuid()
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    parentId: uuid().references((): AnyPgColumn => pages.id, { onDelete: 'cascade' }),
    /** Fractional rank among siblings (rank.ts). */
    rank: text().notNull(),
    title: text().notNull(),
    /** Number of the latest published version; 0 while the page is a draft. */
    version: integer().notNull().default(0),
    publishedAt: timestamp({ withTimezone: true }),
    createdById: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** In the space's trash (W-PAG-13), together with the pages below it. */
    deletedAt: timestamp({ withTimezone: true }),
    /** page, or blog for posts outside the tree (TL-29, E-110). */
    kind: text().notNull().default('page'),
    /** none, draft, in-review, verified or outdated. */
    status: text().notNull().default('none'),
    /** Approval of new versions: space (as the space says), on or off (TL-51, E-135). */
    approvalMode: text().notNull().default('space'),
    ownerId: uuid().references(() => users.id, { onDelete: 'set null' }),
    statusChangedAt: timestamp({ withTimezone: true }),
    deletedById: uuid().references(() => users.id, { onDelete: 'set null' }),
    /** Free-text labels, lower case (W-PAG-08, E-65); not part of the versions. */
    labels: text().array().notNull().default(sql`'{}'::text[]`),
  },
  (table) => [
    index('pages_space_idx').on(table.spaceId),
    index('pages_parent_idx').on(table.parentId, table.rank),
    index('pages_labels_idx').using('gin', table.labels),
  ],
);

/** Immutable published versions of a page (W-PAG-04). */
export const pageVersions = pgTable(
  'page_versions',
  {
    id: uuid().primaryKey(),
    pageId: uuid()
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    number: integer().notNull(),
    title: text().notNull(),
    /** ProseMirror JSON, validated against the shared schema. */
    content: jsonb().notNull(),
    /** Plain text derived by the server, for search and previews. */
    text: text().notNull().default(''),
    /** Title and text for the global search (E-69); versions never change, so neither does this. */
    searchVector: tsvector()
      .notNull()
      .generatedAlwaysAs(sql.raw(`${searchVector('title', 'A')} || ${searchVector('text', 'B')}`)),
    authorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    comment: text().notNull().default(''),
    /** The number of the version this one restored (E-62). */
    restoredFrom: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [
    uniqueIndex('page_versions_page_number_unique').on(table.pageId, table.number),
    index('page_versions_search_idx').using('gin', table.searchVector),
  ],
);

/** Files of a page, also the source of its images (W-EDT-08, -09, E-61). */
export const pageAttachments = pgTable(
  'page_attachments',
  {
    id: uuid().primaryKey(),
    pageId: uuid()
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
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
  (table) => [index('page_attachments_page_idx').on(table.pageId, table.createdAt)],
);

/**
 * Comments on a page (W-EDT-11, -12, E-63): threads of one level. A thread with an anchor is an
 * inline comment on the quoted text of the published version; it can be resolved.
 */
export const pageComments = pgTable(
  'page_comments',
  {
    id: uuid().primaryKey(),
    pageId: uuid()
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    /** The thread this reply belongs to; null for the comment that starts a thread. */
    parentId: uuid().references((): AnyPgColumn => pageComments.id, { onDelete: 'cascade' }),
    authorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    body: jsonb().notNull(),
    bodyText: text().notNull(),
    /** For the global search (TL-3), like issue comments. */
    searchVector: tsvector()
      .notNull()
      .generatedAlwaysAs(sql.raw(searchVector('body_text', 'A'))),
    /** Quote, context and block of an inline comment (TextAnchor); null for page comments. */
    anchor: jsonb(),
    /** The quote was not found again in a later version. */
    detached: boolean().notNull().default(false),
    resolvedAt: timestamp({ withTimezone: true }),
    resolvedById: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index('page_comments_page_idx').on(table.pageId, table.createdAt),
    index('page_comments_search_idx').using('gin', table.searchVector),
    index('page_comments_parent_idx').on(table.parentId),
  ],
);

export const watchKind = pgEnum('watch_kind', ['page', 'subtree', 'space']);

/**
 * Who follows what in the wiki (W-PAG-09, E-65): one page, a page with everything below it, or
 * a whole space. `pageId` is null for space watches.
 */
export const pageWatches = pgTable(
  'page_watches',
  {
    id: uuid().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: watchKind().notNull(),
    spaceId: uuid()
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    pageId: uuid().references(() => pages.id, { onDelete: 'cascade' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('page_watches_unique')
      .on(table.userId, table.kind, table.spaceId, table.pageId)
      .nullsNotDistinct(),
    index('page_watches_page_idx').on(table.pageId),
    index('page_watches_space_idx').on(table.spaceId),
  ],
);

/**
 * Page templates (W-TPL-01, E-72): global without a space, otherwise for one space. Shipped
 * blueprints are code, not rows.
 */
export const pageTemplates = pgTable(
  'page_templates',
  {
    id: uuid().primaryKey(),
    spaceId: uuid().references(() => spaces.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text().notNull().default(''),
    /** Suggested page title; `{date}` becomes today's date. */
    title: text().notNull().default(''),
    /** ProseMirror JSON, validated against the shared schema. */
    content: jsonb().notNull(),
    createdById: uuid().references(() => users.id, { onDelete: 'set null' }),
    updatedById: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('page_templates_space_idx').on(table.spaceId)],
);

/**
 * Issues a page's latest published version refers to (W-INT-03, E-73): keys in the text
 * ("mention") and issue macros ("macro"); rebuilt on every publish and restore.
 */
export const pageIssueRefs = pgTable(
  'page_issue_refs',
  {
    pageId: uuid()
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    kind: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.pageId, table.issueId] }),
    index('page_issue_refs_issue_idx').on(table.issueId),
  ],
);

/** View or edit restriction of a page (TL-14, E-95). */
export const pageRestrictionKind = pgEnum('page_restriction_kind', ['view', 'edit']);

/**
 * Who may see or edit a page beyond the space permission (W-PAG-07, E-95): a page with entries
 * of a kind is open only to them. View entries also cover every page below; edit entries only
 * the page itself.
 */
export const pageRestrictions = pgTable(
  'page_restrictions',
  {
    id: uuid().primaryKey(),
    pageId: uuid()
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    kind: pageRestrictionKind().notNull(),
    userId: uuid().references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid().references(() => groups.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('page_restrictions_page_idx').on(table.pageId, table.kind),
    check('page_restrictions_one_target', sql`(user_id is null) <> (group_id is null)`),
  ],
);

/** The version waiting for approval, one per page; a new submission replaces it (TL-51, E-135). */
export const pageSubmissions = pgTable('page_submissions', {
  pageId: uuid()
    .primaryKey()
    .references(() => pages.id, { onDelete: 'cascade' }),
  title: text().notNull(),
  content: jsonb().notNull(),
  comment: text().notNull().default(''),
  authorId: uuid().references(() => users.id, { onDelete: 'set null' }),
  submittedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  /** Set when rejected; the submission then waits for the author's next one. */
  rejectedAt: timestamp({ withTimezone: true }),
  rejectedById: uuid().references(() => users.id, { onDelete: 'set null' }),
  rejectionComment: text(),
});

/** Who read a page on which day, kept 90 days (W-PAG-14, TL-51, E-135). */
export const pageViews = pgTable(
  'page_views',
  {
    pageId: uuid()
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    day: date().notNull(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    views: integer().notNull().default(1),
  },
  (table) => [
    primaryKey({ columns: [table.pageId, table.day, table.userId] }),
    index('page_views_day_idx').on(table.day),
  ],
);

/** Anonymous daily counts, for days older than the per-person rows. */
export const pageViewCounts = pgTable(
  'page_view_counts',
  {
    pageId: uuid()
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    day: date().notNull(),
    views: integer().notNull(),
    readers: integer().notNull(),
  },
  (table) => [primaryKey({ columns: [table.pageId, table.day] })],
);
