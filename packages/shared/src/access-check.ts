import { z } from 'zod';
import { Id } from './identity.js';
import { ProjectPermission } from './tracking.js';
import { SpacePermission } from './wiki.js';

/**
 * "Why may X not do this?" (TL-15, P-PRM-05, E-96): a person, a target – a project or issue,
 * or a space or page – and the permission to explain.
 */
export const AccessCheckRequest = z
  .object({
    /** E-mail address or user id. */
    user: z.string().trim().min(1).max(200),
    projectKey: z.string().trim().min(1).max(20).optional(),
    issueKey: z.string().trim().min(1).max(30).optional(),
    permission: ProjectPermission.optional(),
    spaceKey: z.string().trim().min(1).max(20).optional(),
    pageId: Id.optional(),
    spacePermission: SpacePermission.optional(),
  })
  .refine(
    (request) =>
      (request.projectKey || request.issueKey ? 1 : 0) +
        (request.spaceKey || request.pageId ? 1 : 0) ===
      1,
    { message: 'Name a project or issue, or a space or page' },
  )
  .meta({ id: 'AccessCheckRequest' });
export type AccessCheckRequest = z.infer<typeof AccessCheckRequest>;

/**
 * One step of the explanation: `passed` true or false for a check, null for a plain fact;
 * the web app words it from `code` and `params`.
 */
export const AccessCheckStep = z
  .object({
    code: z.string(),
    passed: z.boolean().nullable(),
    params: z.record(z.string(), z.string()),
  })
  .meta({ id: 'AccessCheckStep' });
export type AccessCheckStep = z.infer<typeof AccessCheckStep>;

export const AccessCheckResult = z
  .object({
    user: z.object({ id: Id, displayName: z.string() }),
    granted: z.boolean(),
    steps: z.array(AccessCheckStep),
  })
  .meta({ id: 'AccessCheckResult' });
export type AccessCheckResult = z.infer<typeof AccessCheckResult>;
