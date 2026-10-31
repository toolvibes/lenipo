import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity.js';
import { issues } from './tracking.js';
import { pages } from './wiki.js';

/**
 * Transactional outbox (E-44): written in the same transaction as the change, processed once by
 * the worker role. Webhooks and automation will read the same events.
 */
export const domainEvents = pgTable(
  'domain_events',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    type: text().notNull(),
    issueId: uuid().references(() => issues.id, { onDelete: 'cascade' }),
    /** Wiki events (E-63) name their page instead of an issue. */
    pageId: uuid().references(() => pages.id, { onDelete: 'cascade' }),
    actorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    payload: jsonb().notNull().default({}),
    /** Set when an automation rule caused the event, with the chain depth (TL-22, E-103). */
    automationRuleId: uuid(),
    automationDepth: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp({ withTimezone: true }),
    attempts: integer().notNull().default(0),
    lastError: text(),
  },
  (table) => [
    index('domain_events_pending_idx').on(table.id).where(sql`${table.processedAt} is null`),
  ],
);

export const notificationCategory = pgEnum('notification_category', [
  'mention',
  'assigned',
  'comment',
  'status',
  'other',
]);

/** One entry in a person's bell; also the queue for bundled notification email. */
export const notifications = pgTable(
  'notifications',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** What it is about: an issue, or a wiki page (E-63); exactly one of the two. */
    issueId: uuid().references(() => issues.id, { onDelete: 'cascade' }),
    pageId: uuid().references(() => pages.id, { onDelete: 'cascade' }),
    eventId: bigint({ mode: 'number' }).references(() => domainEvents.id, { onDelete: 'set null' }),
    category: notificationCategory().notNull(),
    actorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    /** What happened, ready to show: kind, changed fields, comment excerpt. */
    details: jsonb().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp({ withTimezone: true }),
    /** Waiting to be sent in the next bundled email. */
    emailPending: boolean().notNull().default(false),
    emailedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index('notifications_user_idx').on(table.userId, table.createdAt),
    index('notifications_email_idx')
      .on(table.userId, table.issueId, table.pageId)
      .where(sql`${table.emailPending}`),
    check('notifications_subject', sql`num_nonnulls(${table.issueId}, ${table.pageId}) = 1`),
  ],
);

/** Personal choices (P-NTF-04); a missing row means the defaults. */
export const notificationSettings = pgTable('notification_settings', {
  userId: uuid()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  emailEnabled: boolean().notNull().default(true),
  emailCategories: text()
    .array()
    .notNull()
    .default(sql`'{mention,assigned,comment,status,other}'::text[]`),
});
