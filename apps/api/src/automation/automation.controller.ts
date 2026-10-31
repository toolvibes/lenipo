import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  AutomationRule,
  AutomationRuleInput,
  AutomationRuleQuery,
  AutomationRun,
  IncomingWebhookRequest,
} from '@tasklore/shared';
import { z } from 'zod';
import { CurrentPrincipal, Public, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { RequireModule } from '../operations/operations.guard.js';
import { AutomationEngine } from './automation.engine.js';
import { AutomationService } from './automation.service.js';

const RuleId = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

@RequireModule('automation')
@Controller('automation')
export class AutomationController {
  constructor(
    @Inject(AutomationService) private readonly rules: AutomationService,
    @Inject(AutomationEngine) private readonly engine: AutomationEngine,
  ) {}

  @Endpoint({
    tag: 'Automation',
    summary: 'List the rules of a project, or the global rules',
    response: z.array(AutomationRule),
  })
  @Get('rules')
  list(
    @CurrentPrincipal() principal: Principal,
    @ValidQuery(AutomationRuleQuery) query: AutomationRuleQuery,
  ): Promise<AutomationRule[]> {
    return this.rules.list(principal, query.project);
  }

  @Endpoint({ tag: 'Automation', summary: 'Create a rule', response: AutomationRule })
  @Post('rules')
  @HttpCode(201)
  create(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(AutomationRuleInput) body: AutomationRuleInput,
  ): Promise<AutomationRule> {
    return this.rules.create(principal, body);
  }

  @Endpoint({ tag: 'Automation', summary: 'Get a rule', response: AutomationRule })
  @Get('rules/:id')
  get(
    @CurrentPrincipal() principal: Principal,
    @Param('id', RuleId) id: string,
  ): Promise<AutomationRule> {
    return this.rules.get(principal, id);
  }

  @Endpoint({ tag: 'Automation', summary: 'Replace a rule', response: AutomationRule })
  @Put('rules/:id')
  update(
    @CurrentPrincipal() principal: Principal,
    @Param('id', RuleId) id: string,
    @ValidBody(AutomationRuleInput) body: AutomationRuleInput,
  ): Promise<AutomationRule> {
    return this.rules.update(principal, id, body);
  }

  @Endpoint({ tag: 'Automation', summary: 'Delete a rule' })
  @Delete('rules/:id')
  @HttpCode(204)
  delete(@CurrentPrincipal() principal: Principal, @Param('id', RuleId) id: string): Promise<void> {
    return this.rules.delete(principal, id);
  }

  @Endpoint({
    tag: 'Automation',
    summary: 'The audit log of a rule: its last 100 runs',
    response: z.array(AutomationRun),
  })
  @Get('rules/:id/runs')
  runs(
    @CurrentPrincipal() principal: Principal,
    @Param('id', RuleId) id: string,
  ): Promise<AutomationRun[]> {
    return this.rules.runs(principal, id);
  }

  @Endpoint({
    tag: 'Automation',
    summary: 'Start a rule with an incoming webhook trigger',
    description:
      'Called by other systems with the secret from the rule (`?token=`). Optionally `{"issues": ["KEY-1"]}` runs it for those issues; the whole body is available as {{webhookData}}.',
    response: z.object({ queued: z.number().int() }),
  })
  @Public()
  @Post('hooks/:id')
  @HttpCode(202)
  async hook(
    @Param('id', RuleId) id: string,
    @Query('token') token: string | undefined,
    @ValidBody(IncomingWebhookRequest) body: IncomingWebhookRequest,
  ): Promise<{ queued: number }> {
    return { queued: await this.engine.incoming(id, token ?? '', body) };
  }
}
