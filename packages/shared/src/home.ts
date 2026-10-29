import { z } from 'zod';
import { IssueSummary, UserRef } from './tracking.js';

/** One entry of the activity stream (P-GEN-01). */
export const ActivityEntry = z
  .object({
    /** Stable for paging and React keys, e.g. "change:42" or "comment:<uuid>". */
    id: z.string(),
    kind: z.enum(['created', 'updated', 'commented']),
    actor: UserRef.nullable(),
    issue: z.object({ key: z.string(), summary: z.string() }),
    project: z.object({ key: z.string(), name: z.string() }),
    items: z.array(
      z.object({ field: z.string(), from: z.string().nullable(), to: z.string().nullable() }),
    ),
    excerpt: z.string().optional(),
    at: z.iso.datetime(),
  })
  .meta({ id: 'ActivityEntry' });
export type ActivityEntry = z.infer<typeof ActivityEntry>;

export const ActivityPage = z
  .object({
    entries: z.array(ActivityEntry),
    /** Pass as `before` for the next, older page; null at the end. */
    next: z.iso.datetime().nullable(),
  })
  .meta({ id: 'ActivityPage' });
export type ActivityPage = z.infer<typeof ActivityPage>;

export const ActivityQuery = z.object({
  /** Only this project (key). */
  project: z.string().min(1).max(20).optional(),
  /** Only this person's actions (user id). */
  user: z.uuid().optional(),
  before: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type ActivityQuery = z.infer<typeof ActivityQuery>;

export const FAVOURITE_KINDS = ['project', 'filter'] as const;
export const FavouriteKind = z.enum(FAVOURITE_KINDS).meta({ id: 'FavouriteKind' });
export type FavouriteKind = z.infer<typeof FavouriteKind>;

/** A starred item, resolved for display; items one can no longer see are left out. */
export const Favourite = z
  .object({
    kind: FavouriteKind,
    id: z.uuid(),
    /** Project key, or filter id for filters. */
    ref: z.string(),
    name: z.string(),
  })
  .meta({ id: 'Favourite' });
export type Favourite = z.infer<typeof Favourite>;

export const RECENT_KINDS = ['issue', 'project'] as const;
export const RecentKind = z.enum(RECENT_KINDS).meta({ id: 'RecentKind' });
export type RecentKind = z.infer<typeof RecentKind>;

export const RecordRecentRequest = z
  .object({ kind: RecentKind, ref: z.string().min(1).max(40) })
  .meta({ id: 'RecordRecentRequest' });
export type RecordRecentRequest = z.infer<typeof RecordRecentRequest>;

export const RecentItem = z
  .object({
    kind: RecentKind,
    /** Issue or project key. */
    ref: z.string(),
    name: z.string(),
    viewedAt: z.iso.datetime(),
    issue: IssueSummary.optional(),
  })
  .meta({ id: 'RecentItem' });
export type RecentItem = z.infer<typeof RecentItem>;

// ---------------------------------------------------------------- result columns

/**
 * Optional columns of issue result lists, named like their TQL field (T-QRY-08, E-48).
 * Key and summary are always shown.
 */
export const IssueColumn = z.enum([
  'issuetype',
  'status',
  'priority',
  'assignee',
  'reporter',
  'created',
  'updated',
  'due',
  'resolution',
  'labels',
  'component',
  'fixVersion',
  'storyPoints',
  'originalEstimate',
  'remainingEstimate',
  'timeSpent',
]);
export type IssueColumn = z.infer<typeof IssueColumn>;

/** A custom field as a column, named like in TQL (E-50). */
export const CustomColumn = z.string().regex(/^cf\[\d+\]$/);
export type CustomColumn = `cf[${number}]`;

export const DEFAULT_ISSUE_COLUMNS: IssueColumn[] = ['status', 'assignee', 'updated'];

export const IssueColumns = z
  .object({
    columns: z
      .array(z.union([IssueColumn, CustomColumn]))
      .max(60)
      .refine((columns) => new Set(columns).size === columns.length, 'Columns must be unique'),
  })
  .meta({ id: 'IssueColumns' });
export type IssueColumns = z.infer<typeof IssueColumns>;
/** A column of result lists: a system column or `cf[n]`. */
export type ListColumn = IssueColumn | CustomColumn;
