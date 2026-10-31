import { index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { groups, users } from './identity.js';
import { filterShareType } from './search.js';
import { projects } from './tracking.js';

/** Personal and shared dashboards (TL-20, E-101): the owner edits, shares grant viewing. */
export const dashboards = pgTable(
  'dashboards',
  {
    id: uuid().primaryKey(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text().notNull().default(''),
    /** one, two, wide-left or three columns. */
    layout: text().notNull().default('two'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('dashboards_owner_idx').on(table.ownerId)],
);

/** A gadget in a column; its config is a GadgetConfig from the shared package. */
export const dashboardGadgets = pgTable(
  'dashboard_gadgets',
  {
    id: uuid().primaryKey(),
    dashboardId: uuid()
      .notNull()
      .references(() => dashboards.id, { onDelete: 'cascade' }),
    column: integer().notNull(),
    position: integer().notNull(),
    title: text().notNull().default(''),
    config: jsonb().notNull(),
  },
  (table) => [index('dashboard_gadgets_dashboard_idx').on(table.dashboardId)],
);

/** Who may view a dashboard besides its owner; the same targets as filter shares (E-37). */
export const dashboardShares = pgTable(
  'dashboard_shares',
  {
    id: uuid().primaryKey(),
    dashboardId: uuid()
      .notNull()
      .references(() => dashboards.id, { onDelete: 'cascade' }),
    type: filterShareType().notNull(),
    userId: uuid().references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid().references(() => groups.id, { onDelete: 'cascade' }),
    projectId: uuid().references(() => projects.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('dashboard_shares_dashboard_idx').on(table.dashboardId),
    unique('dashboard_shares_unique')
      .on(table.dashboardId, table.type, table.userId, table.groupId, table.projectId)
      .nullsNotDistinct(),
  ],
);

/** A person's chosen start page instead of the usual home. */
export const dashboardHomes = pgTable('dashboard_homes', {
  userId: uuid()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  dashboardId: uuid()
    .notNull()
    .references(() => dashboards.id, { onDelete: 'cascade' }),
});
