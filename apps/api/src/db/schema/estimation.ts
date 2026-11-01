import { pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './identity.js';
import { issues } from './tracking.js';

/** One open planning poker round per issue (TL-51, E-134); revealed once someone uncovers it. */
export const estimationRounds = pgTable('estimation_rounds', {
  issueId: uuid()
    .primaryKey()
    .references(() => issues.id, { onDelete: 'cascade' }),
  startedById: uuid().references(() => users.id, { onDelete: 'set null' }),
  startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  revealedAt: timestamp({ withTimezone: true }),
});

/** A person's card in the round; changing it replaces the value. */
export const estimationVotes = pgTable(
  'estimation_votes',
  {
    issueId: uuid()
      .notNull()
      .references(() => estimationRounds.issueId, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    value: text().notNull(),
    votedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.issueId, table.userId] })],
);
