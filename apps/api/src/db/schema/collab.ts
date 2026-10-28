import { customType, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

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
