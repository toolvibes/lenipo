import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ModuleName } from '@tasklore/shared';
import type { Request, Response } from 'express';
import { AccessService } from '../access/access.service.js';
import { IS_PUBLIC } from '../core/http/decorators.js';
import { OperationsService } from './operations.service.js';

const MODULE = 'tasklore:module';
const SKIP_LIMITS = 'tasklore:skip-rate-limit';
const DURING_MAINTENANCE = 'tasklore:during-maintenance';

/** Routes of a module that administrators can switch off (TL-40, E-121). */
export const RequireModule = (name: ModuleName) => SetMetadata(MODULE, name);
/** Not counted against request limits, e.g. health checks of a load balancer. */
export const SkipRateLimit = () => SetMetadata(SKIP_LIMITS, true);
/** Usable by everyone while the instance is in maintenance, e.g. signing out. */
export const AllowDuringMaintenance = () => SetMetadata(DURING_MAINTENANCE, true);

/**
 * Runs after authentication (TL-40, E-121): request limits per token, person or IP with
 * RateLimit headers, maintenance mode for everyone but administrators, and switched-off
 * modules.
 */
@Injectable()
export class OperationsGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(OperationsService) private readonly operations: OperationsService,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  private meta<T>(context: ExecutionContext, key: string): T | undefined {
    return this.reflector.getAllAndOverride<T>(key, [context.getHandler(), context.getClass()]);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const snapshot = await this.operations.snapshot();
    const principal = request.principal;

    if (this.operations.config.RATE_LIMITS && !this.meta<boolean>(context, SKIP_LIMITS)) {
      const limits = snapshot.rateLimits;
      let key: string;
      let limit: number;
      let perDay: number | null = null;
      if (principal && 'tokenId' in principal) {
        const own = snapshot.tokenLimits.get(principal.tokenId);
        key = `t:${principal.tokenId}`;
        limit = own?.perMinute ?? limits.tokens;
        perDay = own?.perDay ?? null;
      } else if (principal) {
        key = `u:${principal.userId}`;
        limit = limits.people;
      } else {
        key = `ip:${request.ip ?? 'unknown'}`;
        limit = limits.anonymous;
      }
      const hits = await this.operations.counter.hit(key, 60);
      const reset = 60 - (Math.floor(Date.now() / 1000) % 60);
      response.setHeader('RateLimit-Limit', String(limit));
      response.setHeader('RateLimit-Remaining', String(Math.max(0, limit - hits)));
      response.setHeader('RateLimit-Reset', String(reset));
      if (hits > limit) {
        response.setHeader('Retry-After', String(reset));
        throw new HttpException(
          {
            message: `Too many requests; at most ${limit} per minute`,
            type: 'urn:tasklore:problem:rate-limit',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (perDay !== null && principal && 'tokenId' in principal) {
        if (!(await this.operations.withinDailyQuota(principal.tokenId, perDay))) {
          const midnight = new Date();
          midnight.setUTCHours(24, 0, 0, 0);
          response.setHeader(
            'Retry-After',
            String(Math.ceil((midnight.getTime() - Date.now()) / 1000)),
          );
          throw new HttpException(
            {
              message: `This token's daily quota of ${perDay} requests is used up`,
              type: 'urn:tasklore:problem:quota',
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
    }

    if (
      snapshot.maintenance.enabled &&
      principal &&
      !this.meta<boolean>(context, IS_PUBLIC) &&
      !this.meta<boolean>(context, DURING_MAINTENANCE) &&
      !(await this.access.hasGlobal(principal.userId, 'admin'))
    ) {
      throw new HttpException(
        {
          message: snapshot.maintenance.message || 'Tasklore is being maintained',
          type: 'urn:tasklore:problem:maintenance',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const module = this.meta<ModuleName>(context, MODULE);
    if (module && !snapshot.modules[module]) {
      throw new NotFoundException({
        message: `The module "${module}" is switched off`,
        type: 'urn:tasklore:problem:module-disabled',
      });
    }
    return true;
  }
}
