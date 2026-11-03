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
