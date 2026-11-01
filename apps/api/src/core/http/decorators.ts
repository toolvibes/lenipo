import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { z } from 'zod';
import { registerBodySchema, registerQuerySchema } from './endpoint.js';
import type { Principal } from './principal.js';

export const IS_PUBLIC = 'lenipo:public';

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
export const ValidBody =
  (schema: z.ZodType): ParameterDecorator =>
  (target, key, index) => {
    registerBodySchema(target.constructor, String(key), schema);
    ParsedBody({ zod: schema })(target, key, index);
  };

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

const ParsedQuery = createParamDecorator((data: { zod: z.ZodType }, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return data.zod.parse(request.query ?? {});
});

/** Parses query parameters with a Zod object schema (documented in OpenAPI as query parameters). */
export const ValidQuery =
  (schema: z.ZodObject): ParameterDecorator =>
  (target, key, index) => {
    registerQuerySchema(target.constructor, String(key), schema);
    ParsedQuery({ zod: schema })(target, key, index);
  };
