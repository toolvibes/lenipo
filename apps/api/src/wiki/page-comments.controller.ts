import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { CreatePageCommentRequest, PageComment, UpdatePageCommentRequest } from '@toolvibes/shared';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { RequireModule } from '../operations/operations.guard.js';
import { PageCommentService } from './page-comment.service.js';

/** Unknown and malformed ids are both "not found". */
const Uuid = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

@RequireModule('wiki')
@Controller('pages/:id/comments')
export class PageCommentsController {
  constructor(@Inject(PageCommentService) private readonly comments: PageCommentService) {}

  @Endpoint({
    tag: 'Pages',
    summary: 'List the comments of a page',
    description:
      'Page comments and inline threads, oldest first; answers carry `parentId`, inline threads an `anchor` on the published text.',
    response: z.array(PageComment),
  })
  @Get()
  listComments(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Uuid) id: string,
  ): Promise<PageComment[]> {
    return this.comments.list(principal, id);
  }

  @Endpoint({
    tag: 'Pages',
    summary: 'Comment on a page, answer a thread or start an inline thread',
    description: 'Requires the space permission `comment`. `body` is a document or `{ markdown }`.',
    response: PageComment,
  })
  @Post()
  @HttpCode(201)
  addComment(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Uuid) id: string,
    @ValidBody(CreatePageCommentRequest) body: CreatePageCommentRequest,
  ): Promise<PageComment> {
    return this.comments.create(principal, id, body);
  }

  @Endpoint({ tag: 'Pages', summary: 'Edit an own page comment', response: PageComment })
  @Patch(':commentId')
  updateComment(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Uuid) id: string,
    @Param('commentId', Uuid) commentId: string,
    @ValidBody(UpdatePageCommentRequest) body: UpdatePageCommentRequest,
  ): Promise<PageComment> {
    return this.comments.update(principal, id, commentId, body);
  }

  @Endpoint({
    tag: 'Pages',
    summary: 'Delete a page comment (own, or any as space administrator)',
  })
  @Delete(':commentId')
  @HttpCode(204)
  deleteComment(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Uuid) id: string,
    @Param('commentId', Uuid) commentId: string,
  ): Promise<void> {
    return this.comments.delete(principal, id, commentId);
  }

  @Endpoint({ tag: 'Pages', summary: 'Resolve an inline thread', response: PageComment })
  @Put(':commentId/resolved')
  resolveComment(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Uuid) id: string,
    @Param('commentId', Uuid) commentId: string,
  ): Promise<PageComment> {
    return this.comments.resolve(principal, id, commentId, true);
  }

  @Endpoint({ tag: 'Pages', summary: 'Reopen a resolved inline thread', response: PageComment })
  @Delete(':commentId/resolved')
  reopenComment(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Uuid) id: string,
    @Param('commentId', Uuid) commentId: string,
  ): Promise<PageComment> {
    return this.comments.resolve(principal, id, commentId, false);
  }
}
