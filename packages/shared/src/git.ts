import { z } from 'zod';
import { Id } from './identity.js';

/** Git hosting connected through inbound webhooks (D-GIT-01, E-116). */
export const GIT_PROVIDERS = ['github', 'gitlab', 'gitea', 'bitbucket'] as const;
export const GitProvider = z.enum(GIT_PROVIDERS).meta({ id: 'GitProvider' });
export type GitProvider = z.infer<typeof GitProvider>;

export const GitConnection = z
  .object({
    id: Id,
    name: z.string(),
    provider: GitProvider,
    /** Where the hosting sends its webhooks. */
    webhookUrl: z.string(),
    createdAt: z.iso.datetime(),
    lastEventAt: z.iso.datetime().nullable(),
    /** Why the last delivery was rejected, e.g. a wrong secret. */
    lastError: z.string().nullable(),
  })
  .meta({ id: 'GitConnection' });
export type GitConnection = z.infer<typeof GitConnection>;

/** Shown once after creating: the secret to enter at the hosting. */
export const CreatedGitConnection = GitConnection.extend({ secret: z.string() }).meta({
  id: 'CreatedGitConnection',
});
export type CreatedGitConnection = z.infer<typeof CreatedGitConnection>;

export const CreateGitConnectionRequest = z
  .object({ name: z.string().trim().min(1).max(100), provider: GitProvider })
  .meta({ id: 'CreateGitConnectionRequest' });
export type CreateGitConnectionRequest = z.infer<typeof CreateGitConnectionRequest>;

export const PULL_REQUEST_STATES = ['open', 'draft', 'merged', 'closed'] as const;
export const BUILD_STATES = ['pending', 'success', 'failure'] as const;

/** Branches, commits, pull requests and builds that name an issue (D-GIT-02/04). */
export const IssueDevelopment = z
  .object({
    branches: z.array(
      z.object({
        name: z.string(),
        repository: z.string(),
        url: z.string().nullable(),
        updatedAt: z.iso.datetime(),
      }),
    ),
    commits: z.object({
      count: z.number().int(),
      latest: z.array(
        z.object({
          sha: z.string(),
          message: z.string(),
          repository: z.string(),
          url: z.string().nullable(),
          author: z.string().nullable(),
          at: z.iso.datetime(),
          /** What smart commit commands did, or why they did not (D-GIT-03). */
          smart: z.array(z.string()),
        }),
      ),
    }),
    pullRequests: z.array(
      z.object({
        number: z.string(),
        title: z.string(),
        repository: z.string(),
        url: z.string().nullable(),
        state: z.enum(PULL_REQUEST_STATES),
        review: z.enum(['approved', 'changes_requested']).nullable(),
        author: z.string().nullable(),
        updatedAt: z.iso.datetime(),
      }),
    ),
    builds: z.array(
      z.object({
        name: z.string(),
        repository: z.string(),
        url: z.string().nullable(),
        state: z.enum(BUILD_STATES),
        updatedAt: z.iso.datetime(),
      }),
    ),
  })
  .meta({ id: 'IssueDevelopment' });
export type IssueDevelopment = z.infer<typeof IssueDevelopment>;

/** Per issue of a release: what still needs attention in Git (release view). */
export const DevelopmentSummary = z
  .object({
    issueKey: z.string(),
    openPullRequests: z.number().int(),
    mergedPullRequests: z.number().int(),
    failingBuilds: z.number().int(),
  })
  .meta({ id: 'DevelopmentSummary' });
export type DevelopmentSummary = z.infer<typeof DevelopmentSummary>;

/** Events for automation rules (D-GIT-05, TL-89). */
export const GIT_EVENTS = [
  'branch_created',
  'commit_pushed',
  'pull_request_opened',
  'pull_request_merged',
  'build_failed',
] as const;
export type GitEvent = (typeof GIT_EVENTS)[number];
