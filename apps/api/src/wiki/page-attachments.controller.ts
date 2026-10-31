import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Attachment } from '@tasklore/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { CurrentPrincipal } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { RequireModule } from '../operations/operations.guard.js';
import { disposition } from '../storage/disposition.js';
import { PageAttachmentService } from './page-attachment.service.js';

/** Unknown and malformed ids are both "not found". */
const Uuid = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

@RequireModule('wiki')
@Controller()
export class PageAttachmentsController {
  constructor(@Inject(PageAttachmentService) private readonly attachments: PageAttachmentService) {}

  @Endpoint({
    tag: 'Pages',
    summary: 'List the attachments of a page',
    response: z.array(Attachment),
  })
  @Get('pages/:id/attachments')
  listAttachments(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Uuid) id: string,
  ): Promise<Attachment[]> {
    return this.attachments.list(principal, id);
  }

  @Endpoint({
    tag: 'Pages',
    summary: 'Attach a file to a page',
    description:
      'multipart/form-data with the file in the field `file`; needs the space permission `edit`. Images in the page text refer to attachments by id.',
    response: Attachment,
    upload: 'file',
  })
  @Post('pages/:id/attachments')
  @HttpCode(201)
  attach(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Uuid) id: string,
    @Req() request: Request,
  ): Promise<Attachment> {
    return this.attachments.upload(principal, id, request);
  }

  @Endpoint({
    tag: 'Pages',
    summary: 'Delete a page attachment (own, or any as space administrator)',
  })
  @Delete('pages/:id/attachments/:attachmentId')
  @HttpCode(204)
  deleteAttachment(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Uuid) id: string,
    @Param('attachmentId', Uuid) attachmentId: string,
  ): Promise<void> {
    return this.attachments.delete(principal, id, attachmentId);
  }

  @Endpoint({
    tag: 'Pages',
    summary: 'Download the content of a page attachment',
    description:
      'Verified raster images (PNG, JPEG, GIF, WebP) are served inline unless `download=1`; everything else always as a download.',
    binary: true,
  })
  @Get('page-attachments/:id/content')
  async attachmentContent(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Uuid) id: string,
    @Query('download') download: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { row, stream } = await this.attachments.content(principal, id);
    const inline = row.image && download !== '1';
    // Files from users are never interpreted by the browser as part of the application.
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    response.setHeader('Cache-Control', 'private, max-age=3600');
    response.setHeader('ETag', `"${row.sha256}"`);
    return new StreamableFile(stream, {
      type: row.image ? row.contentType : 'application/octet-stream',
      length: row.size,
      disposition: disposition(inline ? 'inline' : 'attachment', row.fileName),
    });
  }
}
