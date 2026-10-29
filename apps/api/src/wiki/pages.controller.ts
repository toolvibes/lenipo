import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  FormatQuery,
  MovePageRequest,
  Page,
  PageVersion,
  PageVersionSummary,
  PublishPageRequest,
  UpdatePageRequest,
} from '@tasklore/shared';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { PageService } from './page.service.js';

/** Unknown and malformed page ids are both "not found". */
const PageId = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

@Controller('pages')
export class PagesController {
  constructor(@Inject(PageService) private readonly pages: PageService) {}

  @Endpoint({
    tag: 'Pages',
    summary: 'Get a page: its latest published version',
    description:
      'Drafts have `version` 0 and no content. `?format=markdown` returns the content as Markdown.',
    response: Page,
  })
  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal,
    @Param('id', PageId) id: string,
    @ValidQuery(FormatQuery) query: FormatQuery,
  ): Promise<Page> {
    return this.pages.get(principal, id, query.format);
  }

  @Endpoint({ tag: 'Pages', summary: 'Rename a page; links keep working', response: Page })
  @Patch(':id')
  rename(
    @CurrentPrincipal() principal: Principal,
    @Param('id', PageId) id: string,
    @ValidBody(UpdatePageRequest) body: UpdatePageRequest,
  ): Promise<Page> {
    return this.pages.rename(principal, id, body.title);
  }

  @Endpoint({
    tag: 'Pages',
    summary: 'Move a page in its space’s tree',
    description: 'Under `parentId` (null: top level), before the sibling `beforeId` or last.',
    response: Page,
  })
  @Post(':id/move')
  @HttpCode(200)
  move(
    @CurrentPrincipal() principal: Principal,
    @Param('id', PageId) id: string,
    @ValidBody(MovePageRequest) body: MovePageRequest,
  ): Promise<Page> {
    return this.pages.move(principal, id, body);
  }

  @Endpoint({
    tag: 'Pages',
    summary: 'Publish a page as its next version',
    description:
      'Stores the given document (usually the live draft) as an immutable version. The document must fit the editor schema.',
    response: Page,
  })
  @Post(':id/publish')
  @HttpCode(200)
  publish(
    @CurrentPrincipal() principal: Principal,
    @Param('id', PageId) id: string,
    @ValidBody(PublishPageRequest) body: PublishPageRequest,
  ): Promise<Page> {
    return this.pages.publish(principal, id, body);
  }

  @Endpoint({
    tag: 'Pages',
    summary: 'The published versions of a page, newest first',
    response: z.array(PageVersionSummary),
  })
  @Get(':id/versions')
  versions(
    @CurrentPrincipal() principal: Principal,
    @Param('id', PageId) id: string,
  ): Promise<PageVersionSummary[]> {
    return this.pages.versions(principal, id);
  }

  @Endpoint({ tag: 'Pages', summary: 'One published version of a page', response: PageVersion })
  @Get(':id/versions/:number')
  version(
    @CurrentPrincipal() principal: Principal,
    @Param('id', PageId) id: string,
    @Param('number', ParseIntPipe) number: number,
    @ValidQuery(FormatQuery) query: FormatQuery,
  ): Promise<PageVersion> {
    return this.pages.version(principal, id, number, query.format);
  }

  @Endpoint({
    tag: 'Pages',
    summary: 'Move a page and the pages below it to the trash',
  })
  @Delete(':id')
  @HttpCode(204)
  delete(@CurrentPrincipal() principal: Principal, @Param('id', PageId) id: string): Promise<void> {
    return this.pages.delete(principal, id);
  }

  @Endpoint({ tag: 'Pages', summary: 'Restore a page from the trash', response: Page })
  @Post(':id/restore')
  @HttpCode(200)
  restore(
    @CurrentPrincipal() principal: Principal,
    @Param('id', PageId) id: string,
  ): Promise<Page> {
    return this.pages.restore(principal, id);
  }
}
