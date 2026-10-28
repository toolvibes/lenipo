import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { GlobalPermission } from '@tasklore/shared';
import type { Request } from 'express';
import { AccessService } from './access.service.js';

export const REQUIRED_GLOBAL = 'tasklore:required-global';

/** Restricts a route to holders of a global permission. Tokens also need the `admin` scope. */
export const RequireGlobal = (permission: GlobalPermission) =>
  SetMetadata(REQUIRED_GLOBAL, permission);

@Injectable()
export class GlobalPermissionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<GlobalPermission | undefined>(
      REQUIRED_GLOBAL,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) return true;
    const principal = context.switchToHttp().getRequest<Request>().principal;
    if (!principal) return false;
    if (principal.via === 'token' && !principal.scopes.includes('admin')) {
      throw new ForbiddenException('This token lacks the admin scope');
    }
    if (!(await this.access.hasGlobal(principal.userId, permission))) {
      throw new ForbiddenException(`Requires the global permission "${permission}"`);
    }
    return true;
  }
}
