import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  inet,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const userStatus = pgEnum('user_status', ['active', 'deactivated']);

export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey(),
    /** Stored lower-cased; uniqueness is case-insensitive by construction. */
    email: text().notNull(),
    displayName: text().notNull(),
    /** Null for accounts that only sign in through an external identity provider. */
    passwordHash: text(),
    status: userStatus().notNull().default('active'),
    locale: text().notNull().default('de'),
    timeZone: text().notNull().default('Europe/Berlin'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp({ withTimezone: true }),
    /** TOTP secret (base32) once two-factor sign-in is on (TL-18, E-100). */
    totpSecret: text(),
    /** A secret being set up, until a first code confirms it. */
    totpPendingSecret: text(),
    totpEnabledAt: timestamp({ withTimezone: true }),
    /** Last accepted time step, so a code cannot be used twice. */
    totpLastStep: bigint({ mode: 'number' }),
    /** Finished or skipped the welcome steps (E-71); null sends the web app to /welcome. */
    onboardedAt: timestamp({ withTimezone: true }),
    /** Single-key shortcuts in the web app; off for people who type with speech or switches (TL-7). */
    keyboardShortcuts: boolean().notNull().default(true),
    /** Secret for reading feeds without a session (TL-29). */
    feedToken: text(),
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)],
);

export const groups = pgTable(
  'groups',
  {
    id: uuid().primaryKey(),
    name: text().notNull(),
    description: text().notNull().default(''),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('groups_name_unique').on(table.name)],
);

export const groupMembers = pgTable(
  'group_members',
  {
    groupId: uuid()
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    addedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.userId] }),
    index('group_members_user_idx').on(table.userId),
  ],
);

/** Global permissions are granted to groups only, never to single users. */
export const globalPermissionGrants = pgTable(
  'global_permission_grants',
  {
    permission: text().notNull(),
    groupId: uuid()
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.permission, table.groupId] })],
);

/** Browser sessions. The cookie carries a random secret; only its SHA-256 is stored. */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid().primaryKey(),
    tokenHash: text().notNull(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    authMethod: text().notNull(),
    ip: inet(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
    /**
     * 'full'; 'second-factor' after the password while a TOTP code is due; 'setup-2fa' while a
     * person who must use two-factor sign-in has not set it up yet (TL-18, E-100).
     */
    stage: text().notNull().default('full'),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('sessions_user_idx').on(table.userId).where(sql`${table.revokedAt} is null`),
  ],
);

export const personalAccessTokens = pgTable(
  'personal_access_tokens',
  {
    id: uuid().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    /** First characters of the secret, shown so people can tell tokens apart. */
    prefix: text().notNull(),
    tokenHash: text().notNull(),
    scopes: text().array().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    lastUsedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    uniqueIndex('personal_access_tokens_hash_unique').on(table.tokenHash),
    index('personal_access_tokens_user_idx').on(table.userId),
  ],
);

/** Links an external identity (OIDC issuer + subject) to a Tasklore user. */
export const userIdentities = pgTable(
  'user_identities',
  {
    issuer: text().notNull(),
    subject: text().notNull(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    email: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.issuer, table.subject] }),
    index('user_identities_user_idx').on(table.userId),
  ],
);

/** OIDC sign-ins between redirect and callback (decision E-30). Each row is used once. */
export const oidcLoginAttempts = pgTable('oidc_login_attempts', {
  stateHash: text().primaryKey(),
  codeVerifier: text().notNull(),
  nonce: text().notNull(),
  redirectTo: text().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
});

/** Single-use recovery codes for two-factor sign-in, stored hashed (TL-18, E-100). */
export const recoveryCodes = pgTable(
  'recovery_codes',
  {
    id: uuid().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text().notNull(),
    usedAt: timestamp({ withTimezone: true }),
  },
  (table) => [index('recovery_codes_user_idx').on(table.userId)],
);
