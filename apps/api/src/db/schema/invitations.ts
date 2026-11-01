import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './identity.js';
import { projects } from './tracking.js';

/**
 * An invitation or a self-registration waiting for its link to be used (P-USR-15, TL-67,
 * E-119). Only the hash of the link's secret is stored; a link works once.
 */
export const invitations = pgTable(
  'invitations',
  {
    id: uuid().primaryKey(),
    /** invite or register. */
    kind: text().notNull(),
    email: text().notNull(),
    tokenHash: text().notNull(),
    projectId: uuid().references(() => projects.id, { onDelete: 'cascade' }),
    role: text(),
    /** The account becomes external (TL-66) and gets the linked spaces too (TL-68). */
    external: boolean().notNull().default(false),
    shareSpace: boolean().notNull().default(false),
    invitedById: uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    acceptedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    uniqueIndex('invitations_token_unique').on(table.tokenHash),
    index('invitations_project_idx').on(table.projectId),
  ],
);
