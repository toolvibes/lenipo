import type { Readable } from 'node:stream';
import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ArchiveImportQuery,
  ConfluenceImportQuery,
  ImportJob,
  JiraImportRequest,
} from '@tasklore/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { RequireGlobal } from '../access/require-global.js';
import { AuditService } from '../audit/audit.service.js';
import type { AppConfig } from '../core/config.js';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { CONFIG } from '../core/tokens.js';
import { disposition } from '../storage/disposition.js';
import { receiveUpload } from '../storage/upload.js';
import { ArchiveService } from './archive.service.js';
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
    summary: 'Import a project or space archive of another Tasklore',
    description:
      'The ZIP from "Export as archive" (field "file"). Everything gets new ids; people are matched by e-mail or created deactivated, issue types, statuses, priorities and link types by key or name. `targetKey` renames the project or space; dryRun (the default) only reports.',
    upload: 'file',
    response: ImportJob,
  })
  @Post('archive')
  @HttpCode(201)
  async archive(
    @CurrentPrincipal() principal: Principal,
    @ValidQuery(ArchiveImportQuery) query: ArchiveImportQuery,
    @Req() request: Request,
  ): Promise<ImportJob> {
    const upload = await receiveUpload(request, this.config.ATTACHMENT_MAX_MB * 40 * 1024 * 1024);
    return this.imports.archive(principal, upload, {
      targetKey: query.targetKey,
      dryRun: query.dryRun === 'true',
    });
  }

  @Endpoint({
    tag: 'Import',
    summary: 'Import what a dry run checked',
    description:
      'Starts the real import with the file uploaded for the dry run (Confluence or archive).',
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

/** Project and space archives for another Tasklore instance (TL-39, E-120). */
@RequireGlobal('admin')
@Controller('admin/archives')
export class ArchivesController {
  constructor(
    @Inject(ArchiveService) private readonly archives: ArchiveService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private async send(
    principal: Principal,
    kind: 'project' | 'space',
    file: { stream: Readable; fileName: string },
    key: string,
    response: Response,
  ): Promise<StreamableFile> {
    await this.audit.record({
      action: 'export.archive',
      actorId: principal.userId,
      via: principal.via,
      targetType: kind,
      targetId: key.toUpperCase(),
    });
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(file.stream, {
      type: 'application/zip',
      disposition: disposition('attachment', file.fileName),
    });
  }

  @Endpoint({
    tag: 'Import',
    summary: 'Export a project as archive',
    description: 'Issues with comments, work logs, links, attachments, components and versions.',
    binary: true,
  })
  @Get('projects/:key')
  async project(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.send(principal, 'project', await this.archives.project(key), key, response);
  }

  @Endpoint({
    tag: 'Import',
    summary: 'Export a space as archive',
    description: 'Pages and blog posts with all versions, comments and attachments.',
    binary: true,
  })
  @Get('spaces/:key')
  async space(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.send(principal, 'space', await this.archives.space(key), key, response);
  }
}
