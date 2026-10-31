import { z } from 'zod';
import { Email, Id, Password } from './identity.js';
import { ProjectRole } from './tracking.js';

/** An invitation by e-mail, also into a project (P-USR-15, TL-67, E-119). */
export const Invitation = z
  .object({
    id: Id,
    email: z.string(),
    project: z.object({ key: z.string(), name: z.string() }).nullable(),
    role: ProjectRole.nullable(),
    invitedBy: z.object({ id: Id, displayName: z.string() }).nullable(),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    acceptedAt: z.iso.datetime().nullable(),
    revokedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'Invitation' });
export type Invitation = z.infer<typeof Invitation>;

export const CreateInvitationRequest = z
  .object({
    email: Email,
    /** Project invitations name a role; admins may invite without a project. */
    projectKey: z.string().trim().toUpperCase().optional(),
    role: ProjectRole.default('developers'),
  })
  .meta({ id: 'CreateInvitationRequest' });
export type CreateInvitationRequest = z.infer<typeof CreateInvitationRequest>;

/** What the invitation page shows before an account exists. */
export const InvitationPreview = z
  .object({
    email: z.string(),
    instanceName: z.string(),
    project: z.object({ key: z.string(), name: z.string() }).nullable(),
    invitedBy: z.string().nullable(),
    /** Self-registration rather than an invitation. */
    registration: z.boolean(),
  })
  .meta({ id: 'InvitationPreview' });
export type InvitationPreview = z.infer<typeof InvitationPreview>;

export const AcceptInvitationRequest = z
  .object({
    token: z.string().min(20).max(200),
    displayName: z.string().trim().min(1).max(100),
    password: Password,
  })
  .meta({ id: 'AcceptInvitationRequest' });
export type AcceptInvitationRequest = z.infer<typeof AcceptInvitationRequest>;

/** Self-registration (off by default), for e-mail addresses of listed domains. */
export const RegistrationSettings = z
  .object({
    enabled: z.boolean(),
    domains: z
      .array(
        z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/),
      )
      .max(50),
  })
  .meta({ id: 'RegistrationSettings' });
export type RegistrationSettings = z.infer<typeof RegistrationSettings>;

export const RegisterRequest = z.object({ email: Email }).meta({ id: 'RegisterRequest' });
export type RegisterRequest = z.infer<typeof RegisterRequest>;
