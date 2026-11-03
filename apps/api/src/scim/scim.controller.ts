import {
  type ArgumentsHost,
  Body,
  type CanActivate,
  Catch,
  Controller,
  Delete,
  type ExceptionFilter,
  type ExecutionContext,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { CreatedScimToken, CreateScimTokenRequest, ScimToken } from '@toolvibes/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { RequireGlobal } from '../access/require-global.js';
import { CurrentPrincipal, Public, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { toProblem } from '../core/http/problem.filter.js';
import { GROUP_SCHEMA, ScimError, ScimService, USER_SCHEMA } from './scim.service.js';

export const SCIM_PATH = 'scim/v2';
const ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';

/** Only SCIM tokens open /scim/v2; personal tokens and sessions do not. */
@Injectable()
export class ScimGuard implements CanActivate {
  constructor(@Inject(ScimService) private readonly scim: ScimService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, secret] = (request.get('authorization') ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !secret || !(await this.scim.authenticate(secret))) {
      throw new ScimError(401, 'A valid SCIM token is required');
    }
    return true;
  }
}

/** Errors as SCIM error messages (RFC 7644, 3.12). */
@Catch()
export class ScimErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    let status: number;
    let detail: string;
    let scimType: string | undefined;
    if (exception instanceof ScimError) {
      ({ status, scimType } = exception);
      detail = exception.message;
    } else if (exception instanceof UnauthorizedException) {
      status = 401;
      detail = 'A valid SCIM token is required';
    } else {
      const problem = toProblem(exception);
      status = problem.status;
      detail = problem.detail ?? problem.title;
    }
    response
      .status(status)
      .type('application/scim+json')
      .json({
        schemas: [ERROR_SCHEMA],
        status: String(status),
        detail,
        ...(scimType ? { scimType } : {}),
      });
  }
}

function baseOf(request: Request): string {
  return `${request.protocol}://${request.get('host')}/${SCIM_PATH}`;
}

const page = (query: Record<string, string | undefined>) => ({
  startIndex: Math.max(1, Number(query.startIndex) || 1),
  count: Math.max(0, Number(query.count ?? 100) || 0),
});

/**
 * SCIM 2.0 for identity providers (TL-52, E-141). Outside /api/v1 and the OpenAPI document:
 * its shapes are the standard's. Answers in application/scim+json.
 */
@Public()
@UseGuards(ScimGuard)
@UseFilters(ScimErrorFilter)
@Controller(SCIM_PATH)
export class ScimController {
  constructor(@Inject(ScimService) private readonly scim: ScimService) {}

  @Get('ServiceProviderConfig')
  serviceProviderConfig() {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        {
          type: 'oauthbearertoken',
          name: 'Bearer token',
          description: 'A SCIM token from Administration → SCIM',
          primary: true,
        },
      ],
    };
  }

  @Get('ResourceTypes')
  resourceTypes(@Req() request: Request) {
    const base = baseOf(request);
    const types = [
      { id: 'User', name: 'User', endpoint: '/Users', schema: USER_SCHEMA },
      { id: 'Group', name: 'Group', endpoint: '/Groups', schema: GROUP_SCHEMA },
    ].map((type) => ({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
      ...type,
      meta: { resourceType: 'ResourceType', location: `${base}/ResourceTypes/${type.id}` },
    }));
    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: types.length,
      Resources: types,
    };
  }

  @Get('Schemas')
  schemas() {
    const attribute = (name: string, type = 'string', extra: Record<string, unknown> = {}) => ({
      name,
      type,
      multiValued: false,
      required: false,
      mutability: 'readWrite',
      returned: 'default',
      ...extra,
    });
    const resources = [
      {
        id: USER_SCHEMA,
        name: 'User',
        attributes: [
          attribute('userName', 'string', { required: true, uniqueness: 'server' }),
          attribute('displayName'),
          attribute('name', 'complex'),
          attribute('emails', 'complex', { multiValued: true }),
          attribute('active', 'boolean'),
          attribute('externalId'),
        ],
      },
      {
        id: GROUP_SCHEMA,
        name: 'Group',
        attributes: [
          attribute('displayName', 'string', { required: true, uniqueness: 'server' }),
          attribute('members', 'complex', { multiValued: true }),
          attribute('externalId'),
        ],
      },
    ];
    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: resources.length,
      Resources: resources,
    };
  }

  @Get('Users')
  listUsers(@Req() request: Request, @Query() query: Record<string, string | undefined>) {
    const { startIndex, count } = page(query);
    return this.scim.listUsers(baseOf(request), query.filter, startIndex, count);
  }

  @Get('Users/:id')
  getUser(@Req() request: Request, @Param('id') id: string) {
    return this.scim.getUser(baseOf(request), id);
  }

  @Post('Users')
  @HttpCode(201)
  createUser(@Req() request: Request, @Body() body: unknown) {
    return this.scim.createUser(baseOf(request), body);
  }

  @Put('Users/:id')
  replaceUser(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.scim.replaceUser(baseOf(request), id, body);
  }

  @Patch('Users/:id')
  patchUser(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.scim.patchUser(baseOf(request), id, body);
  }

  @Delete('Users/:id')
  @HttpCode(204)
  deleteUser(@Req() request: Request, @Param('id') id: string): Promise<void> {
    return this.scim.deleteUser(baseOf(request), id);
  }

  @Get('Groups')
  listGroups(@Req() request: Request, @Query() query: Record<string, string | undefined>) {
    const { startIndex, count } = page(query);
    return this.scim.listGroups(baseOf(request), query.filter, startIndex, count);
  }

  @Get('Groups/:id')
  getGroup(@Req() request: Request, @Param('id') id: string) {
    return this.scim.getGroup(baseOf(request), id);
  }

  @Post('Groups')
  @HttpCode(201)
  createGroup(@Req() request: Request, @Body() body: unknown) {
    return this.scim.createGroup(baseOf(request), body);
  }

  @Put('Groups/:id')
  replaceGroup(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.scim.replaceGroup(baseOf(request), id, body);
  }

  @Patch('Groups/:id')
  patchGroup(@Req() request: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.scim.patchGroup(baseOf(request), id, body);
  }

  @Delete('Groups/:id')
  @HttpCode(204)
  deleteGroup(@Param('id') id: string): Promise<void> {
    return this.scim.deleteGroup(id);
  }
}

/** SCIM tokens for identity providers (TL-52, E-141). */
@RequireGlobal('admin')
@Controller('admin/scim-tokens')
export class ScimTokensController {
  constructor(@Inject(ScimService) private readonly scim: ScimService) {}

  @Endpoint({ tag: 'Admin', summary: 'List SCIM tokens', response: z.array(ScimToken) })
  @Get()
  listScimTokens(): Promise<ScimToken[]> {
    return this.scim.tokens();
  }

  @Endpoint({
    tag: 'Admin',
    summary: 'Create a SCIM token for an identity provider; the secret is shown once',
    response: CreatedScimToken,
  })
  @Post()
  createScimToken(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(CreateScimTokenRequest) body: CreateScimTokenRequest,
  ): Promise<CreatedScimToken> {
    return this.scim.createToken(principal, body.name);
  }

  @Endpoint({ tag: 'Admin', summary: 'Revoke a SCIM token' })
  @Delete(':id')
  @HttpCode(204)
  revokeScimToken(
    @CurrentPrincipal() principal: Principal,
    @Param('id') id: string,
  ): Promise<void> {
    return this.scim.revokeToken(principal, id);
  }
}
