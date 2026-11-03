import { integer, jsonb, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { groups, users } from './identity.js';
import { issueTypes, projects } from './tracking.js';

/**
 * A project run as a service desk (TL-47, E-137): who may file requests, SLA targets and the
 * business hours they count in.
 */
export const serviceDesks = pgTable('service_desks', {
  projectId: uuid()
    .primaryKey()
    .references(() => projects.id, { onDelete: 'cascade' }),
  /** list: only the customers below; everyone: everyone signed in. */
  customerAccess: text().notNull().default('list'),
  intro: text().notNull().default(''),
  /** Hours to first response and to resolution, by priority key. */
  firstResponseHours: jsonb().notNull().default({}),
  resolutionHours: jsonb().notNull().default({}),
  /** Statuses in which the SLA clocks pause, waiting for the customer. */
  pauseStatusIds: uuid().array().notNull().default([]),
  timeZone: text().notNull().default('Europe/Berlin'),
  /** First working hour of the day; the day lasts the instance's hours per day. */
  dayStartHour: integer().notNull().default(9),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** People and groups who may file requests when access is by list. */
export const serviceCustomers = pgTable('service_customers', {
  id: uuid().primaryKey(),
  projectId: uuid()
    .notNull()
    .references(() => serviceDesks.projectId, { onDelete: 'cascade' }),
  userId: uuid().references(() => users.id, { onDelete: 'cascade' }),
  groupId: uuid().references(() => groups.id, { onDelete: 'cascade' }),
});

/** What customers can ask for, each with its form (TL-47, E-137). */
export const requestTypes = pgTable('request_types', {
  id: uuid().primaryKey(),
  projectId: uuid()
    .notNull()
    .references(() => serviceDesks.projectId, { onDelete: 'cascade' }),
  name: text().notNull(),
  description: text().notNull().default(''),
  issueTypeId: uuid()
    .notNull()
    .references(() => issueTypes.id),
  /** Optional fields the form asks: priority, dueDate, or custom field ids. */
  fields: text().array().notNull().default([]),
  position: real().notNull().default(0),
});
