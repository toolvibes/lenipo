import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity.js';

export const favouriteKind = pgEnum('favourite_kind', [
  'project',
  'filter',
  'space',
  'page',
  'board',
  'dashboard',
]);

/**
 * Starred items of a person for every kind (P-GEN-05, E-46). No foreign key to the target,
 * since targets live in different tables; deleted or hidden targets are skipped when read.
 */
export const favourites = pgTable(
  'favourites',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: favouriteKind().notNull(),
    targetId: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.kind, table.targetId] }),
    index('favourites_target_idx').on(table.kind, table.targetId),
  ],
);

export const recentKind = pgEnum('recent_kind', ['issue', 'project', 'space', 'page', 'board']);

/** What a person opened in the web app, newest first; trimmed to 50 per person (E-46). */
export const recentItems = pgTable(
  'recent_items',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: recentKind().notNull(),
    targetId: uuid().notNull(),
    viewedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.kind, table.targetId] }),
    index('recent_items_user_idx').on(table.userId, table.viewedAt),
  ],
);

/** Settings a person makes in the web app, one JSON value per key (e.g. 'issue-columns', E-48). */
export const userPreferences = pgTable(
  'user_preferences',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text().notNull(),
    value: jsonb().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.key] })],
);
