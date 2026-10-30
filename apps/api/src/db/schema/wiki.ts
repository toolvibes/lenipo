import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { groups, users } from './identity.js';
import { projects, searchVector, tsvector } from './tracking.js';

export const spaceRole = pgEnum('space_role', [
  'administrators',
  'editors',
  'commenters',
  'viewers',
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
