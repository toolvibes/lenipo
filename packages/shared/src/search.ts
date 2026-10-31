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

// ---------------------------------------------------------------- global search (E-69)

export const EVERYTHING_TYPES = ['issue', 'page', 'project', 'space'] as const;
export const EverythingType = z.enum(EVERYTHING_TYPES);
export type EverythingType = z.infer<typeof EverythingType>;

export const EverythingQuery = z
  .object({
    /** Words, "phrases", OR and -word; the last word also matches as a prefix. */
    q: z.string().trim().min(1).max(200),
    /** Only this kind of result; counts always cover all kinds. */
    type: EverythingType.optional(),
    /** Only this project and the Lore spaces linked to it. */
    project: z.string().trim().min(1).max(10).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .meta({ id: 'EverythingQuery' });
export type EverythingQuery = z.infer<typeof EverythingQuery>;

/** Text with the matched words marked, as plain segments (no HTML). */
export const Snippet = z
  .array(z.object({ text: z.string(), hit: z.boolean() }))
  .meta({ id: 'Snippet' });
export type Snippet = z.infer<typeof Snippet>;

/**
 * Where a result matched when not in its own title or text (TL-3): a comment, with its author
 * and the marked words, or the file name of an attachment.
 */
export const SearchMatch = z
  .object({
    in: z.enum(['comment', 'attachment']),
    author: z.string().nullable(),
    snippet: Snippet,
  })
  .meta({ id: 'SearchMatch' });
export type SearchMatch = z.infer<typeof SearchMatch>;

export const IssueHit = IssueSummary.extend({ match: SearchMatch.optional() }).meta({
  id: 'IssueHit',
});
export type IssueHit = z.infer<typeof IssueHit>;

export const PageHit = z
  .object({
    id: Id,
    title: z.string(),
    space: z.object({ key: z.string(), name: z.string() }),
    parentTitle: z.string().nullable(),
    publishedAt: z.iso.datetime().nullable(),
    snippet: Snippet,
    match: SearchMatch.optional(),
  })
  .meta({ id: 'PageHit' });
export type PageHit = z.infer<typeof PageHit>;

export const EverythingResult = z
  .object({
    counts: z.object({
      issue: z.number().int(),
      page: z.number().int(),
      project: z.number().int(),
      space: z.number().int(),
    }),
    issues: z.array(IssueHit),
    pages: z.array(PageHit),
    projects: z.array(z.object({ key: z.string(), name: z.string(), description: z.string() })),
    spaces: z.array(z.object({ key: z.string(), name: z.string(), description: z.string() })),
  })
  .meta({ id: 'EverythingResult' });
export type EverythingResult = z.infer<typeof EverythingResult>;

/** How often a filter's results are e-mailed (T-QRY-07, E-112). */
export const SUBSCRIPTION_SCHEDULES = ['daily', 'weekdays', 'weekly'] as const;
export const SubscriptionSchedule = z
  .enum(SUBSCRIPTION_SCHEDULES)
  .meta({ id: 'SubscriptionSchedule' });
export type SubscriptionSchedule = z.infer<typeof SubscriptionSchedule>;

/** At most this many issues are listed in a subscription e-mail. */
export const SUBSCRIPTION_ISSUE_LIMIT = 50;

export const FilterSubscription = z
  .object({
    id: z.uuid(),
    filterId: z.uuid(),
    schedule: SubscriptionSchedule,
    /** 1 = Monday … 7 = Sunday; used by weekly schedules. */
    weekday: z.number().int().min(1).max(7),
    /** Hour in the subscriber's time zone. */
    hour: z.number().int().min(0).max(23),
    onlyWithResults: z.boolean(),
    subscriber: z.object({ id: z.uuid(), displayName: z.string() }),
    /** Every member of this group gets the mail with what they may see; null: the subscriber. */
    group: z.object({ id: z.uuid(), name: z.string() }).nullable(),
    lastSentAt: z.iso.datetime().nullable(),
    canDelete: z.boolean(),
  })
  .meta({ id: 'FilterSubscription' });
export type FilterSubscription = z.infer<typeof FilterSubscription>;

export const CreateFilterSubscription = z
  .object({
    schedule: SubscriptionSchedule,
    weekday: z.number().int().min(1).max(7).default(1),
    hour: z.number().int().min(0).max(23).default(8),
    onlyWithResults: z.boolean().default(true),
    /** Only the filter's owner, and only for a group they belong to. */
    groupId: z.uuid().optional(),
  })
  .meta({ id: 'CreateFilterSubscription' });
export type CreateFilterSubscription = z.infer<typeof CreateFilterSubscription>;
