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
  Req,
  Res,
} from '@nestjs/common';
import {
  AcceptInvitationRequest,
  CreateInvitationRequest,
  Invitation,
  InvitationPreview,
  RegisterRequest,
  RegistrationSettings,
} from '@toolvibes/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { RequireGlobal } from '../access/require-global.js';
import type { AppConfig } from '../core/config.js';
import { CurrentPrincipal, Public, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Principal } from '../core/http/principal.js';
import { CONFIG } from '../core/tokens.js';
import { clientOf } from '../identity/request-guards.js';
import { SessionService } from '../identity/session.service.js';
import { setSessionCookie } from '../identity/session-cookie.js';
import { InvitationService } from './invitation.service.js';

const Uuid = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

/** Invitations, project invitations and self-registration (TL-38, TL-67, E-119). */
@Controller()
export class InvitationsController {
  constructor(
    @Inject(InvitationService) private readonly invitations: InvitationService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Endpoint({
    tag: 'Invitations',
    summary: 'Invite someone by e-mail',
    description:
      'Administrators invite anybody; project administrators invite into their project with a role. People who already have an account are added to the project at once. The link works once and for seven days.',
    response: Invitation,
  })
  @Post('invitations')
  invite(
    @CurrentPrincipal() principal: Principal,
    @ValidBody(CreateInvitationRequest) body: CreateInvitationRequest,
  ): Promise<Invitation> {
    return this.invitations.invite(principal, body);
  }

  @Endpoint({
    tag: 'Invitations',
    summary: 'List all invitations (admin)',
    response: z.array(Invitation),
  })
  @Get('admin/invitations')
  all(@CurrentPrincipal() principal: Principal): Promise<Invitation[]> {
    return this.invitations.list(principal);
  }

  @Endpoint({
    tag: 'Invitations',
    summary: 'List the invitations of a project',
    response: z.array(Invitation),
  })
  @Get('projects/:key/invitations')
  ofProject(
    @CurrentPrincipal() principal: Principal,
    @Param('key') key: string,
  ): Promise<Invitation[]> {
    return this.invitations.list(principal, key.toUpperCase());
  }

  @Endpoint({ tag: 'Invitations', summary: 'Withdraw an invitation' })
  @Delete('invitations/:id')
  @HttpCode(204)
  revoke(@CurrentPrincipal() principal: Principal, @Param('id', Uuid) id: string): Promise<void> {
    return this.invitations.revoke(principal, id);
  }

  @Endpoint({
    tag: 'Invitations',
    summary: 'What an invitation link is about',
    response: InvitationPreview,
  })
  @Public()
  @Get('invitations/preview')
  preview(@Query('token') token: string | undefined): Promise<InvitationPreview> {
    return this.invitations.preview(token ?? '');
  }

  @Endpoint({
    tag: 'Invitations',
    summary: 'Accept an invitation or finish a registration',
    description:
      'Creates the account, signs it in (session cookie) and returns the project to open, if any.',
    response: z.object({ projectKey: z.string().nullable() }),
  })
  @Public()
  @Post('invitations/accept')
  @HttpCode(200)
  async accept(
    @ValidBody(AcceptInvitationRequest) body: AcceptInvitationRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ projectKey: string | null }> {
    const projectKey = await this.invitations.projectKeyOf(body.token);
    const userId = await this.invitations.accept(body);
    const session = await this.sessions.create(userId, 'password', clientOf(request));
    setSessionCookie(response, this.config, session.secret, session.expiresAt);
    return { projectKey };
  }

  @Endpoint({
    tag: 'Invitations',
    summary: 'Whether self-registration is open',
    response: RegistrationSettings,
  })
  @Public()
  @Get('auth/registration')
  registration(): Promise<RegistrationSettings> {
    return this.invitations.registration();
  }

  @Endpoint({
    tag: 'Invitations',
    summary: 'Register with an e-mail address',
    description:
      'Only for listed domains while self-registration is on. Sends a confirmation link; the answer is the same whether or not the address already has an account.',
  })
  @Public()
  @Post('auth/register')
  @HttpCode(202)
  async register(@ValidBody(RegisterRequest) body: RegisterRequest): Promise<void> {
    await this.invitations.register(body.email);
  }

  @Endpoint({
    tag: 'Invitations',
    summary: 'Self-registration settings (admin)',
    response: RegistrationSettings,
  })
  @RequireGlobal('admin')
  @Put('admin/registration-settings')
  setRegistration(
    @ValidBody(RegistrationSettings) body: RegistrationSettings,
  ): Promise<RegistrationSettings> {
    return this.invitations.setRegistration(body);
  }
}
