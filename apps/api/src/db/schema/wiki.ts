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
import { projects } from './tracking.js';

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
  },
  (table) => [
    index('pages_space_idx').on(table.spaceId),
    index('pages_parent_idx').on(table.parentId, table.rank),
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
    authorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    comment: text().notNull().default(''),
    /** The number of the version this one restored (E-62). */
    restoredFrom: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [uniqueIndex('page_versions_page_number_unique').on(table.pageId, table.number)],
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
