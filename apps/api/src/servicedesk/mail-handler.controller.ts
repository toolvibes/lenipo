import { Controller, Delete, Get, HttpCode, Inject, Param, Put } from '@nestjs/common';
import { MailHandler, MailReceipt, SaveMailHandlerRequest } from '@toolvibes/shared';
import { z } from 'zod';
import { CurrentPrincipal, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { MailHandlerService } from './mail-handler.service.js';

/** The mailbox of a project (TL-53, E-142), for its administrators. */
@Controller('projects/:key/mail-handler')
export class MailHandlerController {
  constructor(@Inject(MailHandlerService) private readonly mail: MailHandlerService) {}

  @Endpoint({
    tag: 'Projects',
    summary: 'The IMAP mailbox whose mails become issues and comments',
    response: z.object({ handler: MailHandler.nullable() }),
  })
  @Get()
  async getMailHandler(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<{ handler: MailHandler | null }> {
    return { handler: await this.mail.get(principal, key) };
  }

  @Endpoint({
    tag: 'Projects',
    summary: 'Set up the mailbox of a project',
    response: z.object({ handler: MailHandler.nullable() }),
  })
  @Put()
  async saveMailHandler(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
    @ValidBody(SaveMailHandlerRequest) body: SaveMailHandlerRequest,
  ): Promise<{ handler: MailHandler | null }> {
    return { handler: await this.mail.save(principal, key, body) };
  }

  @Endpoint({ tag: 'Projects', summary: 'Remove the mailbox of a project' })
  @Delete()
  @HttpCode(204)
  removeMailHandler(@CurrentPrincipal() principal: Principal, @Param('key') key: string) {
    return this.mail.remove(principal, key);
  }

  @Endpoint({
    tag: 'Projects',
    summary: 'The last mails the mailbox took in and what became of them',
    response: z.array(MailReceipt),
  })
  @Get('receipts')
  mailReceipts(@CurrentPrincipal() principal: Principal, @Param('key') key: string) {
    return this.mail.receipts(principal, key);
  }
}
