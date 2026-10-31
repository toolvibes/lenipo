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
} from '@nestjs/common';
import {
  Board,
  BoardData,
  BoardIssuesQuery,
  BoardSummary,
  CreateBoardRequest,
  Issue,
  MoveCardRequest,
  UpdateBoardRequest,
} from '@tasklore/shared';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { RequireModule } from '../operations/operations.guard.js';
import { BoardService } from './board.service.js';

const BoardListQuery = z.object({ project: z.string().max(10).optional() });
type BoardListQuery = z.infer<typeof BoardListQuery>;

@RequireModule('boards')
@Controller('boards')
export class BoardsController {
  constructor(@Inject(BoardService) private readonly boards: BoardService) {}

  @Endpoint({
    tag: 'Boards',
    summary: 'List boards in projects the caller can see',
    response: z.array(BoardSummary),
  })
  @Get()
  list(
    @CurrentPrincipal() principal: Principal,
    @ValidQuery(BoardListQuery) query: BoardListQuery,
  ): Promise<BoardSummary[]> {
    return this.boards.list(principal, query.project);
  }

  @Endpoint({
    tag: 'Boards',
    summary: 'Create a board located in a project',
    description:
      'Requires the permission `administer` in that project. Starts with one column per workflow status (E-53).',
    response: Board,
  })
  @Post()
  @HttpCode(201)
  create(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(CreateBoardRequest) body: CreateBoardRequest,
  ): Promise<Board> {
    return this.boards.create(principal, body);
  }

  @Endpoint({ tag: 'Boards', summary: 'Get a board’s configuration', response: Board })
  @Get(':id')
  get(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Board> {
    return this.boards.get(principal, id);
  }

  @Endpoint({
    tag: 'Boards',
    summary: 'Configure a board: scope, columns, WIP limits, quick filters, swimlanes',
    description: 'Columns and quick filters are given as full lists in display order.',
    response: Board,
  })
  @Patch(':id')
  update(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @ValidBody(UpdateBoardRequest) body: UpdateBoardRequest,
  ): Promise<Board> {
    return this.boards.update(principal, id, body);
  }

  @Endpoint({ tag: 'Boards', summary: 'Delete a board; its issues stay' })
  @Delete(':id')
  @HttpCode(204)
  delete(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.boards.delete(principal, id);
  }

  @Endpoint({
    tag: 'Boards',
    summary: 'The board with its cards in rank order (at most 500)',
    description:
      '`filters` narrows with quick filters: "mine", "recent" or ids of the board’s own, combined with AND.',
    response: BoardData,
  })
  @Get(':id/issues')
  issues(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @ValidQuery(BoardIssuesQuery) query: BoardIssuesQuery,
  ): Promise<BoardData> {
    const filters = (query.filters ?? '')
      .split(',')
      .map((filter) => filter.trim())
      .filter(Boolean);
    return this.boards.issues(principal, id, filters, query.sprint);
  }

  @Endpoint({
    tag: 'Boards',
    summary: 'Move a card into a column and between two cards',
    description:
      'Runs the workflow transition to the first status of the column the issue can reach (409 if none), then ranks it between `afterKey` and `beforeKey`.',
    response: Issue,
  })
  @Post(':id/move')
  @HttpCode(200)
  move(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @ValidBody(MoveCardRequest) body: MoveCardRequest,
  ): Promise<Issue> {
    return this.boards.move(principal, id, body);
  }
}
