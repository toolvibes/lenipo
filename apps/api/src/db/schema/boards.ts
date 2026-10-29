import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { projects, statuses } from './tracking.js';

export const boardType = pgEnum('board_type', ['kanban', 'scrum']);
export const swimlaneMode = pgEnum('swimlane_mode', ['none', 'epic', 'assignee']);

/** A board: a TQL scope shown in columns, located in one project (T-BRD, E-53). */
export const boards = pgTable(
  'boards',
  {
    id: uuid().primaryKey(),
    name: text().notNull(),
    type: boardType().notNull(),
    /** The location: its administrators manage the board, its viewers see it. */
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    /** TQL conditions of the board; its order is always the global rank. */
    query: text().notNull(),
    swimlanes: swimlaneMode().notNull().default('none'),
    /** Kanban: issues in a done status disappear this many days after their last change. */
    hideDoneAfterDays: integer().default(14),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('boards_project_idx').on(table.projectId)],
);

export const boardColumns = pgTable(
  'board_columns',
  {
    id: uuid().primaryKey(),
    boardId: uuid()
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    position: integer().notNull(),
    wipMin: integer(),
    wipMax: integer(),
  },
  (table) => [index('board_columns_board_idx').on(table.boardId, table.position)],
);

/** Which statuses a column shows; a status belongs to at most one column of a board. */
export const boardColumnStatuses = pgTable(
  'board_column_statuses',
  {
    boardId: uuid()
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    columnId: uuid()
      .notNull()
      .references(() => boardColumns.id, { onDelete: 'cascade' }),
    statusId: uuid()
      .notNull()
      .references(() => statuses.id, { onDelete: 'cascade' }),
    position: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.boardId, table.statusId] }),
    index('board_column_statuses_column_idx').on(table.columnId),
  ],
);

/** Buttons above a board that narrow it with an extra TQL condition. */
export const boardQuickFilters = pgTable(
  'board_quick_filters',
  {
    id: uuid().primaryKey(),
    boardId: uuid()
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    query: text().notNull(),
    position: integer().notNull(),
  },
  (table) => [
    index('board_quick_filters_board_idx').on(table.boardId),
    uniqueIndex('board_quick_filters_name_unique').on(table.boardId, sql`lower(${table.name})`),
  ],
);
