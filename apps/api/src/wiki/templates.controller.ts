import { Controller, Delete, Get, HttpCode, Inject, Param, Post, Put } from '@nestjs/common';
import { PageTemplate, PageTemplateSummary, SavePageTemplateRequest } from '@toolvibes/shared';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { RequireModule } from '../operations/operations.guard.js';
import { TemplateService } from './template.service.js';

/** Page templates and blueprints (W-TPL-01, -03, E-72). */
@RequireModule('wiki')
@Controller()
export class TemplatesController {
  constructor(@Inject(TemplateService) private readonly templates: TemplateService) {}

  @Endpoint({
    tag: 'Templates',
    summary: 'Templates offered when creating a page in a space',
    description: 'Blueprints first, then the space’s own templates, then global ones.',
    response: z.array(PageTemplateSummary),
  })
  @Get('spaces/:key/templates')
  forSpace(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<PageTemplateSummary[]> {
    return this.templates.forSpace(principal, key);
  }

  @Endpoint({
    tag: 'Templates',
    summary: 'Create a template of a space',
    description: 'Needs the space administration.',
    response: PageTemplate,
  })
  @Post('spaces/:key/templates')
  createInSpace(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(SavePageTemplateRequest) body: SavePageTemplateRequest,
  ): Promise<PageTemplate> {
    return this.templates.create(principal, key, body);
  }

  @Endpoint({
    tag: 'Templates',
    summary: 'Blueprints and global templates',
    response: z.array(PageTemplateSummary),
  })
  @Get('page-templates')
  global(@CurrentPrincipal() principal: Principal): Promise<PageTemplateSummary[]> {
    return this.templates.global(principal);
  }

  @Endpoint({
    tag: 'Templates',
    summary: 'Create a global template',
    description: 'Needs the global permission "admin".',
    response: PageTemplate,
  })
  @Post('page-templates')
  createGlobal(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(SavePageTemplateRequest) body: SavePageTemplateRequest,
  ): Promise<PageTemplate> {
    return this.templates.create(principal, null, body);
  }

  @Endpoint({
    tag: 'Templates',
    summary: 'Get a template or blueprint with its content',
    description: 'Takes a template id or `blueprint:<key>`.',
    response: PageTemplate,
  })
  @Get('page-templates/:ref')
  get(@CurrentPrincipal() principal: Principal, @Param('ref') ref: string): Promise<PageTemplate> {
    return this.templates.get(principal, ref);
  }

  @Endpoint({ tag: 'Templates', summary: 'Change a template', response: PageTemplate })
  @Put('page-templates/:id')
  update(
    @CurrentPrincipal() principal: Principal,
    @Param('id') id: string,
    @ValidBody(SavePageTemplateRequest) body: SavePageTemplateRequest,
  ): Promise<PageTemplate> {
    return this.templates.update(principal, id, body);
  }

  @Endpoint({ tag: 'Templates', summary: 'Delete a template' })
  @Delete('page-templates/:id')
  @HttpCode(204)
  delete(@CurrentPrincipal() principal: Principal, @Param('id') id: string): Promise<void> {
    return this.templates.delete(principal, id);
  }
}
