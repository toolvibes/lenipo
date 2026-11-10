import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  AddServiceCustomerRequest,
  CreatePortalRequest,
  InboundServiceRequest,
  InboundServiceResponse,
  InboundToken,
  IssueSla,
  PortalCommentRequest,
  PortalDesk,
  PortalRequest,
  PortalRequestDetail,
  QueueEntry,
  SaveRequestTypeRequest,
  ServiceDesk,
  ServiceDeskSettings,
} from '@toolvibes/shared';
import { z } from 'zod';
import { CurrentPrincipal, Public, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { ServiceDeskService } from './servicedesk.service.js';

const EntryId = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

/** Setting up a project as a service desk (TL-47, E-137); needs project administration. */
@Controller('projects/:key/service-desk')
export class ServiceDeskController {
  constructor(@Inject(ServiceDeskService) private readonly desks: ServiceDeskService) {}

  @Endpoint({
    tag: 'Service desk',
    summary: 'The service desk of a project',
    response: ServiceDesk,
  })
  @Get()
  getServiceDesk(@CurrentPrincipal() principal: Principal, @Param('key') key: string) {
    return this.desks.get(principal, key);
  }

  @Endpoint({
    tag: 'Service desk',
    summary: 'Run the project as a service desk, or change its settings',
    response: ServiceDesk,
  })
  @Put()
  saveServiceDesk(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(ServiceDeskSettings) body: ServiceDeskSettings,
  ) {
    return this.desks.save(principal, key, body);
  }

  @Endpoint({ tag: 'Service desk', summary: 'Stop running the project as a service desk' })
  @Delete()
  @HttpCode(204)
  disableServiceDesk(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<void> {
    return this.desks.disable(principal, key);
  }

  @Endpoint({
    tag: 'Service desk',
    summary: 'Issue a new token for the inbound endpoint',
    description:
      'Switches on requests from other systems, e.g. a form on a website (E-168). The token is shown only now; the old one stops working at once.',
    response: InboundToken,
  })
  @Post('inbound-token')
  @HttpCode(201)
  rotateInboundToken(@CurrentPrincipal() principal: Principal, @Param('key') key: string) {
    return this.desks.rotateInboundToken(principal, key);
  }

  @Endpoint({ tag: 'Service desk', summary: 'Switch off the inbound endpoint' })
  @Delete('inbound-token')
  @HttpCode(204)
  disableInbound(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<void> {
    return this.desks.disableInbound(principal, key);
  }

  @Endpoint({ tag: 'Service desk', summary: 'Add a request type', response: ServiceDesk })
  @Post('request-types')
  @HttpCode(201)
  addRequestType(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(SaveRequestTypeRequest) body: SaveRequestTypeRequest,
  ) {
    return this.desks.saveRequestType(principal, key, body);
  }

  @Endpoint({ tag: 'Service desk', summary: 'Change a request type', response: ServiceDesk })
  @Put('request-types/:id')
  updateRequestType(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Param('id', EntryId) id: string,
    @ValidBody(SaveRequestTypeRequest) body: SaveRequestTypeRequest,
  ) {
    return this.desks.saveRequestType(principal, key, body, id);
  }

  @Endpoint({ tag: 'Service desk', summary: 'Remove a request type' })
  @Delete('request-types/:id')
  @HttpCode(204)
  removeRequestType(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Param('id', EntryId) id: string,
  ): Promise<void> {
    return this.desks.removeRequestType(principal, key, id);
  }

  @Endpoint({
    tag: 'Service desk',
    summary: 'Add a customer (person or group)',
    response: ServiceDesk,
  })
  @Post('customers')
  @HttpCode(201)
  addCustomer(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(AddServiceCustomerRequest) body: AddServiceCustomerRequest,
  ) {
    return this.desks.addCustomer(principal, key, body);
  }

  @Endpoint({ tag: 'Service desk', summary: 'Remove a customer' })
  @Delete('customers/:id')
  @HttpCode(204)
  removeCustomer(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @Param('id', EntryId) id: string,
  ): Promise<void> {
    return this.desks.removeCustomer(principal, key, id);
  }
}

/** SLA clocks and the queue, for the people working on the requests (TL-47, E-137). */
@Controller()
export class ServiceQueueController {
  constructor(@Inject(ServiceDeskService) private readonly desks: ServiceDeskService) {}

  @Endpoint({
    tag: 'Service desk',
    summary: 'Open requests, the one closest to breaching its SLA first',
    response: z.array(QueueEntry),
  })
  @Get('projects/:key/service-desk/queue')
  serviceQueue(@CurrentPrincipal() principal: Principal, @Param('key') key: string) {
    return this.desks.queue(principal, key);
  }

  @Endpoint({
    tag: 'Service desk',
    summary: 'The SLA clocks of a request',
    response: z.object({ sla: IssueSla.nullable() }),
  })
  @Get('issues/:key/sla')
  async issueSla(@CurrentPrincipal() principal: Principal, @Param('key') key: string) {
    return { sla: await this.desks.sla(principal, key) };
  }
}

/** The customer portal (TL-47, E-137): only the caller's own requests, only public comments. */
@Controller('portal')
export class PortalController {
  constructor(@Inject(ServiceDeskService) private readonly desks: ServiceDeskService) {}

  @Endpoint({
    tag: 'Portal',
    summary: 'Service desks the caller may file requests in',
    response: z.array(PortalDesk),
  })
  @Get('desks')
  portalDesks(@CurrentPrincipal() principal: Principal) {
    return this.desks.portalDesks(principal);
  }

  @Endpoint({
    tag: 'Portal',
    summary: 'A service desk with its request types',
    response: PortalDesk,
  })
  @Get('desks/:key')
  portalDesk(@CurrentPrincipal() principal: Principal, @Param('key') key: string) {
    return this.desks.portalDesk(principal, key);
  }

  @Endpoint({ tag: 'Portal', summary: 'File a request', response: PortalRequestDetail })
  @Post('desks/:key/requests')
  @HttpCode(201)
  createRequest(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(CreatePortalRequest) body: CreatePortalRequest,
  ) {
    return this.desks.createRequest(principal, key, body);
  }

  @Endpoint({ tag: 'Portal', summary: 'The caller’s requests', response: z.array(PortalRequest) })
  @Get('requests')
  myRequests(@CurrentPrincipal() principal: Principal) {
    return this.desks.myRequests(principal);
  }

  @Endpoint({
    tag: 'Portal',
    summary: 'One of the caller’s requests with its public comments',
    response: PortalRequestDetail,
  })
  @Get('requests/:issueKey')
  portalRequest(@CurrentPrincipal() principal: Principal, @Param('issueKey') issueKey: string) {
    return this.desks.request(principal, issueKey);
  }

  @Endpoint({ tag: 'Portal', summary: 'Answer in a request', response: PortalRequestDetail })
  @Post('requests/:issueKey/comments')
  @HttpCode(201)
  portalComment(
    @CurrentPrincipal() principal: Principal,
    @Param('issueKey') issueKey: string,
    @ValidBody(PortalCommentRequest) body: PortalCommentRequest,
  ) {
    return this.desks.comment(principal, issueKey, body.body);
  }
}

/** Requests from other systems, e.g. a contact form on a website (E-168). */
@Controller('service-desk')
export class InboundController {
  constructor(@Inject(ServiceDeskService) private readonly desks: ServiceDeskService) {}

  @Endpoint({
    tag: 'Service desk',
    summary: 'File a request from another system',
    description:
      'Called with the token of the desk in `Authorization: Bearer <token>` (or `X-Lenipo-Token`). The person is found by email or gets an external account without a password, as a customer of this desk; answers reach them by mail. At most 10 requests per person and hour.',
    response: InboundServiceResponse,
  })
  @Public()
  @Post('inbound/:key')
  @HttpCode(201)
  inbound(
    @Param('key') key: string,
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-lenipo-token') header: string | undefined,
    @ValidBody(InboundServiceRequest) body: InboundServiceRequest,
  ): Promise<InboundServiceResponse> {
    const bearer = /^Bearer\s+(.+)$/i.exec(authorization ?? '')?.[1];
    return this.desks.inbound(key, header ?? bearer ?? '', body);
  }
}
