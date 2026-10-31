import { Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ConfluenceImportQuery, ImportJob, JiraImportRequest } from '@tasklore/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { RequireGlobal } from '../access/require-global.js';
import type { AppConfig } from '../core/config.js';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { CONFIG } from '../core/tokens.js';
import { receiveUpload } from '../storage/upload.js';
import { ImportService } from './import.service.js';

/** Imports from Jira and Confluence (TL-35, E-118), for administrators. */
@RequireGlobal('admin')
@Controller('admin/imports')
export class ImportsController {
  constructor(
    @Inject(ImportService) private readonly imports: ImportService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

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
    summary: 'Import a Confluence Server/DC space export',
    description:
      'The space XML export as a ZIP (field "file"). Pages with their versions, blog posts, comments, attachments and labels; Confluence macros become Tasklore macros where one exists. `spaceKey` names the new space (the export\'s key by default); dryRun (the default) only reports.',
    upload: 'file',
    response: ImportJob,
  })
  @Post('confluence')
  @HttpCode(201)
  async confluence(
    @CurrentPrincipal() principal: Principal,
    @ValidQuery(ConfluenceImportQuery) query: ConfluenceImportQuery,
    @Req() request: Request,
  ): Promise<ImportJob> {
    // Space exports are larger than attachments: up to 40 times the attachment limit.
    const upload = await receiveUpload(request, this.config.ATTACHMENT_MAX_MB * 40 * 1024 * 1024);
    return this.imports.confluence(principal, upload, {
      spaceKey: query.spaceKey,
      dryRun: query.dryRun === 'true',
    });
  }

  @Endpoint({
    tag: 'Import',
    summary: 'Import what a Confluence dry run checked',
    description: 'Starts the real import with the export uploaded for the dry run.',
    response: ImportJob,
  })
  @Post(':id/run')
  @HttpCode(201)
  run(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 404 })) id: string,
  ): Promise<ImportJob> {
    return this.imports.runAfterDryRun(principal, id);
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
