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
import { AttachmentService } from './attachment.service.js';

/** Unknown and malformed attachment ids are both "not found". */
const AttachmentId = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

/** RFC 6266 filename with an ASCII fallback and the UTF-8 original (RFC 5987). */
function disposition(kind: 'inline' | 'attachment', fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

@Controller()
export class AttachmentsController {
  constructor(@Inject(AttachmentService) private readonly attachments: AttachmentService) {}

  @Endpoint({
    tag: 'Issues',
    summary: 'List the attachments of an issue',
    response: z.array(Attachment),
  })
  @Get('issues/:key/attachments')
  list(@CurrentPrincipal() principal: Principal, @Param('key') key: string): Promise<Attachment[]> {
    return this.attachments.list(principal, key);
  }

  @Endpoint({
    tag: 'Issues',
    summary: 'Attach a file to an issue',
    description:
      'multipart/form-data with the file in the field `file`; needs the project permission `comment`. The size limit is `attachmentMaxBytes` from /tracking/meta.',
    response: Attachment,
    upload: 'file',
  })
  @Post('issues/:key/attachments')
  @HttpCode(201)
  upload(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Req() request: Request,
  ): Promise<Attachment> {
    return this.attachments.upload(principal, key, request);
  }

  @Endpoint({
    tag: 'Issues',
    summary: 'Delete an attachment (own, or any as project administrator)',
  })
  @Delete('issues/:key/attachments/:id')
  @HttpCode(204)
  delete(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Param('id', AttachmentId) id: string,
  ): Promise<void> {
    return this.attachments.delete(principal, key, id);
  }

  @Endpoint({
    tag: 'Issues',
    summary: 'Download the content of an attachment',
    description:
      'Verified raster images (PNG, JPEG, GIF, WebP) are served inline unless `download=1`; everything else always as a download.',
    binary: true,
  })
  @Get('attachments/:id/content')
  async content(
    @CurrentPrincipal() principal: Principal,
    @Param('id', AttachmentId) id: string,
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
