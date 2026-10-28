import { z } from 'zod';

/** Error body for every failed API request (RFC 9457 problem details). */
export const Problem = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  /** Field-level validation errors, keyed by dotted path. */
  errors: z.record(z.string(), z.array(z.string())).optional(),
});
export type Problem = z.infer<typeof Problem>;
