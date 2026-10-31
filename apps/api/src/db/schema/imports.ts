import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity.js';

/** An import from Jira or Confluence, run by the worker (TL-35, E-118). */
export const importJobs = pgTable('import_jobs', {
  id: uuid().primaryKey(),
  source: text().notNull(),
  dryRun: boolean().notNull(),
  label: text().notNull(),
  /** Connection and choices; the secret is removed when the job ends. */
  params: jsonb().$type<Record<string, unknown>>().notNull(),
  state: text().notNull().default('pending'),
  progress: text().notNull().default(''),
  log: text().array().notNull().default([]),
  report: jsonb(),
  createdById: uuid().references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp({ withTimezone: true }),
  finishedAt: timestamp({ withTimezone: true }),
});

/** Which Tasklore object came from which source object, so a second run only adds new ones. */
export const importMappings = pgTable(
  'import_mappings',
  {
    /** E.g. "jira:https://jira.example.org". */
    origin: text().notNull(),
    /** issue, comment, worklog, attachment, user, version, component, sprint, board, link, page … */
    kind: text().notNull(),
    sourceId: text().notNull(),
    targetId: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('import_mappings_unique').on(table.origin, table.kind, table.sourceId),
    index('import_mappings_target_idx').on(table.targetId),
  ],
);
