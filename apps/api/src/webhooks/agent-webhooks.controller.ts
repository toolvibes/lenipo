import {
  Controller,
  Delete,
  ForbiddenException,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { AgentWebhook, AgentWebhookRequest } from '@toolvibes/shared';
import { AccessService } from '../access/access.service.js';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { AgentService } from '../identity/agent.service.js';
import { WebhookService } from './webhook.service.js';

/** An agent's own webhook for its notifications (TL-95, E-147). */
@Controller('agents/:id/webhook')
export class AgentWebhooksController {
  constructor(
    @Inject(WebhookService) private readonly webhooks: WebhookService,
    @Inject(AgentService) private readonly agents: AgentService,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  @Endpoint({
    tag: 'Agents',
    summary: 'Set the webhook of an AI agent; the secret is returned only once',
    description:
      'Every new notification of the agent (mentions, assignments, comments …) is sent there as `notification.created`, signed like all webhooks (Standard Webhooks) and retried. Setting it again replaces URL and secret. For its responsible person and administrators, in the browser.',
    response: AgentWebhook,
  })
  @Put()
  async setWebhook(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @ValidBody(AgentWebhookRequest) body: AgentWebhookRequest,
  ): Promise<AgentWebhook> {
    await this.requireManager(principal, id);
    return this.webhooks.setForUser(principal, id, body.url);
  }

  @Endpoint({ tag: 'Agents', summary: 'Remove the webhook of an AI agent' })
  @Delete()
  @HttpCode(204)
  async removeWebhook(
    @CurrentPrincipal() principal: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.requireManager(principal, id);
    await this.webhooks.removeForUser(principal, id);
  }

  private async requireManager(principal: Principal, agentId: string): Promise<void> {
    if (principal.via !== 'session') {
      throw new ForbiddenException('Setting a webhook requires a browser session');
    }
    if (
      !(await this.agents.isOwner(agentId, principal.userId)) &&
      !(await this.access.isAdmin(principal))
    ) {
      throw new ForbiddenException('Only the responsible person or an administrator');
    }
  }
}
