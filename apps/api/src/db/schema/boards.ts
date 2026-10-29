import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { issues, projects, statuses } from './tracking.js';

export const boardType = pgEnum('board_type', ['kanban', 'scrum']);
export const swimlaneMode = pgEnum('swimlane_mode', ['none', 'epic', 'assignee']);
export const sprintState = pgEnum('sprint_state', ['future', 'active', 'closed']);
export const estimationField = pgEnum('estimation_field', [
  'storyPoints',
  'originalEstimate',
  'issueCount',
]);

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
    /** Scrum: what the backlog and the reports add up (T-SPR-08). */
    estimation: estimationField().notNull().default('storyPoints'),
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

/** Sprints of a Scrum board (T-SPR, E-55). */
export const sprints = pgTable(
  'sprints',
  {
    id: uuid().primaryKey(),
    boardId: uuid()
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    goal: text().notNull().default(''),
    state: sprintState().notNull().default('future'),
    /** Planned dates; startedAt and completedAt are the real moments. */
    startDate: date({ mode: 'string' }),
    endDate: date({ mode: 'string' }),
    startedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    /** How the board estimated when the sprint started, for its reports. */
    estimation: estimationField(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('sprints_board_idx').on(table.boardId, table.state)],
);

/**
 * Which issues were in a sprint and when (E-55). An issue has at most one row without
 * removedAt in a sprint that is not closed; closed sprints keep their rows.
 */
export const sprintIssues = pgTable(
  'sprint_issues',
  {
    id: uuid().primaryKey(),
    sprintId: uuid()
      .notNull()
      .references(() => sprints.id, { onDelete: 'cascade' }),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    addedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp({ withTimezone: true }),
    /** Added while the sprint was running: scope change (T-SPR-10). */
    addedAfterStart: boolean().notNull().default(false),
    estimateAtStart: numeric({ precision: 12, scale: 1, mode: 'number' }),
    estimateAtCompletion: numeric({ precision: 12, scale: 1, mode: 'number' }),
    /** Set when the sprint closes: done at that moment or not. */
    completed: boolean(),
  },
  (table) => [
    index('sprint_issues_sprint_idx').on(table.sprintId),
    index('sprint_issues_issue_idx').on(table.issueId),
  ],
);
