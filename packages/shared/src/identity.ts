import { z } from 'zod';

/** Global permissions, granted to groups (like Jira's global permissions). */
export const GLOBAL_PERMISSIONS = [
  'system-admin',
  'admin',
  'create-projects',
  'create-spaces',
  'bulk-change',
  'browse-users',
  'share-filters',
] as const;
export const GlobalPermission = z.enum(GLOBAL_PERMISSIONS).meta({ id: 'GlobalPermission' });
export type GlobalPermission = z.infer<typeof GlobalPermission>;

/** Scopes a personal access token can carry. */
export const TOKEN_SCOPES = [
  'issues:read',
  'issues:write',
  'wiki:read',
  'wiki:write',
  'admin',
] as const;
export const TokenScope = z.enum(TOKEN_SCOPES).meta({ id: 'TokenScope' });
export type TokenScope = z.infer<typeof TokenScope>;

export const Email = z
  .email()
  .max(254)
  .transform((value) => value.trim().toLowerCase());
export const Password = z
  .string()
  .min(12, 'Mindestens 12 Zeichen')
  .max(256, 'Höchstens 256 Zeichen');
export const DisplayName = z.string().trim().min(1).max(120);
export const Id = z.uuid();

export const SetupStatusResponse = z
  .object({ required: z.boolean() })
  .meta({ id: 'SetupStatusResponse' });
export type SetupStatusResponse = z.infer<typeof SetupStatusResponse>;

export const SetupRequest = z
  .object({
    token: z.string().trim().min(1),
    instanceName: z.string().trim().min(1).max(80),
    admin: z.object({ email: Email, displayName: DisplayName, password: Password }),
  })
  .meta({ id: 'SetupRequest' });
export type SetupRequest = z.infer<typeof SetupRequest>;

export const LoginRequest = z
  .object({
    email: Email,
    password: z.string().min(1).max(256),
  })
  .meta({ id: 'LoginRequest' });
export type LoginRequest = z.infer<typeof LoginRequest>;

export const Me = z
  .object({
    id: Id,
    email: z.string(),
    displayName: z.string(),
    locale: z.string(),
    timeZone: z.string(),
    globalPermissions: z.array(GlobalPermission),
    authenticatedVia: z.enum(['session', 'token', 'mcp']),
    /** Went through (or skipped) the welcome steps after the first sign-in (E-71). */
    onboarded: z.boolean(),
    /** Single-key shortcuts in the web app (TL-7). */
    keyboardShortcuts: z.boolean(),
  })
  .meta({ id: 'Me' });
export type Me = z.infer<typeof Me>;

export const SessionInfo = z
  .object({
    id: z.string(),
    current: z.boolean(),
    createdAt: z.iso.datetime(),
    lastSeenAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    ip: z.string().nullable(),
    userAgent: z.string().nullable(),
  })
  .meta({ id: 'SessionInfo' });
export type SessionInfo = z.infer<typeof SessionInfo>;

export const CreateTokenRequest = z
  .object({
    name: z.string().trim().min(1).max(80),
    scopes: z.array(TokenScope).min(1),
    expiresInDays: z.number().int().min(1).max(366),
  })
  .meta({ id: 'CreateTokenRequest' });
export type CreateTokenRequest = z.infer<typeof CreateTokenRequest>;

export const TokenInfo = z
  .object({
    id: Id,
    name: z.string(),
    prefix: z.string(),
    scopes: z.array(TokenScope),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    lastUsedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'TokenInfo' });
export type TokenInfo = z.infer<typeof TokenInfo>;

/** Returned once on creation; the secret is never retrievable again. */
export const CreatedToken = TokenInfo.extend({ secret: z.string() }).meta({ id: 'CreatedToken' });
export type CreatedToken = z.infer<typeof CreatedToken>;

export const UserSummary = z
  .object({
    id: Id,
    email: z.string(),
    displayName: z.string(),
    status: z.enum(['active', 'deactivated']),
    groups: z.array(z.string()),
  })
  .meta({ id: 'UserSummary' });
export type UserSummary = z.infer<typeof UserSummary>;

export const CreateUserRequest = z
  .object({
    email: Email,
    displayName: DisplayName,
    password: Password,
    groups: z.array(z.string().trim().min(1)).default([]),
  })
  .meta({ id: 'CreateUserRequest' });
export type CreateUserRequest = z.infer<typeof CreateUserRequest>;

export const GroupName = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, 'Kleinbuchstaben, Ziffern, Punkt, Bindestrich, Unterstrich');

export const GroupSummary = z
  .object({
    id: Id,
    name: z.string(),
    description: z.string(),
    memberCount: z.number().int(),
    globalPermissions: z.array(GlobalPermission),
  })
  .meta({ id: 'GroupSummary' });
export type GroupSummary = z.infer<typeof GroupSummary>;

/** A group as everyone may see it, e.g. to grant it a role. */
export const GroupRef = z.object({ id: Id, name: z.string() }).meta({ id: 'GroupRef' });
export type GroupRef = z.infer<typeof GroupRef>;

export const CreateGroupRequest = z
  .object({
    name: GroupName,
    description: z.string().trim().max(500).default(''),
    globalPermissions: z.array(GlobalPermission).default([]),
  })
  .meta({ id: 'CreateGroupRequest' });
export type CreateGroupRequest = z.infer<typeof CreateGroupRequest>;

export const AddGroupMemberRequest = z.object({ userId: Id }).meta({ id: 'AddGroupMemberRequest' });
export type AddGroupMemberRequest = z.infer<typeof AddGroupMemberRequest>;

/** Which sign-in methods the login page offers. */
export const AuthProviders = z
  .object({
    password: z.boolean(),
    oidc: z.object({ enabled: z.boolean(), displayName: z.string().nullable() }),
  })
  .meta({ id: 'AuthProviders' });
export type AuthProviders = z.infer<typeof AuthProviders>;

/** Only same-site paths are accepted as redirect targets (no open redirects). */
export function safeRedirectPath(value: unknown): string | undefined {
  return typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.startsWith('/\\')
    ? value
    : undefined;
}

/** Health and version overview for administrators (P-ADM-07). */
export const SystemInfo = z
  .object({
    version: z.string(),
    mode: z.enum(['api', 'collab', 'worker', 'all']),
    startedAt: z.iso.datetime(),
    uptimeSeconds: z.number().int(),
    nodeVersion: z.string(),
    postgresVersion: z.string(),
    migrationsApplied: z.number().int(),
    users: z.number().int(),
    oidcEnabled: z.boolean(),
  })
  .meta({ id: 'SystemInfo' });
export type SystemInfo = z.infer<typeof SystemInfo>;
