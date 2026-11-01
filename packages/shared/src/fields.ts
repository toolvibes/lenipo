import { z } from 'zod';
import { Id } from './identity.js';

/** Custom field types of Phase 1 (T-FLD-01, E-50); the same names as in `@toolvibes/tql`. */
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
  // TL-79, E-90: several people, a group, a version of the project, free labels.
  'users',
  'group',
  'version',
  'labels',
  // TL-82, E-92: two levels of options, written as "Deutschland › Berlin".
  'cascade',
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

/**
 * A value as written: text and URLs as strings, numbers, dates as `YYYY-MM-DD`, date and time
 * as ISO timestamp, selects as option ids, people as user ids (a list for several), a group
 * or version by id, labels as a list of words, checkboxes as booleans.
 * null clears the field.
 */
export const CustomFieldInput = z.union([
  z.string().max(10_000),
  z.number(),
  z.boolean(),
  z.array(Id).max(100),
  z.array(z.string().trim().min(1).max(64)).max(30),
  z.null(),
]);
export type CustomFieldInput = z.infer<typeof CustomFieldInput>;

/** Values to change, by field id. */
export const CustomFieldInputs = z.record(Id, CustomFieldInput);
export type CustomFieldInputs = z.infer<typeof CustomFieldInputs>;

/** How a project uses one of its fields (TL-12, E-89). */
export const ProjectFieldSetting = z
  .object({
    /** Forms and the API insist on a value. */
    required: z.boolean().default(false),
    /** Not shown in the project's forms; stored values stay. */
    hidden: z.boolean().default(false),
    /** Help text instead of the field's own description; null keeps that. */
    description: z.string().trim().max(500).nullable().default(null),
    /** Context (TL-80, E-91): only for these issue types; empty means all. */
    issueTypeIds: z.array(Id).max(20).default([]),
    /** Only these of the field's options are offered; empty means all. */
    optionIds: z.array(Id).max(200).default([]),
    /** Set on create when no value is given, in the form the issue API takes. */
    defaultValue: CustomFieldInput.default(null),
    /**
     * The tab the field shows on (TL-81, E-93); tabs follow the order of their first field.
     * Without a tab the field goes to "Weitere" once the project has any tabs.
     */
    tab: z.string().trim().max(40).nullable().default(null),
  })
  .meta({ id: 'ProjectFieldSetting' });
export type ProjectFieldSetting = z.infer<typeof ProjectFieldSetting>;

export const ProjectFieldConfig = ProjectFieldSetting.extend({ fieldId: Id }).meta({
  id: 'ProjectFieldConfig',
});
export type ProjectFieldConfig = z.infer<typeof ProjectFieldConfig>;

export const ProjectCustomFieldsRequest = z
  .object({
    fieldIds: z.array(Id).max(200),
    /** By field id; fields left out are optional and shown. */
    settings: z.record(Id, ProjectFieldSetting).default({}),
  })
  .meta({ id: 'ProjectCustomFieldsRequest' });
export type ProjectCustomFieldsRequest = z.infer<typeof ProjectCustomFieldsRequest>;

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
  z.array(z.object({ id: Id, displayName: z.string() })),
  z.array(z.string()),
]);
export type CustomFieldValue = z.infer<typeof CustomFieldValue>;
