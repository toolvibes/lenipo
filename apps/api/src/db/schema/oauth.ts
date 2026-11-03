import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity.js';

/** A client that registered itself, e.g. an MCP client (RFC 7591, TL-69, E-115). */
export const oauthClients = pgTable('oauth_clients', {
  id: uuid().primaryKey(),
  name: text().notNull(),
  redirectUris: text().array().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  /** Unused registrations are removed after a while. */
  lastUsedAt: timestamp({ withTimezone: true }),
  /** Set for apps an administrator registered (TL-41, E-122); they are never cleaned up. */
  registeredById: uuid().references(() => users.id, { onDelete: 'set null' }),
  description: text().notNull().default(''),
  /** SHA-256 of the client secret of a confidential app; null for public clients (PKCE). */
  secretHash: text(),
});

/** What a person allowed a client: scopes until revoked. */
export const oauthGrants = pgTable(
  'oauth_grants',
  {
    id: uuid().primaryKey(),
    clientId: uuid()
      .notNull()
      .references(() => oauthClients.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scopes: text().array().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (table) => [index('oauth_grants_user_idx').on(table.userId)],
);

/** Authorization codes, access and refresh tokens; only their hashes are stored. */
export const oauthTokens = pgTable(
  'oauth_tokens',
  {
    id: uuid().primaryKey(),
    grantId: uuid()
      .notNull()
      .references(() => oauthGrants.id, { onDelete: 'cascade' }),
    kind: text().notNull(),
    tokenHash: text().notNull(),
    /** For codes: the redirect URI and PKCE challenge they were issued for. */
    redirectUri: text(),
    codeChallenge: text(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    /** A used code or rotated refresh token; using it again revokes the grant. */
    usedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('oauth_tokens_hash_unique').on(table.tokenHash),
    index('oauth_tokens_grant_idx').on(table.grantId),
  ],
);

/**
 * Installed apps (TL-50, E-140): the manifest as fetched and approved, and the OAuth client
 * through which the app gets short-lived tokens for the person looking at it.
 */
export const apps = pgTable(
  'apps',
  {
    id: uuid().primaryKey(),
    key: text().notNull(),
    manifestUrl: text().notNull(),
    origin: text().notNull(),
    manifest: jsonb().notNull(),
    /** Scopes the admin approved; the app never gets more. */
    scopes: text().array().notNull(),
    enabled: boolean().notNull().default(true),
    clientId: uuid()
      .notNull()
      .references(() => oauthClients.id),
    installedById: uuid().references(() => users.id, { onDelete: 'set null' }),
    installedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('apps_key_idx').on(table.key)],
);
