import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC } from '../core/http/decorators.js';
import type { Principal } from '../core/http/principal.js';
import { isCrossSiteWrite } from './request-guards.js';
import { readCookie, SESSION_COOKIE } from './secrets.js';
import { SessionService } from './session.service.js';
import { TokenService } from './token.service.js';

/** Resolves the principal for every request and rejects unauthenticated access to non-public routes. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(TokenService) private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (isCrossSiteWrite(request)) {
      throw new ForbiddenException('Cross-site request rejected');
    }

    request.principal = await this.resolve(request);
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isPublic && !request.principal) {
      throw new UnauthorizedException('Authentication required');
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
      const token = await this.tokens.authenticate(secret);
      if (!token) throw new UnauthorizedException('Invalid or expired token');
      return { userId: token.userId, via: 'token', tokenId: token.tokenId, scopes: token.scopes };
    }
    const secret = readCookie(request.get('cookie'), SESSION_COOKIE);
    if (!secret) return undefined;
    const session = await this.sessions.authenticate(secret);
    return session
      ? { userId: session.userId, via: 'session', sessionId: session.sessionId }
      : undefined;
  }
}
