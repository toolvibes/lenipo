import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  CreateSecuritySchemeRequest,
  SecurityScheme,
  SecuritySchemeSummary,
  SetProjectSecuritySchemeRequest,
  UpdateSecuritySchemeRequest,
} from '@tasklore/shared';
import { z } from 'zod';
import { RequireGlobal } from '../access/require-global.js';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { SecuritySchemeService } from './security-scheme.service.js';

const SchemeId = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

/** Issue security schemes for global administrators (TL-13, E-94). */
@RequireGlobal('admin')
@Controller()
export class SecuritySchemesController {
  constructor(@Inject(SecuritySchemeService) private readonly schemes: SecuritySchemeService) {}

  @Endpoint({
    tag: 'Administration',
    summary: 'List the issue security schemes with the projects using them',
    response: z.array(SecuritySchemeSummary),
  })
  @Get('admin/security-schemes')
  listSecuritySchemes(): Promise<SecuritySchemeSummary[]> {
    return this.schemes.list();
  }

  @Endpoint({
    tag: 'Administration',
    summary: 'Get an issue security scheme with its levels',
    response: SecurityScheme,
  })
  @Get('admin/security-schemes/:id')
  getSecurityScheme(@Param('id', SchemeId) id: string): Promise<SecurityScheme> {
    return this.schemes.get(id);
  }

  @Endpoint({
    tag: 'Administration',
    summary: 'Create an empty issue security scheme',
    response: SecurityScheme,
  })
  @Post('admin/security-schemes')
  createSecurityScheme(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(CreateSecuritySchemeRequest) body: CreateSecuritySchemeRequest,
  ): Promise<SecurityScheme> {
    return this.schemes.create(principal, body);
  }

  @Endpoint({
    tag: 'Administration',
    summary: 'Rename an issue security scheme or replace its levels',
    description:
      'Levels with an id keep it. Removing a level that issues still use answers 409, so no issue becomes visible to everyone by accident.',
    response: SecurityScheme,
  })
  @Patch('admin/security-schemes/:id')
  updateSecurityScheme(
    @CurrentPrincipal() principal: Principal,
    @Param('id', SchemeId) id: string,
    @ValidBody(UpdateSecuritySchemeRequest) body: UpdateSecuritySchemeRequest,
  ): Promise<SecurityScheme> {
    return this.schemes.update(principal, id, body);
  }

  @Endpoint({ tag: 'Administration', summary: 'Delete an issue security scheme no project uses' })
  @Delete('admin/security-schemes/:id')
  @HttpCode(204)
  deleteSecurityScheme(
    @CurrentPrincipal() principal: Principal,
    @Param('id', SchemeId) id: string,
  ): Promise<void> {
    return this.schemes.delete(principal, id);
  }

  @Endpoint({
    tag: 'Projects',
    summary: 'Give the project an issue security scheme, or none',
    description:
      'Requires the global permission `admin` (E-94). Answers 409 while issues use levels the new scheme lacks.',
  })
  @Put('projects/:key/security-scheme')
  @HttpCode(204)
  setSecurityScheme(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(SetProjectSecuritySchemeRequest) body: SetProjectSecuritySchemeRequest,
  ): Promise<void> {
    return this.schemes.assign(principal, key, body.schemeId);
  }
}
