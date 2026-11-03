import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  PrintTemplate,
  PrintTemplateInput,
  PrintTemplateSummary,
  SpacePrintTemplateRequest,
} from '@toolvibes/shared';
import { z } from 'zod';
import { RequireGlobal } from '../access/require-global.js';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { PrintTemplateService } from './print-template.service.js';

const TemplateId = new ParseUUIDPipe({ errorHttpStatusCode: 404 });
const SpacePrintTemplate = z
  .object({ template: PrintTemplate.nullable(), own: z.boolean() })
  .meta({ id: 'SpacePrintTemplate' });

/** Print templates for everyone who prints, and per space (TL-53, E-142). */
@Controller()
export class PrintTemplatesController {
  constructor(@Inject(PrintTemplateService) private readonly templates: PrintTemplateService) {}

  @Endpoint({
    tag: 'Wiki',
    summary: 'List print templates',
    response: z.array(PrintTemplateSummary),
  })
  @Get('print-templates')
  listPrintTemplates(): Promise<PrintTemplateSummary[]> {
    return this.templates.list();
  }

  @Endpoint({ tag: 'Wiki', summary: 'Get a print template', response: PrintTemplate })
  @Get('print-templates/:id')
  getPrintTemplate(@Param('id', TemplateId) id: string): Promise<PrintTemplate> {
    return this.templates.get(id);
  }

  @Endpoint({
    tag: 'Wiki',
    summary: 'The print template of a space: its own or the default',
    response: SpacePrintTemplate,
  })
  @Get('spaces/:key/print-template')
  spacePrintTemplate(@CurrentPrincipal() principal: Principal, @Param('key') key: string) {
    return this.templates.forSpace(principal, key);
  }

  @Endpoint({
    tag: 'Wiki',
    summary: 'Choose the print template of a space; null: the default',
    response: SpacePrintTemplate,
  })
  @Put('spaces/:key/print-template')
  setSpacePrintTemplate(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(SpacePrintTemplateRequest) body: SpacePrintTemplateRequest,
  ) {
    return this.templates.setForSpace(principal, key, body.templateId);
  }
}

@RequireGlobal('admin')
@Controller('admin/print-templates')
export class PrintTemplatesAdminController {
  constructor(@Inject(PrintTemplateService) private readonly templates: PrintTemplateService) {}

  @Endpoint({ tag: 'Admin', summary: 'Create a print template', response: PrintTemplate })
  @Post()
  createPrintTemplate(
    @ValidBody(PrintTemplateInput) body: PrintTemplateInput,
  ): Promise<PrintTemplate> {
    return this.templates.create(body);
  }

  @Endpoint({ tag: 'Admin', summary: 'Change a print template', response: PrintTemplate })
  @Put(':id')
  updatePrintTemplate(
    @Param('id', TemplateId) id: string,
    @ValidBody(PrintTemplateInput) body: PrintTemplateInput,
  ): Promise<PrintTemplate> {
    return this.templates.update(id, body);
  }

  @Endpoint({ tag: 'Admin', summary: 'Delete a print template' })
  @Delete(':id')
  @HttpCode(204)
  deletePrintTemplate(@Param('id', TemplateId) id: string): Promise<void> {
    return this.templates.remove(id);
  }
}
