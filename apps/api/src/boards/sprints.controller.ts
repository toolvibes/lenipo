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
  BacklogData,
  CompleteSprintRequest,
  CreateSprintRequest,
  MoveToSprintRequest,
  Sprint,
  SprintState,
  StartSprintRequest,
  UpdateSprintRequest,
} from '@tasklore/shared';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { SprintService } from './sprint.service.js';

const SprintListQuery = z.object({ state: SprintState.optional() });
type SprintListQuery = z.infer<typeof SprintListQuery>;

/** Sprints and backlog of Scrum boards (T-SPR, E-55); planning needs `edit-issues`. */
@Controller()
export class SprintsController {
  constructor(@Inject(SprintService) private readonly sprints: SprintService) {}

  @Endpoint({
    tag: 'Sprints',
    summary: 'The backlog of a Scrum board: open sprints with their issues, then the rest',
    response: BacklogData,
  })
  @Get('boards/:id/backlog')
  backlog(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BacklogData> {
    return this.sprints.backlog(principal, id);
  }

  @Endpoint({ tag: 'Sprints', summary: 'List the sprints of a board', response: z.array(Sprint) })
  @Get('boards/:id/sprints')
  list(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @ValidQuery(SprintListQuery) query: SprintListQuery,
  ): Promise<Sprint[]> {
    return this.sprints.list(principal, id, query.state);
  }

  @Endpoint({ tag: 'Sprints', summary: 'Plan a new sprint on a Scrum board', response: Sprint })
  @Post('boards/:id/sprints')
  @HttpCode(201)
  create(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @ValidBody(CreateSprintRequest) body: CreateSprintRequest,
  ): Promise<Sprint> {
    return this.sprints.create(principal, id, body);
  }

  @Endpoint({ tag: 'Sprints', summary: 'Change name, goal or dates of a sprint', response: Sprint })
  @Patch('sprints/:id')
  update(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @ValidBody(UpdateSprintRequest) body: UpdateSprintRequest,
  ): Promise<Sprint> {
    return this.sprints.update(principal, id, body);
  }

  @Endpoint({ tag: 'Sprints', summary: 'Delete a planned sprint; its issues go to the backlog' })
  @Delete('sprints/:id')
  @HttpCode(204)
  delete(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.sprints.delete(principal, id);
  }

  @Endpoint({
    tag: 'Sprints',
    summary: 'Start a planned sprint',
    description: 'One sprint runs per board. The estimates at this moment are the commitment.',
    response: Sprint,
  })
  @Post('sprints/:id/start')
  @HttpCode(200)
  start(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @ValidBody(StartSprintRequest) body: StartSprintRequest,
  ): Promise<Sprint> {
    return this.sprints.start(principal, id, body);
  }

  @Endpoint({
    tag: 'Sprints',
    summary: 'Complete the running sprint',
    description:
      'Unfinished issues go to the backlog, a new sprint (`"new"`) or a planned sprint (its id).',
    response: Sprint,
  })
  @Post('sprints/:id/complete')
  @HttpCode(200)
  complete(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @ValidBody(CompleteSprintRequest) body: CompleteSprintRequest,
  ): Promise<Sprint> {
    return this.sprints.complete(principal, id, body);
  }

  @Endpoint({
    tag: 'Sprints',
    summary: 'Move issues into a sprint or (sprintId null) to the backlog',
    description: 'Each issue leaves its current open sprint; the change is in its history.',
  })
  @Post('sprints/move-issues')
  @HttpCode(204)
  move(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(MoveToSprintRequest) body: MoveToSprintRequest,
  ): Promise<void> {
    return this.sprints.moveIssues(principal, body.issueKeys, body.sprintId);
  }
}
