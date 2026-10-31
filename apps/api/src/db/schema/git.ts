import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './identity.js';
import { issues } from './tracking.js';

/** Git hosting sending webhooks (D-GIT-01, E-116). */
export const gitConnections = pgTable('git_connections', {
  id: uuid().primaryKey(),
  name: text().notNull(),
  provider: text().notNull(),
  /** Shared secret: HMAC key for GitHub and Gitea, token for GitLab; needed in plain text. */
  secret: text().notNull(),
  createdById: uuid().references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  lastEventAt: timestamp({ withTimezone: true }),
  lastError: text(),
});

/**
 * A branch, commit, pull request or build that names an issue (D-GIT-02/04); one row per
 * issue and object, updated as the object changes. Raw payloads are not kept.
 */
export const developmentLinks = pgTable(
  'development_links',
  {
    id: uuid().primaryKey(),
    connectionId: uuid()
      .notNull()
      .references(() => gitConnections.id, { onDelete: 'cascade' }),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    /** branch, commit, pull_request or build. */
    kind: text().notNull(),
    /** Unique per connection and kind, e.g. "org/repo#12" or a commit SHA. */
    externalId: text().notNull(),
    repository: text().notNull(),
    title: text().notNull(),
    url: text(),
    /** open, draft, merged, closed; pending, success, failure; empty for others. */
    state: text().notNull().default(''),
    author: text(),
    /** Kind-specific: review state, smart commit results, branch of a build. */
    data: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('development_links_unique').on(
      table.connectionId,
      table.kind,
      table.externalId,
      table.issueId,
    ),
    index('development_links_issue_idx').on(table.issueId),
  ],
);
