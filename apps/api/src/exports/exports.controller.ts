import {
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  IssueExportRequest,
  PAGE_EXPORT_FORMATS,
  type PageExportFormat,
  PageExportQuery,
  SPACE_EXPORT_FORMATS,
  type SpaceExportFormat,
  SpaceExportQuery,
} from '@toolvibes/shared';
import type { Response } from 'express';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { disposition } from '../storage/disposition.js';
import { IssueExportService } from './issue-export.service.js';
import { type ExportFile, PageExportService } from './page-export.service.js';

const Uuid = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

function send(response: Response, file: ExportFile): StreamableFile {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'private, no-store');
  // An exported HTML file opened from the API never runs scripts or loads anything.
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
  );
  const body = typeof file.body === 'string' ? Buffer.from(file.body) : file.body;
  const options = { type: file.type, disposition: disposition('attachment', file.fileName) };
  // Two calls: the constructor takes a buffer or a stream, not a union of both.
  return Buffer.isBuffer(body)
    ? new StreamableFile(body, options)
    : new StreamableFile(body, options);
}

/** Exports of pages, spaces and search results (TL-30, E-111). */
@Controller()
export class ExportsController {
  constructor(
    @Inject(PageExportService) private readonly pages: PageExportService,
    @Inject(IssueExportService) private readonly issues: IssueExportService,
  ) {}

  @Endpoint({
    tag: 'Pages',
    summary: 'Export a page',
    description:
      '`docx` is a Word document with header, footer and, with child pages, a table of contents; `markdown` a ZIP with the page as Markdown and its attachments; `html` one self-contained HTML file. `children=true` adds the published child pages (at most 200). Only published pages can be exported; whoever may read a page may export it.',
    binary: true,
  })
  @Get('pages/:id/export/:format')
  async page(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Uuid) id: string,
    @Param('format') format: string,
    @ValidQuery(PageExportQuery) query: PageExportQuery,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    if (!(PAGE_EXPORT_FORMATS as readonly string[]).includes(format)) throw new NotFoundException();
    const file = await this.pages.page(principal, id, format as PageExportFormat, {
      children: query.children === 'true',
      locale: query.locale,
    });
    return send(response, file);
  }

  @Endpoint({
    tag: 'Spaces',
    summary: 'Export a space',
    description:
      'A ZIP with every published page the caller can read as Markdown or HTML files in the page tree’s folders, plus their attachments (at most 2,000 pages).',
    binary: true,
  })
  @Get('spaces/:key/export/:format')
  async space(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Param('format') format: string,
    @ValidQuery(SpaceExportQuery) query: SpaceExportQuery,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    if (!(SPACE_EXPORT_FORMATS as readonly string[]).includes(format)) {
      throw new NotFoundException();
    }
    const file = await this.pages.space(principal, key, format as SpaceExportFormat, {
      locale: query.locale,
    });
    return send(response, file);
  }

  @Endpoint({
    tag: 'Search',
    summary: 'Export search results',
    description:
      'Every issue of the TQL query (at most 10,000) as CSV (semicolons, UTF-8 with byte order mark), Excel or JSON. CSV and Excel have key, summary and the given columns; JSON has the full issue summaries.',
    binary: true,
  })
  @Post('search/export')
  @HttpCode(200)
  async search(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(IssueExportRequest) body: IssueExportRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const file = await this.issues.export(principal, body);
    return send(response, {
      ...file,
      body: typeof file.body === 'string' ? file.body : Buffer.from(file.body),
    });
  }
}
