import { customType, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => 'bytea',
  toDriver: (value) => Buffer.from(value),
  fromDriver: (value) => new Uint8Array(value),
});

/**
 * Live Yjs state of collaboratively edited documents (wiki pages, issue descriptions).
 * Published versions are stored separately; this table only holds the working state.
 */
export const collabDocuments = pgTable('collab_documents', {
  name: text().primaryKey(),
  state: bytea().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * Changes that agents make to a live draft (E-74): the API queues one here and sends a
 * NOTIFY; the collab service claims it, applies it in one Yjs transaction and records the
 * outcome, which the API waits for.
 */
export const collabWrites = pgTable('collab_writes', {
  id: uuid().primaryKey(),
  document: text().notNull(),
  /** ProseMirror JSON: the whole draft, or the new content of `section`. */
  content: jsonb().notNull(),
  /** Heading text whose section is replaced; null replaces the whole draft. */
  section: text(),
  newHeading: text(),
  /** Shown to people editing the page while the change arrives. */
  actorName: text().notNull(),
  /** pending, working, done or error */
  status: text().notNull().default('pending'),
  error: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
