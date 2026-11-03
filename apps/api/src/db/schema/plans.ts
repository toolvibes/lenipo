import { date, jsonb, pgTable, primaryKey, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './identity.js';
import { issues, projects } from './tracking.js';

/** A cross-project plan (T-RDM-03, TL-46, E-136). */
export const plans = pgTable('plans', {
  id: uuid().primaryKey(),
  name: text().notNull(),
  description: text().notNull().default(''),
  /** Narrows the issues of the plan's projects; empty for all. */
  tql: text().notNull().default(''),
  ownerId: uuid().references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const planProjects = pgTable(
  'plan_projects',
  {
    planId: uuid()
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    position: real().notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.planId, table.projectId] })],
);

/** Story points a project's team can take on in a month. */
export const planCapacities = pgTable(
  'plan_capacities',
  {
    planId: uuid()
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    /** First day of the month. */
    month: date().notNull(),
    points: real().notNull(),
  },
  (table) => [primaryKey({ columns: [table.planId, table.projectId, table.month] })],
);

/** A what-if scenario of a plan (T-RDM-04). */
export const planScenarios = pgTable('plan_scenarios', {
  id: uuid().primaryKey(),
  planId: uuid()
    .notNull()
    .references(() => plans.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  createdById: uuid().references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** A scenario's change to one issue; `change` holds only the fields it changes. */
export const planScenarioChanges = pgTable(
  'plan_scenario_changes',
  {
    scenarioId: uuid()
      .notNull()
      .references(() => planScenarios.id, { onDelete: 'cascade' }),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    change: jsonb().notNull(),
    /** The issue's last update when the change was made, to notice later edits. */
    baseUpdatedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.scenarioId, table.issueId] })],
);
