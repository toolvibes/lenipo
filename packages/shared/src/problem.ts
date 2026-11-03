import { z } from 'zod';

/** A TQL error with its position, as produced by @toolvibes/tql or by the API. */
export const QueryError = z
  .object({
    code: z.string(),
    message: z.string(),
    start: z.number().int(),
    end: z.number().int(),
    params: z.record(z.string(), z.string()),
  })
  .meta({ id: 'QueryError' });
export type QueryError = z.infer<typeof QueryError>;

/** Another claim whose work area overlaps (TL-94, E-146). */
export const ClaimConflict = z
  .object({
    issueKey: z.string(),
    user: z.object({ id: z.string(), displayName: z.string() }),
    branch: z.string().nullable(),
    /** The overlapping paths of the other claim. */
    paths: z.array(z.string()),
  })
  .meta({ id: 'ClaimConflict' });
export type ClaimConflict = z.infer<typeof ClaimConflict>;

/** Error body for every failed API request (RFC 9457 problem details). */
export const Problem = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string().optional(),
    /** Field-level validation errors, keyed by dotted path. */
    errors: z.record(z.string(), z.array(z.string())).optional(),
    /** Errors in a TQL query, with positions (type urn:lenipo:problem:query). */
    queryErrors: z.array(QueryError).optional(),
    /** Claims in the way of a new one (type urn:lenipo:problem:claim-conflict). */
    claimConflicts: z.array(ClaimConflict).optional(),
  })
  .meta({ id: 'Problem' });
export type Problem = z.infer<typeof Problem>;
