import { z } from 'zod';
import { IssueSummary, UserRef } from './tracking.js';

const Id = z.uuid();

export const TqlText = z.string().max(10_000);

export const SearchRequest = z
  .object({
    query: TqlText.default(''),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
  })
  .meta({ id: 'SearchRequest' });
export type SearchRequest = z.infer<typeof SearchRequest>;

export const SearchResult = z
  .object({
    issues: z.array(IssueSummary),
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })
  .meta({ id: 'SearchResult' });
export type SearchResult = z.infer<typeof SearchResult>;

export const ValueSuggestionQuery = z.object({
  field: z.string().min(1).max(50),
  prefix: z.string().max(200).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(15),
});
export type ValueSuggestionQuery = z.infer<typeof ValueSuggestionQuery>;

/** A stored value for TQL completion: `value` goes into the query, `label` is shown. */
export const ValueSuggestion = z
  .object({
    value: z.string(),
    label: z.string(),
    detail: z.string().optional(),
    /** Key of a built-in entry, so the client can show its translated name. */
    key: z.string().optional(),
  })
  .meta({ id: 'ValueSuggestion' });
export type ValueSuggestion = z.infer<typeof ValueSuggestion>;

// ---------------------------------------------------------------- saved filters

export const FilterShareInput = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('user'), userId: Id }),
    z.object({ type: z.literal('group'), groupId: Id }),
    z.object({ type: z.literal('project'), projectId: Id }),
    z.object({ type: z.literal('authenticated') }),
  ])
  .meta({ id: 'FilterShareInput' });
export type FilterShareInput = z.infer<typeof FilterShareInput>;

export const FilterShare = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('user'), user: UserRef }),
    z.object({ type: z.literal('group'), group: z.object({ id: Id, name: z.string() }) }),
    z.object({
      type: z.literal('project'),
      project: z.object({ id: Id, key: z.string(), name: z.string() }),
    }),
    z.object({ type: z.literal('authenticated') }),
  ])
  .meta({ id: 'FilterShare' });
export type FilterShare = z.infer<typeof FilterShare>;

export const SavedFilter = z
  .object({
    id: Id,
    name: z.string(),
    description: z.string(),
    query: z.string(),
    owner: UserRef,
    shares: z.array(FilterShare),
    favourite: z.boolean(),
    /** True for the owner, the only one who may change or delete it. */
    editable: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'SavedFilter' });
export type SavedFilter = z.infer<typeof SavedFilter>;

const FilterName = z.string().trim().min(1).max(100);

export const CreateFilterRequest = z
  .object({
    name: FilterName,
    description: z.string().max(1_000).default(''),
    query: TqlText,
    shares: z.array(FilterShareInput).max(50).default([]),
    favourite: z.boolean().default(true),
  })
  .meta({ id: 'CreateFilterRequest' });
export type CreateFilterRequest = z.infer<typeof CreateFilterRequest>;

export const UpdateFilterRequest = z
  .object({
    name: FilterName,
    description: z.string().max(1_000),
    query: TqlText,
    shares: z.array(FilterShareInput).max(50),
  })
  .partial()
  .meta({ id: 'UpdateFilterRequest' });
export type UpdateFilterRequest = z.infer<typeof UpdateFilterRequest>;

export const FilterScope = z.enum(['visible', 'mine', 'favourites', 'shared']);
export type FilterScope = z.infer<typeof FilterScope>;

export const FilterListQuery = z.object({ scope: FilterScope.default('visible') });
export type FilterListQuery = z.infer<typeof FilterListQuery>;
