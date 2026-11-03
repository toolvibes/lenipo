import { Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import {
  AgentActivityPage,
  AgentActivityQuery,
  AgentOverview,
  AgentRights,
  AgentUsage,
  DecideApprovalRequest,
  FormatQuery,
  Issue,
  IssueApproval,
  PendingApprovals,
  ReportUsageRequest,
  TransitionRequest,
} from '@toolvibes/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { RequireGlobal } from '../access/require-global.js';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { issueIn } from '../tracking/content-format.js';
import { IssueService } from '../tracking/issue.service.js';
import { AgentActivityService } from './agent-activity.service.js';
import { GuardrailService } from './guardrail.service.js';
import { IssueApprovalService } from './issue-approval.service.js';

/** Guardrails and oversight of agents (TL-98, E-150). */
@Controller()
export class GuardrailsController {
  constructor(
    @Inject(GuardrailService) private readonly guardrails: GuardrailService,
    @Inject(AgentActivityService) private readonly activity: AgentActivityService,
    @Inject(IssueApprovalService) private readonly approvals: IssueApprovalService,
    @Inject(IssueService) private readonly issues: IssueService,
  ) {}

  @Endpoint({
    tag: 'Issues',
    summary: 'Move an issue to another status',
    description:
      'Where the project keeps the target status for people, an agent gets 202 with the waiting request instead; the move happens once a person approves it.',
    response: Issue,
    accepted: { description: 'Waiting for a person’s approval', response: IssueApproval },
  })
  @Post('issues/:key/transitions')
  @HttpCode(200)
  async transition(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(TransitionRequest) body: TransitionRequest,
    @ValidQuery(FormatQuery) query: FormatQuery,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Issue | IssueApproval> {
    const approval = await this.approvals.gate(principal, key, body);
    if (approval) {
      response.status(202);
      return approval;
    }
    return issueIn(query.format, await this.issues.transition(principal, key, body));
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'List the transition approval requests of an issue',
    response: z.array(IssueApproval),
  })
  @Get('issues/:key/approvals')
  listIssueApprovals(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<IssueApproval[]> {
    return this.approvals.forIssue(principal, key);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'Approve or reject a transition an agent asked for',
    description:
      'For people who may move issues in the project. Approving moves the issue in the agent’s name; rejecting needs a reason, which the agent is told.',
    response: IssueApproval,
  })
  @Post('issue-approvals/:id/decision')
  @HttpCode(200)
  decideIssueApproval(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @ValidBody(DecideApprovalRequest) body: DecideApprovalRequest,
  ): Promise<IssueApproval> {
    return this.approvals.decide(principal, id, body);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'List what waits for the caller’s approval',
    description:
      'Sprint starts and completions (where the caller has `edit-issues`) and transitions (with `transition-issues`) agents asked for.',
    response: PendingApprovals,
  })
  @Get('approvals/pending')
  pendingApprovals(@CurrentPrincipal() principal: Principal): Promise<PendingApprovals> {
    return this.approvals.pending(principal);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'The agents dashboard',
    description:
      'Every agent with its state and issue, budget use, issues resolved and failures (rejected writes, reviews with changes requested) in the last 7 days, and what it waits for.',
    response: z.array(AgentOverview),
  })
  @RequireGlobal('browse-users')
  @Get('agents/overview')
  overview(@CurrentPrincipal() principal: Principal): Promise<AgentOverview[]> {
    return this.activity.overview(principal);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'Get the budget use of an AI agent',
    description: 'For the agent, its responsible person and administrators.',
    response: AgentUsage,
  })
  @Get('agents/:id/usage')
  async agentUsage(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AgentUsage> {
    await this.activity.requireViewer(principal, id);
    return this.guardrails.usage(id);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'Get the history of an AI agent',
    description:
      'Its writing and rejected requests (kept 90 days), changes, comments, reviews and approval requests, newest first; changes and comments only on issues the caller can see.',
    response: AgentActivityPage,
  })
  @Get('agents/:id/activity')
  agentActivity(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @ValidQuery(AgentActivityQuery) query: z.infer<typeof AgentActivityQuery>,
  ): Promise<AgentActivityPage> {
    return this.activity.history(principal, id, query);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'Get what an AI agent may do',
    description:
      'Its groups, the projects it sees with permissions and roles, and its live tokens.',
    response: AgentRights,
  })
  @Get('agents/:id/rights')
  agentRights(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AgentRights> {
    return this.activity.rights(principal, id);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'Get the caller’s own budget use',
    description: 'For agents: what counts against their budget today and this month.',
    response: AgentUsage,
  })
  @Get('me/usage')
  myUsage(@CurrentPrincipal() principal: Principal): Promise<AgentUsage> {
    return this.guardrails.usage(principal.userId);
  }

  @Endpoint({
    tag: 'Agents',
    summary: 'Report the cost of a run',
    description:
      'Agents report what a run cost, in the currency of their budget; Lenipo counts claims and claimed time itself.',
    response: AgentUsage,
  })
  @Post('me/usage')
  @HttpCode(200)
  reportUsage(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(ReportUsageRequest) body: ReportUsageRequest,
  ): Promise<AgentUsage> {
    return this.guardrails.report(principal, body);
  }
}
