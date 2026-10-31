import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CreateFilterSubscription, FilterSubscription } from '@tasklore/shared';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { FilterSubscriptionService } from './filter-subscription.service.js';
import { requireIssueScope } from './search.service.js';

const Uuid = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

/** E-mail subscriptions of saved filters (T-QRY-07, E-112). */
@Controller()
export class FilterSubscriptionsController {
  constructor(
    @Inject(FilterSubscriptionService) private readonly subscriptions: FilterSubscriptionService,
  ) {}

  @Endpoint({
    tag: 'Filters',
    summary: 'List subscriptions of a filter',
    description:
      'The caller’s own subscriptions and those of their groups; the owner of the filter sees all.',
    response: z.array(FilterSubscription),
  })
  @Get('filters/:id/subscriptions')
  listSubscriptions(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Uuid) id: string,
  ): Promise<FilterSubscription[]> {
    requireIssueScope(principal);
    return this.subscriptions.list(principal, id);
  }

  @Endpoint({
    tag: 'Filters',
    summary: 'Subscribe to a filter',
    description:
      'Whoever can see the filter gets its results by e-mail at the hour in their time zone: daily, on weekdays or once a week. The owner may subscribe a group they belong to; every member then gets only what they may see. At most 50 issues are listed.',
    response: FilterSubscription,
  })
  @Post('filters/:id/subscriptions')
  subscribe(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Uuid) id: string,
    @ValidBody(CreateFilterSubscription) body: CreateFilterSubscription,
  ): Promise<FilterSubscription> {
    requireIssueScope(principal);
    return this.subscriptions.create(principal, id, body);
  }

  @Endpoint({
    tag: 'Filters',
    summary: 'Delete a filter subscription (subscriber or filter owner)',
  })
  @Delete('filter-subscriptions/:id')
  @HttpCode(204)
  unsubscribe(
    @CurrentPrincipal() principal: Principal,
    @Param('id', Uuid) id: string,
  ): Promise<void> {
    requireIssueScope(principal);
    return this.subscriptions.delete(principal, id);
  }
}
