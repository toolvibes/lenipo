import { z } from 'zod';
import { TokenScope } from './identity.js';

/**
 * Apps (TL-50, E-140): pages of another origin that Lenipo shows in iframes as panels on the
 * issue page, wiki macros and dashboard gadgets. An app describes itself in a manifest.
 */
export const APP_MODULE_KINDS = ['issuePanels', 'macros', 'gadgets'] as const;
export type AppModuleKind = (typeof APP_MODULE_KINDS)[number];

const ModuleKey = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,39}$/, 'lowercase letters, digits and hyphens');

export const AppModule = z
  .object({
    key: ModuleKey,
    title: z.string().trim().min(1).max(80),
    /** Relative to the app's base URL, or absolute on its origin. */
    url: z.string().min(1).max(2_000),
  })
  .meta({ id: 'AppModule' });
export type AppModule = z.infer<typeof AppModule>;

const Modules = z.array(AppModule).max(20).default([]);

/** The file an app serves, e.g. https://app.example.org/lenipo-app.json. */
export const AppManifest = z
  .object({
    key: ModuleKey,
    name: z.string().trim().min(1).max(80),
    vendor: z.string().trim().max(120).default(''),
    description: z.string().trim().max(1_000).default(''),
    /** Origin and path the module URLs are relative to; not Lenipo's own origin. */
    baseUrl: z.url({ protocol: /^https?$/ }),
    /** What the app may do as the person looking at it; empty: no API access. Never admin. */
    scopes: z
      .array(TokenScope.exclude(['admin']))
      .max(10)
      .default([]),
    modules: z
      .object({ issuePanels: Modules, macros: Modules, gadgets: Modules })
      .partial()
      .default({}),
  })
  .meta({ id: 'AppManifest' });
export type AppManifest = z.infer<typeof AppManifest>;

/** An installed app as everyone sees it: what to show where. */
export const AppSummary = z
  .object({
    id: z.uuid(),
    key: z.string(),
    name: z.string(),
    vendor: z.string(),
    /** The origin messages must come from and go to. */
    origin: z.string(),
    /** Whether the app may ask for an access token. */
    usesApi: z.boolean(),
    modules: z.object({
      issuePanels: z.array(AppModule),
      macros: z.array(AppModule),
      gadgets: z.array(AppModule),
    }),
  })
  .meta({ id: 'AppSummary' });
export type AppSummary = z.infer<typeof AppSummary>;

export const InstalledApp = AppSummary.extend({
  manifestUrl: z.string(),
  description: z.string(),
  scopes: z.array(TokenScope),
  enabled: z.boolean(),
  installedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).meta({ id: 'InstalledApp' });
export type InstalledApp = z.infer<typeof InstalledApp>;

export const AppManifestRequest = z
  .object({ manifestUrl: z.url({ protocol: /^https?$/ }) })
  .meta({ id: 'AppManifestRequest' });
export type AppManifestRequest = z.infer<typeof AppManifestRequest>;

/** Installing or updating confirms the scopes the admin saw. */
export const InstallAppRequest = AppManifestRequest.extend({
  approvedScopes: z.array(TokenScope),
}).meta({ id: 'InstallAppRequest' });
export type InstallAppRequest = z.infer<typeof InstallAppRequest>;

export const UpdateAppRequest = z.object({ enabled: z.boolean() }).meta({ id: 'UpdateAppRequest' });
export type UpdateAppRequest = z.infer<typeof UpdateAppRequest>;

/** A short-lived token for the person looking at the app, limited to its scopes. */
export const AppToken = z
  .object({ accessToken: z.string(), expiresIn: z.number().int(), scopes: z.array(TokenScope) })
  .meta({ id: 'AppToken' });
export type AppToken = z.infer<typeof AppToken>;
