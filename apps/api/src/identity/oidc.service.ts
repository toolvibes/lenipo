import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, eq, gt, sql } from 'drizzle-orm';
import * as oidc from 'openid-client';
import { v7 as uuidv7 } from 'uuid';
import { AuditService } from '../audit/audit.service.js';
import { type AppConfig, oidcEnabled } from '../core/config.js';
import type { Logger } from '../core/logger.js';
import { CONFIG, DATABASE, LOGGER } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import { groupMembers, oidcLoginAttempts, userIdentities, users } from '../db/schema/index.js';
import { GroupService, USERS_GROUP } from './group.service.js';
import { sha256 } from './secrets.js';

const ATTEMPT_LIFETIME_MS = 10 * 60 * 1000;

/** The claims Tasklore uses from an ID token. */
export interface OidcClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  [claim: string]: unknown;
}

export class OidcSignInError extends Error {}

/** OpenID Connect sign-in: authorization code flow with PKCE, state and nonce. */
@Injectable()
export class OidcService {
  private configuration: Promise<oidc.Configuration> | undefined;

  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(GroupService) private readonly groupService: GroupService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  get enabled(): boolean {
    return oidcEnabled(this.config);
  }

  get redirectUri(): string {
    return new URL('/api/v1/auth/oidc/callback', this.config.PUBLIC_URL).toString();
  }

  /** Provider metadata, discovered once and cached; a failed discovery is retried on the next call. */
  private discover(): Promise<oidc.Configuration> {
    if (!this.enabled || !this.config.OIDC_ISSUER_URL || !this.config.OIDC_CLIENT_ID) {
      throw new ServiceUnavailableException('OIDC sign-in is not configured');
    }
    const issuer = new URL(this.config.OIDC_ISSUER_URL);
    // Plain HTTP only outside production (a local Keycloak); production requires TLS.
    const insecure = issuer.protocol === 'http:' && this.config.NODE_ENV !== 'production';
    this.configuration ??= oidc
      .discovery(
        issuer,
        this.config.OIDC_CLIENT_ID,
        undefined,
        this.config.OIDC_CLIENT_SECRET
          ? oidc.ClientSecretPost(this.config.OIDC_CLIENT_SECRET)
          : oidc.None(),
        insecure ? { execute: [oidc.allowInsecureRequests] } : undefined,
      )
      .catch((error: unknown) => {
        this.configuration = undefined;
        this.logger.error({ err: error }, 'OIDC discovery failed');
        throw new ServiceUnavailableException('The identity provider is not reachable');
      });
    return this.configuration;
  }

  /** Starts a sign-in and returns the provider URL to redirect the browser to. */
  async start(redirectTo: string): Promise<URL> {
    const configuration = await this.discover();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    await this.database.db
      .delete(oidcLoginAttempts)
      .where(sql`${oidcLoginAttempts.expiresAt} < now()`);
    await this.database.db.insert(oidcLoginAttempts).values({
      stateHash: sha256(state),
      codeVerifier,
      nonce,
      redirectTo,
      expiresAt: new Date(Date.now() + ATTEMPT_LIFETIME_MS),
    });
    return oidc.buildAuthorizationUrl(configuration, {
      redirect_uri: this.redirectUri,
      scope: this.config.OIDC_SCOPES,
      state,
      nonce,
      code_challenge: await oidc.calculatePKCECodeChallenge(codeVerifier),
      code_challenge_method: 'S256',
    });
  }

  /** Completes a sign-in from the callback URL. Returns the user and where to send the browser. */
  async complete(
    callbackUrl: URL,
    ip: string | null,
  ): Promise<{ userId: string; redirectTo: string }> {
    const configuration = await this.discover();
    const state = callbackUrl.searchParams.get('state');
    if (!state) throw new OidcSignInError('Callback without state');
    // Consumed atomically: a replayed callback finds nothing.
    const [attempt] = await this.database.db
      .delete(oidcLoginAttempts)
      .where(
        and(
          eq(oidcLoginAttempts.stateHash, sha256(state)),
          gt(oidcLoginAttempts.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!attempt) throw new OidcSignInError('Unknown or expired sign-in attempt');

    const tokens = await oidc.authorizationCodeGrant(configuration, callbackUrl, {
      pkceCodeVerifier: attempt.codeVerifier,
      expectedState: state,
      expectedNonce: attempt.nonce,
      idTokenExpected: true,
    });
    const claims = tokens.claims() as OidcClaims | undefined;
    if (!claims?.sub) throw new OidcSignInError('ID token without subject');
    const userId = await this.resolveUser(configuration.serverMetadata().issuer, claims, ip);
    return { userId, redirectTo: attempt.redirectTo };
  }

  /**
   * Maps an external identity to a Tasklore user: an existing link first, then an account with the
   * same verified email, otherwise a new account. Unverified emails never take over an account.
   */
  async resolveUser(issuer: string, claims: OidcClaims, ip: string | null): Promise<string> {
    const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : undefined;
    const displayName = String(
      claims.name ?? claims.preferred_username ?? email ?? claims.sub,
    ).slice(0, 120);
    const groupNames = this.groupClaim(claims);

    const result = await this.database.db.transaction(async (tx) => {
      const [linked] = await tx
        .select({ userId: userIdentities.userId, status: users.status })
        .from(userIdentities)
        .innerJoin(users, eq(users.id, userIdentities.userId))
        .where(and(eq(userIdentities.issuer, issuer), eq(userIdentities.subject, claims.sub)));
      let userId = linked?.userId;
      let status = linked?.status;
      let event: 'linked' | 'created' | undefined;

      if (!userId && email && claims.email_verified === true) {
        const [existing] = await tx
          .select({ id: users.id, status: users.status })
          .from(users)
          .where(eq(users.email, email));
        if (existing) {
          userId = existing.id;
          status = existing.status;
          event = 'linked';
        }
      }
      if (!userId) {
        if (!this.config.OIDC_AUTO_CREATE_USERS) {
          throw new ForbiddenException('No Tasklore account exists for this identity');
        }
        if (!email) throw new OidcSignInError('The identity provider sent no email address');
        const [taken] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
        if (taken) {
          // Never attach an unverified address to an existing account.
          throw new ForbiddenException(
            'An account with this email exists, but the identity provider did not verify the address',
          );
        }
        userId = uuidv7();
        status = 'active';
        event = 'created';
        await tx.insert(users).values({ id: userId, email, displayName, passwordHash: null });
        const defaultGroups = await this.groupService.existingIds([USERS_GROUP], tx);
        if (defaultGroups.length > 0) {
          await tx
            .insert(groupMembers)
            .values(defaultGroups.map((groupId) => ({ groupId, userId: userId as string })));
        }
      }
      if (status !== 'active') {
        throw new ForbiddenException('This account is deactivated');
      }
      if (event) {
        await tx
          .insert(userIdentities)
          .values({ issuer, subject: claims.sub, userId, email: email ?? null });
      }
      await tx
        .update(userIdentities)
        .set({ lastLoginAt: sql`now()`, email: email ?? null })
        .where(and(eq(userIdentities.issuer, issuer), eq(userIdentities.subject, claims.sub)));
      if (groupNames.length > 0) {
        const ids = await this.groupService.existingIds(groupNames, tx);
        if (ids.length > 0) {
          await tx
            .insert(groupMembers)
            .values(ids.map((groupId) => ({ groupId, userId: userId as string })))
            .onConflictDoNothing();
        }
      }
      return { userId, event };
    });

    if (result.event) {
      await this.audit.record({
        action: result.event === 'created' ? 'user.created' : 'user.identity_linked',
        actorId: result.userId,
        via: 'oidc',
        targetType: 'user',
        targetId: result.userId,
        ip,
        details: { issuer, subject: claims.sub },
      });
    }
    return result.userId;
  }

  private groupClaim(claims: OidcClaims): string[] {
    if (!this.config.OIDC_GROUPS_CLAIM) return [];
    const value = claims[this.config.OIDC_GROUPS_CLAIM];
    const names = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    // Keycloak sends full paths like "/team-plattform"; Tasklore group names have no slashes.
    return names
      .filter((name): name is string => typeof name === 'string')
      .map((name) => name.replace(/^.*\//, ''));
  }
}
