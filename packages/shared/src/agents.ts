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
