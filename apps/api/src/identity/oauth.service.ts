import { createHash } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type OAuthClientInfo,
  type OAuthConsentRequest,
  type OAuthGrant,
  type OAuthSettings,
  TOKEN_SCOPES,
  type TokenScope,
} from '@tasklore/shared';
import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  oauthClients,
  oauthGrants,
  oauthTokens,
  systemSettings,
  users,
} from '../db/schema/index.js';
import { randomSecret, sha256 } from './secrets.js';

export const ACCESS_PREFIX = 'tl_oat_';
const REFRESH_PREFIX = 'tl_ort_';
const CODE_PREFIX = 'tl_oac_';
const ACCESS_SECONDS = 3600;
const REFRESH_DAYS = 30;
const CODE_SECONDS = 600;
const SETTINGS_KEY = 'oauth';

/** An OAuth error as RFC 6749 names it; the controller answers with it as JSON. */
export class OAuthError extends Error {
  constructor(
    readonly error: string,
    readonly description: string,
    readonly status = 400,
  ) {
    super(description);
  }
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

/** Redirects only back to the client's own machine or to https (E-115). */
export function allowedRedirect(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (url.hash) return false;
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
}

/** Loopback redirects may use any port (RFC 8252); everything else must match exactly. */
function sameRedirect(registered: string, given: string): boolean {
  if (registered === given) return true;
  try {
    const a = new URL(registered);
    const b = new URL(given);
    const loopback = ['127.0.0.1', 'localhost', '[::1]'];
    return (
      a.protocol === 'http:' &&
      b.protocol === 'http:' &&
      loopback.includes(a.hostname) &&
      a.hostname === b.hostname &&
      a.pathname === b.pathname &&
      a.search === b.search
    );
  } catch {
    return false;
  }
}

/** What OAuth clients may get: everything but administration (E-115). */
export const OAUTH_SCOPES: TokenScope[] = TOKEN_SCOPES.filter((scope) => scope !== 'admin');

export function parseScopes(scope: string | undefined): TokenScope[] {
  if (!scope?.trim()) return [...OAUTH_SCOPES];
  const asked = scope.split(/\s+/);
  return OAUTH_SCOPES.filter((entry) => asked.includes(entry));
}

/**
 * A small OAuth 2.1 authorization server for MCP clients (TL-69, E-115): open registration of
 * public clients, authorization code with PKCE S256 and consent, opaque access tokens for an
 * hour and refresh tokens for 30 days that rotate; reusing an old one revokes the grant.
 */
@Injectable()
export class OAuthService {
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  async settings(): Promise<OAuthSettings> {
    const [row] = await this.database.db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, SETTINGS_KEY));
    return { registrationOpen: true, ...(row?.value as Partial<OAuthSettings> | undefined) };
  }

  async setSettings(settings: OAuthSettings): Promise<OAuthSettings> {
    await this.database.db
      .insert(systemSettings)
      .values({ key: SETTINGS_KEY, value: settings })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: settings, updatedAt: new Date() },
      });
    return settings;
  }

  // ---------------------------------------------------------------- registration

  async register(body: Record<string, unknown>) {
    if (!(await this.settings()).registrationOpen) {
      throw new OAuthError('access_denied', 'Client registration is switched off', 403);
    }
    const uris = body.redirect_uris;
    if (
      !Array.isArray(uris) ||
      uris.length === 0 ||
      uris.length > 10 ||
      !uris.every((uri) => typeof uri === 'string' && uri.length <= 2_000 && allowedRedirect(uri))
    ) {
      throw new OAuthError(
        'invalid_redirect_uri',
        'Redirect URIs must be https or point to this machine (127.0.0.1, localhost)',
      );
    }
    if (body.token_endpoint_auth_method && body.token_endpoint_auth_method !== 'none') {
      throw new OAuthError('invalid_client_metadata', 'Only public clients are supported');
    }
    const name =
      typeof body.client_name === 'string' && body.client_name.trim()
        ? body.client_name.trim().slice(0, 100)
        : 'MCP client';
    const id = uuidv7();
    await this.database.db
      .insert(oauthClients)
      .values({ id, name, redirectUris: uris as string[] });
    return {
      client_id: id,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: name,
      redirect_uris: uris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };
  }

  private async client(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const [row] = await this.database.db.select().from(oauthClients).where(eq(oauthClients.id, id));
    return row ?? null;
  }

  /** What the consent page shows; unknown clients and redirects are never redirected to. */
  async describe(clientId: string, redirectUri: string, scope?: string): Promise<OAuthClientInfo> {
    const client = await this.client(clientId);
    if (!client) throw new NotFoundException('Unknown client');
    if (!client.redirectUris.some((uri) => sameRedirect(uri, redirectUri))) {
      throw new NotFoundException('This redirect URI is not registered for the client');
    }
    return {
      id: client.id,
      name: client.name,
      redirectHost: new URL(redirectUri).host,
      requestedScopes: parseScopes(scope),
    };
  }

  // ---------------------------------------------------------------- authorization

  /** After consent: a single-use code bound to the redirect and the PKCE challenge. */
  async consent(userId: string, request: OAuthConsentRequest, issuer: string): Promise<string> {
    await this.describe(request.clientId, request.redirectUri);
    const target = new URL(request.redirectUri);
    if (request.state !== undefined) target.searchParams.set('state', request.state);
    target.searchParams.set('iss', issuer);
    if (!request.approve || !request.scopes.some((scope) => OAUTH_SCOPES.includes(scope))) {
      target.searchParams.set('error', 'access_denied');
      return target.toString();
    }
    const grantId = uuidv7();
    const code = `${CODE_PREFIX}${randomSecret()}`;
    await this.database.db.transaction(async (tx) => {
      await tx.insert(oauthGrants).values({
        id: grantId,
        clientId: request.clientId,
        userId,
        scopes: OAUTH_SCOPES.filter((scope) => request.scopes.includes(scope)),
      });
      await tx.insert(oauthTokens).values({
        id: uuidv7(),
        grantId,
        kind: 'code',
        tokenHash: sha256(code),
        redirectUri: request.redirectUri,
        codeChallenge: request.codeChallenge,
        expiresAt: new Date(Date.now() + CODE_SECONDS * 1000),
      });
    });
    target.searchParams.set('code', code);
    return target.toString();
  }

  private async issue(grantId: string, scopes: string[]): Promise<TokenResponse> {
    const access = `${ACCESS_PREFIX}${randomSecret()}`;
    const refresh = `${REFRESH_PREFIX}${randomSecret()}`;
    await this.database.db.insert(oauthTokens).values([
      {
        id: uuidv7(),
        grantId,
        kind: 'access',
        tokenHash: sha256(access),
        expiresAt: new Date(Date.now() + ACCESS_SECONDS * 1000),
      },
      {
        id: uuidv7(),
        grantId,
        kind: 'refresh',
        tokenHash: sha256(refresh),
        expiresAt: new Date(Date.now() + REFRESH_DAYS * 86_400_000),
      },
    ]);
    return {
      access_token: access,
      token_type: 'Bearer',
      expires_in: ACCESS_SECONDS,
      refresh_token: refresh,
      scope: scopes.join(' '),
    };
  }

  private async revokeGrant(grantId: string): Promise<void> {
    await this.database.db
      .update(oauthGrants)
      .set({ revokedAt: sql`now()` })
      .where(and(eq(oauthGrants.id, grantId), isNull(oauthGrants.revokedAt)));
  }

  /** A stored code or refresh token with its grant; a second use revokes everything. */
  private async redeem(secret: string, kind: 'code' | 'refresh') {
    const [row] = await this.database.db
      .select({ token: oauthTokens, grant: oauthGrants })
      .from(oauthTokens)
      .innerJoin(oauthGrants, eq(oauthGrants.id, oauthTokens.grantId))
      .where(and(eq(oauthTokens.tokenHash, sha256(secret)), eq(oauthTokens.kind, kind)));
    if (!row || row.grant.revokedAt) {
      throw new OAuthError(
        'invalid_grant',
        `The ${kind === 'code' ? 'code' : 'refresh token'} is not valid`,
      );
    }
    if (row.token.usedAt) {
      // Replay: someone else may hold the secret (OAuth 2.1, section 4.3.1).
      await this.revokeGrant(row.grant.id);
      throw new OAuthError('invalid_grant', 'This was already used; the access was revoked');
    }
    if (row.token.expiresAt.getTime() < Date.now()) {
      throw new OAuthError('invalid_grant', 'Expired');
    }
    const [claimed] = await this.database.db
      .update(oauthTokens)
      .set({ usedAt: sql`now()` })
      .where(and(eq(oauthTokens.id, row.token.id), isNull(oauthTokens.usedAt)))
      .returning({ id: oauthTokens.id });
    if (!claimed) throw new OAuthError('invalid_grant', 'This was already used');
    return row;
  }

  async token(body: Record<string, unknown>): Promise<TokenResponse> {
    const grantType = String(body.grant_type ?? '');
    if (grantType === 'authorization_code') {
      const code = String(body.code ?? '');
      const verifier = String(body.code_verifier ?? '');
      if (!code || !verifier) {
        throw new OAuthError('invalid_request', 'code and code_verifier are required');
      }
      const { token, grant } = await this.redeem(code, 'code');
      if (body.client_id !== undefined && body.client_id !== grant.clientId) {
        throw new OAuthError('invalid_grant', 'The code belongs to another client');
      }
      if (body.redirect_uri !== undefined && body.redirect_uri !== token.redirectUri) {
        throw new OAuthError('invalid_grant', 'redirect_uri does not match the authorization');
      }
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      if (challenge !== token.codeChallenge) {
        await this.revokeGrant(grant.id);
        throw new OAuthError('invalid_grant', 'The code_verifier does not match');
      }
      await this.database.db
        .update(oauthClients)
        .set({ lastUsedAt: sql`now()` })
        .where(eq(oauthClients.id, grant.clientId));
      return this.issue(grant.id, grant.scopes);
    }
    if (grantType === 'refresh_token') {
      const { grant } = await this.redeem(String(body.refresh_token ?? ''), 'refresh');
      if (body.client_id !== undefined && body.client_id !== grant.clientId) {
        throw new OAuthError('invalid_grant', 'The refresh token belongs to another client');
      }
      // A narrower scope may be asked for, never a wider one.
      const scopes = body.scope
        ? parseScopes(String(body.scope)).filter((entry) => grant.scopes.includes(entry))
        : grant.scopes;
      return this.issue(grant.id, scopes);
    }
    throw new OAuthError('unsupported_grant_type', 'Use authorization_code or refresh_token');
  }

  /** RFC 7009: revoking an access or refresh token ends the whole grant; unknown ones are fine. */
  async revoke(token: string): Promise<void> {
    if (!token) return;
    const [row] = await this.database.db
      .select({ grantId: oauthTokens.grantId })
      .from(oauthTokens)
      .where(eq(oauthTokens.tokenHash, sha256(token)));
    if (row) await this.revokeGrant(row.grantId);
  }

  /** The person and scopes behind a valid access token. */
  async authenticate(
    secret: string,
  ): Promise<{ userId: string; grantId: string; scopes: TokenScope[] } | null> {
    if (!secret.startsWith(ACCESS_PREFIX)) return null;
    const [row] = await this.database.db
      .select({ grant: oauthGrants, expiresAt: oauthTokens.expiresAt, status: users.status })
      .from(oauthTokens)
      .innerJoin(oauthGrants, eq(oauthGrants.id, oauthTokens.grantId))
      .innerJoin(users, eq(users.id, oauthGrants.userId))
      .where(and(eq(oauthTokens.tokenHash, sha256(secret)), eq(oauthTokens.kind, 'access')));
    if (!row || row.grant.revokedAt || row.status !== 'active') return null;
    if (row.expiresAt.getTime() < Date.now()) return null;
    // At most once a minute, so busy agents do not write on every call.
    await this.database.db
      .update(oauthGrants)
      .set({ lastUsedAt: sql`now()` })
      .where(
        and(
          eq(oauthGrants.id, row.grant.id),
          or(
            isNull(oauthGrants.lastUsedAt),
            lt(oauthGrants.lastUsedAt, sql`now() - interval '1 minute'`),
          ),
        ),
      );
    return {
      userId: row.grant.userId,
      grantId: row.grant.id,
      scopes: row.grant.scopes as TokenScope[],
    };
  }

  // ---------------------------------------------------------------- management

  /** Grants that have tokens (not just an unused code); for one person or everyone. */
  async grants(userId?: string): Promise<OAuthGrant[]> {
    const rows = await this.database.db
      .select({ grant: oauthGrants, client: oauthClients, user: users })
      .from(oauthGrants)
      .innerJoin(oauthClients, eq(oauthClients.id, oauthGrants.clientId))
      .innerJoin(users, eq(users.id, oauthGrants.userId))
      .where(
        and(
          isNull(oauthGrants.revokedAt),
          userId ? eq(oauthGrants.userId, userId) : undefined,
          sql`exists (select 1 from ${oauthTokens} where ${oauthTokens.grantId} = ${oauthGrants.id}
            and ${oauthTokens.kind} = 'refresh' and ${oauthTokens.expiresAt} > now())`,
        ),
      )
      .orderBy(desc(oauthGrants.createdAt));
    return rows.map(({ grant, client, user }) => ({
      id: grant.id,
      client: { id: client.id, name: client.name },
      user: { id: user.id, displayName: user.displayName },
      scopes: grant.scopes as TokenScope[],
      createdAt: grant.createdAt.toISOString(),
      lastUsedAt: grant.lastUsedAt?.toISOString() ?? null,
    }));
  }

  /** Ends a grant; people can end their own, administrators any. */
  async endGrant(grantId: string, userId?: string): Promise<void> {
    const [row] = await this.database.db
      .update(oauthGrants)
      .set({ revokedAt: sql`now()` })
      .where(
        and(
          eq(oauthGrants.id, grantId),
          isNull(oauthGrants.revokedAt),
          userId ? eq(oauthGrants.userId, userId) : undefined,
        ),
      )
      .returning({ id: oauthGrants.id });
    if (!row) throw new NotFoundException('Connection not found');
  }

  /** Expired tokens, unused registrations after 30 days, ended grants after 30 days. */
  async cleanUp(): Promise<void> {
    const db = this.database.db;
    await db.delete(oauthTokens).where(lt(oauthTokens.expiresAt, sql`now() - interval '1 day'`));
    await db
      .delete(oauthGrants)
      .where(
        or(
          lt(oauthGrants.revokedAt, sql`now() - interval '30 days'`),
          and(
            lt(oauthGrants.createdAt, sql`now() - interval '1 day'`),
            sql`not exists (select 1 from ${oauthTokens} where ${oauthTokens.grantId} = ${oauthGrants.id})`,
          ),
        ),
      );
    const stale = await db
      .select({ id: oauthClients.id })
      .from(oauthClients)
      .where(
        and(
          lt(
            sql`coalesce(${oauthClients.lastUsedAt}, ${oauthClients.createdAt})`,
            sql`now() - interval '30 days'`,
          ),
          sql`not exists (select 1 from ${oauthGrants} where ${oauthGrants.clientId} = ${oauthClients.id} and ${oauthGrants.revokedAt} is null)`,
        ),
      );
    if (stale.length) {
      await db.delete(oauthClients).where(
        inArray(
          oauthClients.id,
          stale.map((row) => row.id),
        ),
      );
    }
  }
}
