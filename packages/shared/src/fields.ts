import { z } from 'zod';
import { Id } from './identity.js';

/** Custom field types of Phase 1 (T-FLD-01, E-50); the same names as in `@tasklore/tql`. */
export const CustomFieldType = z.enum([
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
export type CustomFieldType = z.infer<typeof CustomFieldType>;

export const CustomFieldOption = z
  .object({ id: Id, value: z.string(), archived: z.boolean() })
  .meta({ id: 'CustomFieldOption' });
export type CustomFieldOption = z.infer<typeof CustomFieldOption>;

export const CustomField = z
  .object({
    id: Id,
    /** For `cf[n]` in TQL. */
    number: z.number().int(),
    name: z.string(),
    description: z.string(),
    type: CustomFieldType,
    /** Choices of select fields, archived ones included so old values still show. */
    options: z.array(CustomFieldOption),
    archived: z.boolean(),
  })
  .meta({ id: 'CustomField' });
export type CustomField = z.infer<typeof CustomField>;

const FieldName = z.string().trim().min(1).max(60);
const OptionValue = z.string().trim().min(1).max(100);

export const CreateCustomFieldRequest = z
  .object({
    name: FieldName,
    description: z.string().max(500).default(''),
    type: CustomFieldType,
    options: z.array(OptionValue).max(200).default([]),
  })
  .meta({ id: 'CreateCustomFieldRequest' });
export type CreateCustomFieldRequest = z.infer<typeof CreateCustomFieldRequest>;

export const UpdateCustomFieldRequest = z
  .object({
    name: FieldName,
    description: z.string().max(500),
    /** The full list of choices: entries with an id rename or archive, without add. */
    options: z
      .array(
        z.object({ id: Id.optional(), value: OptionValue, archived: z.boolean().default(false) }),
      )
      .max(200),
    archived: z.boolean(),
  })
  .partial()
  .meta({ id: 'UpdateCustomFieldRequest' });
export type UpdateCustomFieldRequest = z.infer<typeof UpdateCustomFieldRequest>;

export const ProjectCustomFieldsRequest = z
  .object({ fieldIds: z.array(Id).max(200) })
  .meta({ id: 'ProjectCustomFieldsRequest' });
export type ProjectCustomFieldsRequest = z.infer<typeof ProjectCustomFieldsRequest>;

/**
 * A value as written: text and URLs as strings, numbers, dates as `YYYY-MM-DD`, date and time
 * as ISO timestamp, selects as option ids, people as user ids, checkboxes as booleans.
 * null clears the field.
 */
export const CustomFieldInput = z.union([
  z.string().max(10_000),
  z.number(),
  z.boolean(),
  z.array(Id).max(100),
  z.null(),
]);
export type CustomFieldInput = z.infer<typeof CustomFieldInput>;

/** Values to change, by field id. */
export const CustomFieldInputs = z.record(Id, CustomFieldInput);
export type CustomFieldInputs = z.infer<typeof CustomFieldInputs>;

/**
 * A stored value as the API shows it: option ids and user ids come with their names.
 * Fields without a value are left out.
 */
export const CustomFieldValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.object({ id: Id, value: z.string() }),
  z.array(z.object({ id: Id, value: z.string() })),
  z.object({ id: Id, displayName: z.string() }),
]);
export type CustomFieldValue = z.infer<typeof CustomFieldValue>;
