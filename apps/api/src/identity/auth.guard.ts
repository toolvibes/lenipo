import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { IS_PUBLIC } from '../core/http/decorators.js';
import type { Principal } from '../core/http/principal.js';
import { ALLOW_CROSS_SITE } from './oauth.controller.js';
import { ACCESS_PREFIX, OAuthService } from './oauth.service.js';
import { isCrossSiteWrite } from './request-guards.js';
import { hasPrefix, readSessionCookie } from './secrets.js';
import { SessionService } from './session.service.js';
import { TokenService } from './token.service.js';

/** Resolves the principal for every request and rejects unauthenticated access to non-public routes. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(OAuthService) private readonly oauth: OAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const crossSiteAllowed = this.reflector.getAllAndOverride<boolean>(ALLOW_CROSS_SITE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!crossSiteAllowed && isCrossSiteWrite(request)) {
      throw new ForbiddenException('Cross-site request rejected');
    }

    // MCP clients learn from the 401 where to sign in (MCP authorization, RFC 9728; E-115).
    const challenge = (error?: string) => {
      if (!request.path.startsWith('/mcp')) return;
      const base = `${request.protocol}://${request.get('host')}`;
      context
        .switchToHttp()
        .getResponse<Response>()
        .set(
          'WWW-Authenticate',
          `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource/mcp"${error ? `, error="${error}"` : ''}`,
        );
    };
    // On public routes, credentials that are not Lenipo tokens belong to the route itself:
    // Basic for OAuth clients (RFC 6749), a hook secret as Bearer (TL-41). They sign no one in.
    const authorization = request.get('authorization') ?? '';
    const foreignOnPublic =
      authorization !== '' &&
      !/^bearer\s+(lp|tl)_/i.test(authorization) &&
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ]);
    try {
      request.principal = foreignOnPublic ? undefined : await this.resolve(request);
    } catch (error) {
      if (error instanceof UnauthorizedException) challenge('invalid_token');
      throw error;
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isPublic && !request.principal) {
      challenge();
      throw new UnauthorizedException('Authentication required');
    }
    // A sign-in waiting for its second factor (or its setup) reaches only the routes for that.
    const principal = request.principal;
    if (
      !isPublic &&
      principal?.via === 'session' &&
      principal.stage &&
      principal.stage !== 'full'
    ) {
      const allowed =
        this.reflector.getAllAndOverride<string[]>(PARTIAL_SESSION, [
          context.getHandler(),
          context.getClass(),
        ]) ?? [];
      if (!allowed.includes(principal.stage)) {
        throw new ForbiddenException({
          message:
            principal.stage === 'second-factor'
              ? 'Enter the code from your authenticator app first'
              : 'Set up two-factor sign-in first',
          type: 'urn:lenipo:problem:two-factor',
        });
      }
    }
    return true;
  }

  private async resolve(request: Request): Promise<Principal | undefined> {
    const authorization = request.get('authorization');
    if (authorization) {
      const [scheme, secret] = authorization.split(' ');
      if (scheme?.toLowerCase() !== 'bearer' || !secret) {
        throw new UnauthorizedException('Unsupported authorization scheme');
      }
      if (hasPrefix(secret, ACCESS_PREFIX)) {
        const access = await this.oauth.authenticate(secret);
        if (!access) throw new UnauthorizedException('Invalid or expired token');
        return {
          userId: access.userId,
          via: 'token',
          tokenId: access.grantId,
          scopes: access.scopes,
        };
      }
      const token = await this.tokens.authenticate(secret);
      if (!token) throw new UnauthorizedException('Invalid or expired token');
      return { userId: token.userId, via: 'token', tokenId: token.tokenId, scopes: token.scopes };
    }
    const secret = readSessionCookie(request.get('cookie'));
    if (!secret) return undefined;
    const session = await this.sessions.authenticate(secret);
    return session
      ? {
          userId: session.userId,
          via: 'session',
          sessionId: session.sessionId,
          stage: session.stage,
        }
      : undefined;
  }
}

/** Session stages, besides a full one, that may use a route (TL-18, E-100). */
export const PARTIAL_SESSION = 'lenipo:partial-session';
export const AllowPartialSession = (...stages: Array<'second-factor' | 'setup-2fa'>) =>
  SetMetadata(PARTIAL_SESSION, stages);
