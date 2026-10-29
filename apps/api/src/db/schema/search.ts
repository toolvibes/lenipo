import { sql } from 'drizzle-orm';
import {
  index,
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
import { projects } from './tracking.js';

/** A named TQL query; only its owner edits it (decision E-37). */
export const savedFilters = pgTable(
  'saved_filters',
  {
    id: uuid().primaryKey(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text().notNull().default(''),
    query: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('saved_filters_owner_name_unique').on(table.ownerId, sql`lower(${table.name})`),
  ],
);

export const filterShareType = pgEnum('filter_share_type', [
  'user',
  'group',
  'project',
  'authenticated',
]);

/** Read access to a filter for one user, a group, the members of a project or everyone signed in. */
export const filterShares = pgTable(
  'filter_shares',
  {
    id: uuid().primaryKey(),
    filterId: uuid()
      .notNull()
      .references(() => savedFilters.id, { onDelete: 'cascade' }),
    type: filterShareType().notNull(),
    userId: uuid().references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid().references(() => groups.id, { onDelete: 'cascade' }),
    projectId: uuid().references(() => projects.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('filter_shares_filter_idx').on(table.filterId),
    unique('filter_shares_unique')
      .on(table.filterId, table.type, table.userId, table.groupId, table.projectId)
      .nullsNotDistinct(),
  ],
);

export const filterFavourites = pgTable(
  'filter_favourites',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    filterId: uuid()
      .notNull()
      .references(() => savedFilters.id, { onDelete: 'cascade' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.filterId] })],
);
