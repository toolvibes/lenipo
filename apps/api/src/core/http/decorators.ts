import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { z } from 'zod';
import type { Principal } from './principal.js';

export const IS_PUBLIC = 'tasklore:public';

/** Marks a route as reachable without authentication. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

const ParsedBody = createParamDecorator((data: { zod: z.ZodType }, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return data.zod.parse(request.body ?? {});
});

/**
 * Parses the request body with a Zod schema; failures become a 400 problem response.
 * The schema is wrapped because Nest treats an argument with a `transform` method as a pipe and
 * `{ schema }` as its own Standard Schema option; we want Zod's output and our problem format.
 */
export const ValidBody = (schema: z.ZodType) => ParsedBody({ zod: schema });

/** The authenticated principal; only on routes that are not @Public(). */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Principal => {
    const principal = ctx.switchToHttp().getRequest<Request>().principal;
    if (!principal) {
      throw new UnauthorizedException('Authentication required');
    }
    return principal;
  },
);
