import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { projects } from './tracking.js';

export const customFieldType = pgEnum('custom_field_type', [
  'text',
  'textarea',
  'number',
  'date',
  'datetime',
  'select',
  'multiselect',
  'user',
  'checkbox',
  'url',
]);

/** Instance-wide custom fields (T-FLD-01, E-50); archived instead of deleted. */
export const customFields = pgTable(
  'custom_fields',
  {
    id: uuid().primaryKey(),
    /** Running number for `cf[n]` in TQL. */
    number: integer().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    description: text().notNull().default(''),
    type: customFieldType().notNull(),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('custom_fields_name_unique').on(sql`lower(${table.name})`),
    uniqueIndex('custom_fields_number_unique').on(table.number),
  ],
);

/** Choices of select fields; values keep their option id, so renaming changes no issue. */
export const customFieldOptions = pgTable(
  'custom_field_options',
  {
    id: uuid().primaryKey(),
    fieldId: uuid()
      .notNull()
      .references(() => customFields.id, { onDelete: 'cascade' }),
    value: text().notNull(),
    position: integer().notNull(),
    archived: boolean().notNull().default(false),
  },
  (table) => [
    index('custom_field_options_field_idx').on(table.fieldId),
    uniqueIndex('custom_field_options_value_unique').on(table.fieldId, sql`lower(${table.value})`),
  ],
);

/** Which projects use a field, in the order the project shows them. */
export const projectCustomFields = pgTable(
  'project_custom_fields',
  {
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    fieldId: uuid()
      .notNull()
      .references(() => customFields.id, { onDelete: 'cascade' }),
    position: integer().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.fieldId] }),
    index('project_custom_fields_field_idx').on(table.fieldId),
  ],
);
