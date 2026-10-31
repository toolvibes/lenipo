import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity.js';
import { issues, projects } from './tracking.js';

/** Automation rules (TL-22, E-103); trigger and components are JSON checked by the shared schema. */
export const automationRules = pgTable(
  'automation_rules',
  {
    id: uuid().primaryKey(),
    /** Null for global rules. */
    projectId: uuid().references(() => projects.id, { onDelete: 'cascade' }),
    ownerId: uuid().references(() => users.id, { onDelete: 'set null' }),
    name: text().notNull(),
    description: text().notNull().default(''),
    enabled: boolean().notNull().default(true),
    trigger: jsonb().notNull(),
    components: jsonb().notNull().default([]),
    allowSelfTrigger: boolean().notNull().default(false),
    /** Secret of the incoming webhook address. */
    webhookToken: text(),
    disabledReason: text(),
    /** The last minute a schedule ran, so a minute never runs twice. */
    lastScheduledAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('automation_rules_project_idx').on(table.projectId)],
);

/** Runs waiting for the worker: one per rule and issue (or without an issue). */
export const automationQueue = pgTable('automation_queue', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  ruleId: uuid()
    .notNull()
    .references(() => automationRules.id, { onDelete: 'cascade' }),
  issueId: uuid().references(() => issues.id, { onDelete: 'cascade' }),
  initiatorId: uuid().references(() => users.id, { onDelete: 'set null' }),
  /** How many rules led here; stopped at 10. */
  depth: integer().notNull().default(1),
  /** What triggered it, for the log and smart values (sprint, version, webhook data). */
  trigger: text().notNull(),
  data: jsonb().notNull().default({}),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** The audit log of every run, kept 90 days. */
export const automationRuns = pgTable(
  'automation_runs',
  {
    id: uuid().primaryKey(),
    ruleId: uuid()
      .notNull()
      .references(() => automationRules.id, { onDelete: 'cascade' }),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    durationMs: integer().notNull().default(0),
    /** success, no-match, error, loop or throttled. */
    status: text().notNull(),
    trigger: text().notNull(),
    issueKey: text(),
    log: jsonb().notNull().default([]),
  },
  (table) => [index('automation_runs_rule_idx').on(table.ruleId, table.startedAt)],
);
