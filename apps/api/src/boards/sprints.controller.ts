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
  Res,
} from '@nestjs/common';
import {
  BacklogData,
  Burndown,
  CompleteSprintRequest,
  CreateSprintRequest,
  DecideApprovalRequest,
  MoveToSprintRequest,
  Sprint,
  SprintApproval,
  SprintReport,
  SprintState,
  StartSprintRequest,
  UpdateSprintRequest,
  Velocity,
} from '@toolvibes/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { RequireModule } from '../operations/operations.guard.js';
import { ReportService } from './report.service.js';
import { SprintService } from './sprint.service.js';
import { SprintApprovalService } from './sprint-approval.service.js';

const SprintListQuery = z.object({ state: SprintState.optional() });
type SprintListQuery = z.infer<typeof SprintListQuery>;
const ApprovalListQuery = z.object({ status: SprintApproval.shape.status.optional() });
type ApprovalListQuery = z.infer<typeof ApprovalListQuery>;

/** Sprints and backlog of Scrum boards (T-SPR, E-55); planning needs `edit-issues`. */
@RequireModule('boards')
@Controller()
export class SprintsController {
  constructor(
    @Inject(SprintService) private readonly sprints: SprintService,
    @Inject(ReportService) private readonly reports: ReportService,
    @Inject(SprintApprovalService) private readonly approvals: SprintApprovalService,
  ) {}

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

  @Endpoint({
    tag: 'Reports',
    summary: 'Velocity: committed against completed for the last closed sprints',
    response: Velocity,
  })
  @Get('boards/:id/velocity')
  velocity(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Velocity> {
    return this.reports.velocity(principal, id);
  }

  @Endpoint({
    tag: 'Reports',
    summary: 'Burndown of a started sprint: one step per event (E-56)',
    response: Burndown,
  })
  @Get('sprints/:id/burndown')
  burndown(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Burndown> {
    return this.reports.burndown(principal, id);
  }

  @Endpoint({
    tag: 'Reports',
    summary: 'Sprint report: completed, not completed, removed; added after start is marked',
    response: SprintReport,
  })
  @Get('sprints/:id/report')
  report(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SprintReport> {
    return this.reports.report(principal, id);
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
    description:
      'One sprint runs per board. The estimates at this moment are the commitment. Agents need the role planner; where the project wants approval, an agent gets 202 with the waiting request instead, and the sprint starts once a person approves it.',
    response: Sprint,
    accepted: { description: 'Waiting for a person’s approval', response: SprintApproval },
  })
  @Post('sprints/:id/start')
  @HttpCode(200)
  async start(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @ValidBody(StartSprintRequest) body: StartSprintRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Sprint | SprintApproval> {
    const approval = await this.approvals.gate(principal, id, 'start', body);
    if (approval) {
      response.status(202);
      return approval;
    }
    return this.sprints.start(principal, id, body);
  }

  @Endpoint({
    tag: 'Sprints',
    summary: 'Complete the running sprint',
    description:
      'Unfinished issues go to the backlog, a new sprint (`"new"`) or a planned sprint (its id).',
    response: Sprint,
    accepted: { description: 'Waiting for a person’s approval', response: SprintApproval },
  })
  @Post('sprints/:id/complete')
  @HttpCode(200)
  async complete(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @ValidBody(CompleteSprintRequest) body: CompleteSprintRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Sprint | SprintApproval> {
    const approval = await this.approvals.gate(principal, id, 'complete', body);
    if (approval) {
      response.status(202);
      return approval;
    }
    return this.sprints.complete(principal, id, body);
  }

  @Endpoint({
    tag: 'Sprints',
    summary: 'List the sprint approval requests of agents in a project',
    response: z.array(SprintApproval),
  })
  @Get('projects/:key/sprint-approvals')
  listApprovals(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidQuery(ApprovalListQuery) query: ApprovalListQuery,
  ): Promise<SprintApproval[]> {
    return this.approvals.list(principal, key, query.status);
  }

  @Endpoint({
    tag: 'Sprints',
    summary: 'Approve or reject an agent’s sprint request',
    description:
      'For people with `edit-issues`. Approving starts or completes the sprint in the agent’s name; the agent is notified either way, a rejection with its reason.',
    response: SprintApproval,
  })
  @Post('sprint-approvals/:id/decision')
  @HttpCode(200)
  decide(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @ValidBody(DecideApprovalRequest) body: DecideApprovalRequest,
  ): Promise<SprintApproval> {
    return this.approvals.decide(principal, id, body);
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
