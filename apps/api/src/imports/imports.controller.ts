import { Controller, Get, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ImportJob, JiraImportRequest } from '@tasklore/shared';
import { z } from 'zod';
import { RequireGlobal } from '../access/require-global.js';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { ImportService } from './import.service.js';

/** Imports from Jira and Confluence (TL-35, E-118), for administrators. */
@RequireGlobal('admin')
@Controller('admin/imports')
export class ImportsController {
  constructor(@Inject(ImportService) private readonly imports: ImportService) {}

  @Endpoint({ tag: 'Import', summary: 'List imports', response: z.array(ImportJob) })
  @Get()
  list(): Promise<ImportJob[]> {
    return this.imports.list();
  }

  @Endpoint({
    tag: 'Import',
    summary: 'Import from Jira Server/DC',
    description:
      'Starts a job in the worker. With dryRun (the default) it reads everything and reports what it would create, map and skip, without writing. Project keys must be free in Tasklore. Objects imported before are skipped, so a second run adds only new ones. The token is kept only while the job runs.',
    response: ImportJob,
  })
  @Post('jira')
  jira(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(JiraImportRequest) body: JiraImportRequest,
  ): Promise<ImportJob> {
    return this.imports.jira(principal, body);
  }

  @Endpoint({
    tag: 'Import',
    summary: 'Get an import with its progress, log and report',
    response: ImportJob,
  })
  @Get(':id')
  get(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 404 })) id: string,
  ): Promise<ImportJob> {
    return this.imports.get(id);
  }
}
