import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppManifest,
  type AppModule,
  type AppSummary,
  type AppToken,
  type InstallAppRequest,
  type InstalledApp,
  type TokenScope,
} from '@toolvibes/shared';
import { eq, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { AuditService } from '../audit/audit.service.js';
import type { AppConfig } from '../core/config.js';
import type { Principal } from '../core/http/principal.js';
import { CONFIG, DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { apps, oauthClients } from '../db/schema/index.js';
import { OAuthService } from '../identity/oauth.service.js';

const MANIFEST_LIMIT = 64 * 1024;
const MANIFEST_TIMEOUT_MS = 10_000;
const TOKEN_SECONDS = 15 * 60;
const ORIGINS_CACHE_MS = 30_000;

type AppRow = typeof apps.$inferSelect;

/** Module URLs resolved against the base URL; every one must stay on the app's origin. */
function resolveModules(manifest: AppManifest, origin: string) {
  const resolve = (modules: AppModule[] = []) =>
    modules.map((module) => {
      const url = new URL(module.url, manifest.baseUrl);
      if (url.origin !== origin) {
        throw new BadRequestException(`The module "${module.key}" leaves the app's origin.`);
      }
      return { ...module, url: url.toString() };
    });
  return {
    issuePanels: resolve(manifest.modules.issuePanels),
    macros: resolve(manifest.modules.macros),
    gadgets: resolve(manifest.modules.gadgets),
  };
}

function summary(row: AppRow): AppSummary {
  const manifest = row.manifest as AppManifest;
  return {
    id: row.id,
    key: row.key,
    name: manifest.name,
    vendor: manifest.vendor,
    origin: row.origin,
    usesApi: row.scopes.length > 0,
    modules: resolveModules(manifest, row.origin),
  };
}

function installed(row: AppRow): InstalledApp {
  const manifest = row.manifest as AppManifest;
  return {
    ...summary(row),
    manifestUrl: row.manifestUrl,
    description: manifest.description,
    scopes: row.scopes as TokenScope[],
    enabled: row.enabled,
    installedAt: row.installedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Apps (TL-50, E-140): admins install them from a manifest URL and approve their scopes.
 * Their pages run in sandboxed iframes on their own origin; Lenipo hands them the context and,
 * on request, a token for the viewer limited to the approved scopes. No app code runs here.
 */
@Injectable()
export class AppsService {
  private origins: { at: number; value: Promise<Set<string>> } | undefined;

  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(OAuthService) private readonly oauth: OAuthService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** Origins of enabled apps, for CORS and the frame-src of the CSP. */
  enabledOrigins(): Promise<Set<string>> {
    if (!this.origins || Date.now() - this.origins.at > ORIGINS_CACHE_MS) {
      const value = this.database.db
        .select({ origin: apps.origin })
        .from(apps)
        .where(eq(apps.enabled, true))
        .then((rows) => new Set(rows.map((row) => row.origin)));
      value.catch(() => {
        this.origins = undefined;
      });
      this.origins = { at: Date.now(), value };
    }
    return this.origins.value;
  }

  /** Fetches and checks a manifest without installing it. */
  async fetchManifest(manifestUrl: string, ownOrigin: string) {
    let text: string;
    try {
      const response = await fetch(manifestUrl, {
        headers: { accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(MANIFEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`answered ${response.status}`);
      text = await response.text();
    } catch (error) {
      throw new BadRequestException(
        `The manifest could not be loaded: ${(error as Error).message}`,
      );
    }
    if (text.length > MANIFEST_LIMIT) throw new BadRequestException('The manifest is too large.');
    let parsed: AppManifest;
    try {
      parsed = AppManifest.parse(JSON.parse(text));
    } catch (error) {
      throw new BadRequestException(`The manifest is invalid: ${(error as Error).message}`);
    }
    const origin = new URL(parsed.baseUrl).origin;
    const own = new Set([
      ownOrigin,
      this.config.PUBLIC_URL && new URL(this.config.PUBLIC_URL).origin,
    ]);
    // On Lenipo's origin the app would run with the viewer's session (E-140).
    if (own.has(origin)) throw new BadRequestException("An app must not run on Lenipo's origin.");
    resolveModules(parsed, origin);
    return { manifest: parsed, origin };
  }

  async preview(manifestUrl: string, ownOrigin: string): Promise<AppManifest> {
    return (await this.fetchManifest(manifestUrl, ownOrigin)).manifest;
  }

  private ensureApproved(manifest: AppManifest, approved: string[]) {
    const missing = manifest.scopes.filter((scope) => !approved.includes(scope));
    if (missing.length > 0) {
      throw new ConflictException(`Approve the scopes ${missing.join(', ')} to go on.`);
    }
  }

  async install(
    principal: Principal,
    request: InstallAppRequest,
    ownOrigin: string,
  ): Promise<InstalledApp> {
    const { manifest, origin } = await this.fetchManifest(request.manifestUrl, ownOrigin);
    this.ensureApproved(manifest, request.approvedScopes);
    const row = await this.database.atomic(async () => {
      const [taken] = await this.database.db
        .select({ id: apps.id })
        .from(apps)
        .where(eq(apps.key, manifest.key));
      if (taken) throw new ConflictException(`An app with the key "${manifest.key}" is installed.`);
      const clientId = await this.oauth.createAppClient(
        manifest.name,
        `App${manifest.vendor ? ` von ${manifest.vendor}` : ''}`,
      );
      const [inserted] = await this.database.db
        .insert(apps)
        .values({
          id: uuidv7(),
          key: manifest.key,
          manifestUrl: request.manifestUrl,
          origin,
          manifest,
          scopes: manifest.scopes,
          clientId,
          installedById: principal.userId,
        })
        .returning();
      return inserted as AppRow;
    });
    this.origins = undefined;
    await this.audit.record({
      action: 'app.installed',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'app',
      targetId: row.id,
      details: { key: manifest.key, manifestUrl: request.manifestUrl, scopes: manifest.scopes },
    });
    return installed(row);
  }

  private async row(id: string): Promise<AppRow> {
    const [row] = await this.database.db.select().from(apps).where(eq(apps.id, id));
    if (!row) throw new NotFoundException('App not found');
    return row;
  }

  /** Fetches the manifest again; more scopes than before need the admin's approval. */
  async refresh(
    principal: Principal,
    id: string,
    approvedScopes: string[],
    ownOrigin: string,
  ): Promise<InstalledApp> {
    const current = await this.row(id);
    const { manifest, origin } = await this.fetchManifest(current.manifestUrl, ownOrigin);
    if (manifest.key !== current.key) {
      throw new BadRequestException('The manifest now names another app.');
    }
    this.ensureApproved(manifest, [...current.scopes, ...approvedScopes]);
    const [row] = await this.database.db
      .update(apps)
      .set({ manifest, origin, scopes: manifest.scopes, updatedAt: sql`now()` })
      .where(eq(apps.id, id))
      .returning();
    this.origins = undefined;
    await this.audit.record({
      action: 'app.updated',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'app',
      targetId: id,
      details: { scopes: manifest.scopes },
    });
    return installed(row as AppRow);
  }

  async setEnabled(principal: Principal, id: string, enabled: boolean): Promise<InstalledApp> {
    await this.row(id);
    const [row] = await this.database.db
      .update(apps)
      .set({ enabled, updatedAt: sql`now()` })
      .where(eq(apps.id, id))
      .returning();
    this.origins = undefined;
    await this.audit.record({
      action: enabled ? 'app.enabled' : 'app.disabled',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'app',
      targetId: id,
    });
    return installed(row as AppRow);
  }

  /** Removes the app with its OAuth client, so every token it got ends at once. */
  async uninstall(principal: Principal, id: string): Promise<void> {
    const row = await this.row(id);
    await this.database.atomic(async () => {
      await this.database.db.delete(apps).where(eq(apps.id, id));
      await this.database.db.delete(oauthClients).where(eq(oauthClients.id, row.clientId));
    });
    this.origins = undefined;
    await this.audit.record({
      action: 'app.uninstalled',
      actorId: principal.userId,
      via: principal.via,
      targetType: 'app',
      targetId: id,
      details: { key: row.key },
    });
  }

  async listInstalled(): Promise<InstalledApp[]> {
    const rows = await this.database.db.select().from(apps).orderBy(apps.key);
    return rows.map(installed);
  }

  /** Enabled apps with their modules, for everyone signed in. */
  async listEnabled(): Promise<AppSummary[]> {
    const rows = await this.database.db
      .select()
      .from(apps)
      .where(eq(apps.enabled, true))
      .orderBy(apps.key);
    return rows.map(summary);
  }

  /**
   * A token for the viewer, limited to the approved scopes. Only from a signed-in browser:
   * a token or another app cannot pass its access on this way.
   */
  async token(principal: Principal, id: string): Promise<AppToken> {
    if (principal.via !== 'session') {
      throw new ForbiddenException('Only a signed-in browser can hand an app a token.');
    }
    const row = await this.row(id);
    if (!row.enabled) throw new NotFoundException('App not found');
    if (row.scopes.length === 0) throw new ForbiddenException('This app uses no API access.');
    const access = await this.oauth.appAccess(
      row.clientId,
      principal.userId,
      row.scopes,
      TOKEN_SECONDS,
    );
    return { ...access, scopes: row.scopes as TokenScope[] };
  }
}
