import { z } from 'zod';
import { Id } from './identity.js';

/** An LDAP or Active Directory server as a user directory (P-USR-04, E-119). */
export const LdapConfig = z
  .object({
    url: z
      .string()
      .regex(/^ldaps?:\/\/.+/, 'ldap://… or ldaps://…')
      .max(500),
    startTls: z.boolean().default(false),
    bindDn: z.string().max(500),
    /** Empty on save keeps the stored password. */
    bindPassword: z.string().max(500).default(''),
    userBase: z.string().min(1).max(500),
    userFilter: z.string().max(1000).default('(objectClass=person)'),
    loginAttribute: z.string().max(100).default('uid'),
    emailAttribute: z.string().max(100).default('mail'),
    nameAttribute: z.string().max(100).default('cn'),
    /** Empty: groups are not synchronised. */
    groupBase: z.string().max(500).default(''),
    groupFilter: z.string().max(1000).default('(objectClass=groupOfNames)'),
    groupNameAttribute: z.string().max(100).default('cn'),
    /** member (DNs) or memberUid (login names). */
    groupMemberAttribute: z.string().max(100).default('member'),
  })
  .meta({ id: 'LdapConfig' });
export type LdapConfig = z.infer<typeof LdapConfig>;

export const Directory = z
  .object({
    id: Id,
    name: z.string(),
    /** The internal directory holds local accounts; it can be moved but not removed. */
    type: z.enum(['internal', 'ldap']),
    position: z.number().int(),
    enabled: z.boolean(),
    config: LdapConfig.omit({ bindPassword: true }).extend({ hasPassword: z.boolean() }).nullable(),
    users: z.number().int(),
    lastSyncAt: z.iso.datetime().nullable(),
    lastSyncResult: z.string().nullable(),
  })
  .meta({ id: 'Directory' });
export type Directory = z.infer<typeof Directory>;

export const SaveDirectoryRequest = z
  .object({
    name: z.string().trim().min(1).max(100),
    enabled: z.boolean().default(true),
    config: LdapConfig,
  })
  .meta({ id: 'SaveDirectoryRequest' });
export type SaveDirectoryRequest = z.infer<typeof SaveDirectoryRequest>;

/** The order in which password sign-ins ask the directories (P-USR-07). */
export const DirectoryOrder = z
  .object({ ids: z.array(Id).min(1).max(50) })
  .meta({ id: 'DirectoryOrder' });
export type DirectoryOrder = z.infer<typeof DirectoryOrder>;

export const DirectorySyncResult = z
  .object({
    created: z.number().int(),
    updated: z.number().int(),
    deactivated: z.number().int(),
    groups: z.number().int(),
    problems: z.array(z.string()),
  })
  .meta({ id: 'DirectorySyncResult' });
export type DirectorySyncResult = z.infer<typeof DirectorySyncResult>;

/** A SAML 2.0 identity provider (P-USR-05, E-119). */
export const SamlProvider = z
  .object({
    id: Id,
    name: z.string(),
    enabled: z.boolean(),
    /** From the IdP metadata. */
    idpEntityId: z.string(),
    ssoUrl: z.string(),
    certificates: z.number().int(),
    emailAttribute: z.string(),
    nameAttribute: z.string(),
    groupsAttribute: z.string(),
    /** Create accounts on first sign-in; otherwise only existing e-mail addresses may sign in. */
    createUsers: z.boolean(),
    /** What to enter at the IdP. */
    spEntityId: z.string(),
    acsUrl: z.string(),
    metadataUrl: z.string(),
  })
  .meta({ id: 'SamlProvider' });
export type SamlProvider = z.infer<typeof SamlProvider>;

export const SaveSamlProviderRequest = z
  .object({
    name: z.string().trim().min(1).max(100),
    enabled: z.boolean().default(true),
    /** The IdP metadata XML; on update, empty keeps the stored one. */
    metadata: z.string().max(200_000).default(''),
    emailAttribute: z.string().max(200).default('email'),
    nameAttribute: z.string().max(200).default('displayName'),
    groupsAttribute: z.string().max(200).default(''),
    createUsers: z.boolean().default(true),
  })
  .meta({ id: 'SaveSamlProviderRequest' });
export type SaveSamlProviderRequest = z.infer<typeof SaveSamlProviderRequest>;

/** A token an identity provider uses for SCIM 2.0 (TL-52, E-141); the secret is shown once. */
export const ScimToken = z
  .object({
    id: z.uuid(),
    name: z.string(),
    prefix: z.string(),
    createdAt: z.iso.datetime(),
    lastUsedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'ScimToken' });
export type ScimToken = z.infer<typeof ScimToken>;

export const CreatedScimToken = ScimToken.extend({ secret: z.string() }).meta({
  id: 'CreatedScimToken',
});
export type CreatedScimToken = z.infer<typeof CreatedScimToken>;

export const CreateScimTokenRequest = z
  .object({ name: z.string().trim().min(1).max(100) })
  .meta({ id: 'CreateScimTokenRequest' });
export type CreateScimTokenRequest = z.infer<typeof CreateScimTokenRequest>;
