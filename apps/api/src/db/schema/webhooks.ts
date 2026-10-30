import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
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
import { domainEvents } from './notifications.js';

/** An outgoing webhook managed by global administrators (D-HOOK-01, E-45). */
export const webhooks = pgTable('webhooks', {
  id: uuid().primaryKey(),
  name: text().notNull(),
  url: text().notNull(),
  /** Standard Webhooks secret, "whsec_" plus base64; needed in plain text to sign. */
  secret: text().notNull(),
  events: text().array().notNull(),
  /** Only events of these projects; empty means all projects. */
  projectIds: uuid().array().notNull(),
  /** Transitions only into these statuses; empty means all (TL-75, E-86). */
  statusIds: uuid().array().notNull().default(sql`'{}'::uuid[]`),
  enabled: boolean().notNull().default(true),
  /** Why the system switched the webhook off, e.g. after days of failures. */
  disabledReason: text(),
  /** Start of the current run of failed deliveries; null while deliveries succeed. */
  failingSince: timestamp({ withTimezone: true }),
  createdById: uuid().references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const deliveryStatus = pgEnum('webhook_delivery_status', ['pending', 'succeeded', 'failed']);

/** One message to one webhook; its id is the webhook-id header and stays the same on retries. */
export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid().primaryKey(),
    webhookId: uuid()
      .notNull()
      .references(() => webhooks.id, { onDelete: 'cascade' }),
    eventId: bigint({ mode: 'number' }).references(() => domainEvents.id, { onDelete: 'set null' }),
    type: text().notNull(),
    payload: jsonb().notNull(),
    status: deliveryStatus().notNull().default('pending'),
    attempts: integer().notNull().default(0),
    nextAttemptAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastAttemptAt: timestamp({ withTimezone: true }),
    responseStatus: integer(),
    /** Start of the response body or the error, for the delivery log. */
    responseBody: text(),
    durationMs: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('webhook_deliveries_due_idx').on(table.status, table.nextAttemptAt),
    index('webhook_deliveries_webhook_idx').on(table.webhookId, table.createdAt),
  ],
);
