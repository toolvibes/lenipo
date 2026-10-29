import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateCustomFieldRequest, CustomField, UpdateCustomFieldRequest } from '@tasklore/shared';
import { z } from 'zod';
import { RequireGlobal } from '../access/require-global.js';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { CustomFieldService } from './custom-field.service.js';

/** Instance-wide custom fields (T-FLD-01, E-50); projects switch them on themselves. */
@RequireGlobal('admin')
@Controller('admin/custom-fields')
export class CustomFieldsController {
  constructor(@Inject(CustomFieldService) private readonly fields: CustomFieldService) {}

  @Endpoint({
    tag: 'Admin',
    summary: 'List custom fields, archived ones included',
    response: z.array(CustomField),
  })
  @Get()
  list(): Promise<CustomField[]> {
    return this.fields.list();
  }

  @Endpoint({
    tag: 'Admin',
    summary: 'Create a custom field',
    description:
      'Names are unique without regard to case and must not be a system field, TQL function or keyword.',
    response: CustomField,
  })
  @Post()
  @HttpCode(201)
  create(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(CreateCustomFieldRequest) body: CreateCustomFieldRequest,
  ): Promise<CustomField> {
    return this.fields.create(principal, body);
  }

  @Endpoint({
    tag: 'Admin',
    summary: 'Change, archive or restore a custom field',
    description:
      'Options are given as the full list; entries with an id are renamed or archived, entries without one are added, missing ones are archived.',
    response: CustomField,
  })
  @Patch(':id')
  update(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @ValidBody(UpdateCustomFieldRequest) body: UpdateCustomFieldRequest,
  ): Promise<CustomField> {
    return this.fields.update(principal, id, body);
  }
}
