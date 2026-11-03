import { z } from 'zod';
import { DisplayName, Id } from './identity.js';
import { UserRef } from './tracking.js';

/**
 * Agents (TL-92, E-144): accounts of AI agents such as Claude Code or Codex. They are users with
 * the kind "agent": assignable, with roles and history like people, but without a password or
 * sign-in; their responsible person or an administrator creates their tokens.
 */

/** Suggestions for the vendor field; any other name is allowed. */
export const AGENT_VENDORS = [
  'Claude Code',
  'Codex CLI',
  'Gemini CLI',
  'GitHub Copilot',
  'Cursor',
] as const;

const Vendor = z.string().trim().min(1).max(60);
const Model = z.string().trim().max(80);

export const Agent = z
  .object({
    id: Id,
    displayName: z.string(),
    vendor: z.string(),
    model: z.string(),
    owner: UserRef.nullable(),
    /** TQL for what the agent may take with claim-next; empty: anything (TL-94, E-146). */
    taskFilter: z.string(),
    /** Where the agent's notifications are sent; null: none (TL-95, E-147). */
    webhookUrl: z.string().nullable(),
    status: z.enum(['active', 'deactivated']),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'Agent' });
export type Agent = z.infer<typeof Agent>;

export const CreateAgentRequest = z
  .object({
    displayName: DisplayName,
    vendor: Vendor,
    model: Model.default(''),
    taskFilter: z.string().trim().max(2000).default(''),
    /** The responsible person; the creating administrator when left out. */
    ownerId: Id.optional(),
    /** Groups to join; agents are not in "users" and get projects one by one. */
    groups: z.array(z.string().trim().min(1)).default([]),
  })
  .meta({ id: 'CreateAgentRequest' });
export type CreateAgentRequest = z.infer<typeof CreateAgentRequest>;

export const UpdateAgentRequest = z
  .object({
    displayName: DisplayName.optional(),
    vendor: Vendor.optional(),
    model: Model.optional(),
    taskFilter: z.string().trim().max(2000).optional(),
    ownerId: Id.nullable().optional(),
  })
  .meta({ id: 'UpdateAgentRequest' });
export type UpdateAgentRequest = z.infer<typeof UpdateAgentRequest>;

// ---------------------------------------------------------------- presence (TL-93, E-145)

export const PRESENCE_STATES = ['active', 'waiting', 'blocked', 'offline'] as const;
export const PresenceState = z.enum(PRESENCE_STATES).meta({ id: 'PresenceState' });
export type PresenceState = z.infer<typeof PresenceState>;

/** A heartbeat older than this counts as offline. */
export const HEARTBEAT_MINUTES = 30;
/** People without a heartbeat count as active while they used Lenipo this recently. */
export const ONLINE_MINUTES = 15;

export const UpdatePresenceRequest = z
  .object({
    state: PresenceState,
    /** The issue being worked on; null clears it, left out keeps it. */
    issueKey: z.string().trim().min(1).max(40).nullable().optional(),
    branch: z.string().trim().max(200).nullable().optional(),
    /** A short line, e.g. what blocks or what is awaited. */
    note: z.string().trim().max(280).optional(),
  })
  .meta({ id: 'UpdatePresenceRequest' });
export type UpdatePresenceRequest = z.infer<typeof UpdatePresenceRequest>;

const IssueBrief = z.object({ key: z.string(), summary: z.string() });

export const Presence = z
  .object({
    state: PresenceState,
    issue: IssueBrief.nullable(),
    branch: z.string().nullable(),
    note: z.string(),
    /** The last heartbeat; null without one. */
    heartbeatAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'Presence' });
export type Presence = z.infer<typeof Presence>;

/** Someone working in a project: with recent activity, open issues or a heartbeat there. */
export const TeamMember = Presence.extend({
  user: UserRef,
  agent: z.boolean(),
  /** The latest of heartbeat, use of Lenipo and changes in the project. */
  lastActivityAt: z.iso.datetime().nullable(),
  /** Open issues assigned in this project. */
  openIssues: z.number().int(),
}).meta({ id: 'TeamMember' });
export type TeamMember = z.infer<typeof TeamMember>;

// ---------------------------------------------------------------- claims (TL-94, E-146)

/** A claim lasts this long and every heartbeat extends it. */
export const CLAIM_MINUTES = 30;

const WorkPath = z.string().trim().min(1).max(300);

export const ClaimRequest = z
  .object({
    /** The branch the work happens on. */
    branch: z.string().trim().max(200).optional(),
    /** Files or folders the work changes, e.g. `apps/web/src/features/` or `packages/shared/**`. */
    paths: z.array(WorkPath).max(50).default([]),
    /** Claim despite overlapping work areas; recorded on the claim. */
    force: z.boolean().default(false),
  })
  .meta({ id: 'ClaimRequest' });
export type ClaimRequest = z.infer<typeof ClaimRequest>;

export const ClaimNextRequest = ClaimRequest.extend({
  /** TQL narrowing the candidates further, besides the agent's own filter. */
  filter: z.string().trim().max(2000).optional(),
}).meta({ id: 'ClaimNextRequest' });
export type ClaimNextRequest = z.infer<typeof ClaimNextRequest>;

export const Claim = z
  .object({
    issue: IssueBrief,
    user: UserRef,
    branch: z.string().nullable(),
    paths: z.array(z.string()),
    /** Claimed despite overlapping work areas. */
    forced: z.boolean(),
    claimedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  })
  .meta({ id: 'Claim' });
export type Claim = z.infer<typeof Claim>;

/** A claim, or null when there is none (or nothing fit claim-next). */
export const ClaimResult = z.object({ claim: Claim.nullable() }).meta({ id: 'ClaimResult' });
export type ClaimResult = z.infer<typeof ClaimResult>;

// ---------------------------------------------------------------- collaboration (TL-95, E-147)

const Section = z.string().trim().max(20_000);

export const HandoverRequest = z
  .object({
    /** What is done, Markdown. */
    done: Section.min(1),
    /** What is still missing, Markdown. */
    open: Section.default(''),
    notes: Section.default(''),
    /** The person or agent taking over: id or e-mail; becomes assignee and holds the claim. */
    to: z.string().trim().min(1).max(254).optional(),
  })
  .meta({ id: 'HandoverRequest' });
export type HandoverRequest = z.infer<typeof HandoverRequest>;

export const BlockerRequest = z
  .object({
    /** The issue in the way; linked as "blocks" when given. */
    blockedBy: z.string().trim().min(1).max(40).optional(),
    note: z.string().trim().min(1).max(2000),
  })
  .meta({ id: 'BlockerRequest' });
export type BlockerRequest = z.infer<typeof BlockerRequest>;

export const AgentWebhookRequest = z
  .object({ url: z.url().max(2000) })
  .meta({ id: 'AgentWebhookRequest' });
export type AgentWebhookRequest = z.infer<typeof AgentWebhookRequest>;

/** Returned once when the webhook is set; the secret signs every delivery. */
export const AgentWebhook = z
  .object({ url: z.string(), secret: z.string() })
  .meta({ id: 'AgentWebhook' });
export type AgentWebhook = z.infer<typeof AgentWebhook>;

// ---------------------------------------------------------------- roles and approvals (TL-96, E-148)

/**
 * What an agent does in a project: planners plan, fill and start sprints, coordinators complete
 * them, implementers and testers claim work, reviewers review. Without roles: implementer.
 */
export const AGENT_ROLES = ['planner', 'implementer', 'reviewer', 'tester', 'coordinator'] as const;
export const AgentRole = z.enum(AGENT_ROLES).meta({ id: 'AgentRole' });
export type AgentRole = z.infer<typeof AgentRole>;

export const ProjectAgent = z
  .object({
    agent: UserRef,
    vendor: z.string(),
    /** Empty means implementer. */
    roles: z.array(AgentRole),
  })
  .meta({ id: 'ProjectAgent' });
export type ProjectAgent = z.infer<typeof ProjectAgent>;

export const ProjectAgentSettings = z
  .object({
    /** Agents start and complete sprints only after a person approved it. */
    sprintApproval: z.boolean(),
    /** Agents with a role in the project. */
    agents: z.array(ProjectAgent),
  })
  .meta({ id: 'ProjectAgentSettings' });
export type ProjectAgentSettings = z.infer<typeof ProjectAgentSettings>;

export const UpdateProjectAgentSettings = z
  .object({ sprintApproval: z.boolean() })
  .meta({ id: 'UpdateProjectAgentSettings' });
export type UpdateProjectAgentSettings = z.infer<typeof UpdateProjectAgentSettings>;

export const SetAgentRolesRequest = z
  .object({ roles: z.array(AgentRole).max(AGENT_ROLES.length) })
  .meta({ id: 'SetAgentRolesRequest' });
export type SetAgentRolesRequest = z.infer<typeof SetAgentRolesRequest>;

export const SprintApproval = z
  .object({
    id: Id,
    action: z.enum(['start', 'complete']),
    sprint: z.object({ id: Id, name: z.string(), boardId: Id }),
    projectKey: z.string(),
    requestedBy: UserRef,
    status: z.enum(['pending', 'approved', 'rejected']),
    decidedBy: UserRef.nullable(),
    /** Why it was rejected. */
    reason: z.string(),
    createdAt: z.iso.datetime(),
    decidedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'SprintApproval' });
export type SprintApproval = z.infer<typeof SprintApproval>;

export const DecideApprovalRequest = z
  .object({
    approve: z.boolean(),
    reason: z.string().trim().max(2000).default(''),
  })
  .meta({ id: 'DecideApprovalRequest' });
export type DecideApprovalRequest = z.infer<typeof DecideApprovalRequest>;
