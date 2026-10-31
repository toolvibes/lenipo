import {
  bigint,
  bigserial,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity.js';

/** Instance-wide settings that admins change at runtime (as opposed to environment config). */
export const systemSettings = pgTable('system_settings', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Security-relevant and administrative events. Append-only. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    actorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    /** How the actor acted: session, token (later also mcp, automation). */
    via: text(),
    action: text().notNull(),
    targetType: text(),
    targetId: text(),
    ip: inet(),
    details: jsonb().notNull().default({}),
  },
  (table) => [
    index('audit_log_at_idx').on(table.at),
    index('audit_log_actor_idx').on(table.actorId),
  ],
);

/** Logical backups (TL-39, E-120); the ZIP lives in the file store under backups/<id>. */
export const backups = pgTable('backups', {
  id: uuid().primaryKey(),
  /** manual or scheduled */
  trigger: text().notNull(),
  /** running, done or failed */
  state: text().notNull().default('running'),
  createdById: uuid().references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp({ withTimezone: true }),
  sizeBytes: bigint({ mode: 'number' }),
  rows: integer(),
  files: integer(),
  error: text(),
});
