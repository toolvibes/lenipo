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
} from '@nestjs/common';
import {
  CreatePermissionSchemeRequest,
  PermissionScheme,
  PermissionSchemeSummary,
  UpdatePermissionSchemeRequest,
} from '@toolvibes/shared';
import { z } from 'zod';
import { RequireGlobal } from '../access/require-global.js';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { PermissionSchemeService } from './permission-scheme.service.js';

const SchemeId = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

/** Permission schemes for global administrators (P-PRM-02, TL-70, E-82). */
@RequireGlobal('admin')
@Controller('admin/permission-schemes')
export class PermissionSchemesController {
  constructor(@Inject(PermissionSchemeService) private readonly schemes: PermissionSchemeService) {}

  @Endpoint({
    tag: 'Administration',
    summary: 'List the permission schemes with the projects using them',
    response: z.array(PermissionSchemeSummary),
  })
  @Get()
  listPermissionSchemes(): Promise<PermissionSchemeSummary[]> {
    return this.schemes.list();
  }

  @Endpoint({
    tag: 'Administration',
    summary: 'Get a permission scheme with its grants',
    response: PermissionScheme,
  })
  @Get(':id')
  getPermissionScheme(@Param('id', SchemeId) id: string): Promise<PermissionScheme> {
    return this.schemes.get(id);
  }

  @Endpoint({
    tag: 'Administration',
    summary: 'Create a permission scheme as a copy of another (the default one if not given)',
    response: PermissionScheme,
  })
  @Post()
  @HttpCode(201)
  createPermissionScheme(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(CreatePermissionSchemeRequest) body: CreatePermissionSchemeRequest,
  ): Promise<PermissionScheme> {
    return this.schemes.create(principal, body);
  }

  @Endpoint({
    tag: 'Administration',
    summary: 'Rename a permission scheme or replace its grants',
    response: PermissionScheme,
  })
  @Patch(':id')
  updatePermissionScheme(
    @CurrentPrincipal() principal: Principal,
    @Param('id', SchemeId) id: string,
    @ValidBody(UpdatePermissionSchemeRequest) body: UpdatePermissionSchemeRequest,
  ): Promise<PermissionScheme> {
    return this.schemes.update(principal, id, body);
  }

  @Endpoint({ tag: 'Administration', summary: 'Delete a permission scheme no project uses' })
  @Delete(':id')
  @HttpCode(204)
  deletePermissionScheme(
    @CurrentPrincipal() principal: Principal,
    @Param('id', SchemeId) id: string,
  ): Promise<void> {
    return this.schemes.delete(principal, id);
  }
}
