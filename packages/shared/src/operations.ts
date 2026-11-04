import { z } from 'zod';
import { Id } from './identity.js';

/** Modules an administrator can switch off (TL-40, E-121); their data stays. */
export const MODULES = ['wiki', 'boards', 'time-tracking', 'automation', 'dashboards'] as const;
export const ModuleName = z.enum(MODULES).meta({ id: 'ModuleName' });
export type ModuleName = z.infer<typeof ModuleName>;

export const FeatureFlags = z
  .object(
    Object.fromEntries(MODULES.map((name) => [name, z.boolean().default(true)])) as {
      [K in ModuleName]: z.ZodDefault<z.ZodBoolean>;
    },
  )
  .meta({ id: 'FeatureFlags' });
export type FeatureFlags = z.infer<typeof FeatureFlags>;

const PerMinute = z.number().int().min(1).max(100_000);

/** Requests per minute (TL-40, E-121). */
export const RateLimitSettings = z
  .object({
    /** Signed-in people in the browser, per person. */
    people: PerMinute.default(600),
    /** API tokens and app connections, per token. */
    tokens: PerMinute.default(300),
    /** Requests without sign-in, per IP address. */
    anonymous: PerMinute.default(60),
  })
  .meta({ id: 'RateLimitSettings' });
export type RateLimitSettings = z.infer<typeof RateLimitSettings>;

export const MaintenanceMode = z
  .object({
    enabled: z.boolean().default(false),
    /** Shown to everyone who is not an administrator. */
    message: z.string().max(1000).default(''),
  })
  .meta({ id: 'MaintenanceMode' });
export type MaintenanceMode = z.infer<typeof MaintenanceMode>;

export const Announcement = z
  .object({
    /** Markdown; empty means no banner. */
    text: z.string().max(2000).default(''),
    level: z.enum(['info', 'warning']).default('info'),
    startsAt: z.iso.datetime().nullable().default(null),
    endsAt: z.iso.datetime().nullable().default(null),
  })
  .meta({ id: 'Announcement' });
export type Announcement = z.infer<typeof Announcement>;

/** What every page needs to know about the instance; also before sign-in. */
export const InstanceNotice = z
  .object({
    modules: FeatureFlags,
    maintenance: MaintenanceMode,
    /** The banner while it is due, with a version to remember dismissals by. */
    announcement: Announcement.extend({ version: z.string() }).nullable(),
    /** An external help page set by the operators; null: the built-in handbook. */
    helpUrl: z.string().nullable(),
  })
  .meta({ id: 'InstanceNotice' });
export type InstanceNotice = z.infer<typeof InstanceNotice>;

/** Limits of one API token, set by administrators. */
export const TokenLimits = z
  .object({
    /** Requests per minute instead of the default for tokens. */
    perMinute: PerMinute.nullable(),
    /** Requests per day (UTC); null: no quota. */
    perDay: z.number().int().min(1).max(10_000_000).nullable(),
  })
  .meta({ id: 'TokenLimits' });
export type TokenLimits = z.infer<typeof TokenLimits>;

export const AdminToken = z
  .object({
    id: Id,
    name: z.string(),
    prefix: z.string(),
    owner: z.object({ id: Id, displayName: z.string(), email: z.string() }),
    scopes: z.array(z.string()),
    expiresAt: z.string(),
    lastUsedAt: z.string().nullable(),
    limits: TokenLimits,
    usedToday: z.number().int(),
  })
  .meta({ id: 'AdminToken' });
export type AdminToken = z.infer<typeof AdminToken>;

// ---------------------------------------------------------------- provider limits (TL-103, E-154)

/**
 * What a provider (e.g. Lenipo Cloud) allows this instance, set over the API with the
 * SETUP_TOKEN. Without it (self-hosting) nothing is limited.
 */
export const ProviderLimits = z
  .object({
    /** The name of the plan, shown to administrators. */
    plan: z.string().trim().max(60).default(''),
    /** Active people who are not external guests; agents do not count. Null: no limit. */
    persons: z.number().int().min(1).max(1_000_000).nullable().default(null),
    agents: z.number().int().min(0).max(10_000).nullable().default(null),
    /** Attachments of issues and pages together. */
    storageMb: z.number().int().min(0).max(10_000_000).nullable().default(null),
    /** Modules the plan includes; null: all. */
    modules: z.array(ModuleName).nullable().default(null),
    serviceDesk: z.boolean().default(true),
    /**
     * Ceilings for the request limits (TL-104, E-156): administrators set them lower, never
     * higher. Null: no ceiling.
     */
    requestsPerMinute: z
      .object({ people: PerMinute, tokens: PerMinute, anonymous: PerMinute })
      .nullable()
      .default(null),
  })
  .meta({ id: 'ProviderLimits' });
export type ProviderLimits = z.infer<typeof ProviderLimits>;

export const ProviderUsage = z
  .object({
    persons: z.number().int(),
    agents: z.number().int(),
    storageMb: z.number(),
    serviceDesks: z.number().int(),
    /** Modules switched on now. */
    modules: z.array(ModuleName),
    /** The limits in force; null without a provider. */
    limits: ProviderLimits.nullable(),
    /** The last time a person used the instance (browser or token); null: never. */
    lastActiveAt: z.iso.datetime().nullable(),
    measuredAt: z.iso.datetime(),
  })
  .meta({ id: 'ProviderUsage' });
export type ProviderUsage = z.infer<typeof ProviderUsage>;
