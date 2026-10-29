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
  CreatedWebhook,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  Webhook,
  WebhookDelivery,
  WebhookSecret,
} from '@tasklore/shared';
import { z } from 'zod';
import { RequireGlobal } from '../access/require-global.js';
import { CurrentPrincipal, ValidBody, ValidQuery } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { WebhookService } from './webhook.service.js';

/** Unknown and malformed ids are both "not found". */
const Id = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

const DeliveriesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
type DeliveriesQuery = z.infer<typeof DeliveriesQuery>;

@RequireGlobal('admin')
@Controller('admin/webhooks')
export class WebhooksController {
  constructor(@Inject(WebhookService) private readonly webhooks: WebhookService) {}

  @Endpoint({ tag: 'Webhooks', summary: 'List webhooks', response: z.array(Webhook) })
  @Get()
  list(): Promise<Webhook[]> {
    return this.webhooks.list();
  }

  @Endpoint({
    tag: 'Webhooks',
    summary: 'Create a webhook',
    description:
      'Deliveries are signed per Standard Webhooks (headers `webhook-id`, `webhook-timestamp`, `webhook-signature`). The secret is only returned here and when rotated.',
    response: CreatedWebhook,
  })
  @Post()
  @HttpCode(201)
  create(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(CreateWebhookRequest) body: CreateWebhookRequest,
  ): Promise<CreatedWebhook> {
    return this.webhooks.create(principal, body);
  }

  @Endpoint({ tag: 'Webhooks', summary: 'Get a webhook', response: Webhook })
  @Get(':id')
  get(@Param('id', Id) id: string): Promise<Webhook> {
    return this.webhooks.get(id);
  }

  @Endpoint({
    tag: 'Webhooks',
    summary: 'Change a webhook',
    description: 'Enabling a webhook the system switched off also clears its failure state.',
    response: Webhook,
  })
  @Patch(':id')
  update(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Id) id: string,
    @ValidBody(UpdateWebhookRequest) body: UpdateWebhookRequest,
  ): Promise<Webhook> {
    return this.webhooks.update(principal, id, body);
  }

  @Endpoint({ tag: 'Webhooks', summary: 'Delete a webhook and its delivery log' })
  @Delete(':id')
  @HttpCode(204)
  delete(@CurrentPrincipal() principal: Principal, @Param('id', Id) id: string): Promise<void> {
    return this.webhooks.delete(principal, id);
  }

  @Endpoint({ tag: 'Webhooks', summary: 'Replace the signing secret', response: WebhookSecret })
  @Post(':id/rotate-secret')
  @HttpCode(200)
  async rotate(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Id) id: string,
  ): Promise<WebhookSecret> {
    return { secret: await this.webhooks.rotateSecret(principal, id) };
  }

  @Endpoint({
    tag: 'Webhooks',
    summary: 'Send a test message now',
    description: 'Returns the delivery with the receiver’s answer.',
    response: WebhookDelivery,
  })
  @Post(':id/test')
  @HttpCode(200)
  test(@Param('id', Id) id: string): Promise<WebhookDelivery> {
    return this.webhooks.test(id);
  }

  @Endpoint({
    tag: 'Webhooks',
    summary: 'List recent deliveries of a webhook (kept 30 days)',
    response: z.array(WebhookDelivery),
  })
  @Get(':id/deliveries')
  deliveries(
    @Param('id', Id) id: string,
    @ValidQuery(DeliveriesQuery) query: DeliveriesQuery,
  ): Promise<WebhookDelivery[]> {
    return this.webhooks.deliveries(id, query.limit);
  }

  @Endpoint({ tag: 'Webhooks', summary: 'Send a delivery again now', response: WebhookDelivery })
  @Post(':id/deliveries/:deliveryId/resend')
  @HttpCode(200)
  resend(
    @Param('id', Id) id: string,
    @Param('deliveryId', Id) deliveryId: string,
  ): Promise<WebhookDelivery> {
    return this.webhooks.resend(id, deliveryId);
  }
}
