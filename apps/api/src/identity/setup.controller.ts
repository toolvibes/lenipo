import { Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { Me, SetupRequest, SetupStatusResponse } from '@tasklore/shared';
import type { Request, Response } from 'express';
import type { AppConfig } from '../core/config.js';
import { Public, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import { CONFIG } from '../core/tokens.js';
import { clientOf } from './request-guards.js';
import { SessionService } from './session.service.js';
import { setSessionCookie } from './session-cookie.js';
import { SetupService } from './setup.service.js';
import { UserService } from './user.service.js';

@Public()
@Controller('setup')
export class SetupController {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(SetupService) private readonly setup: SetupService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(UserService) private readonly users: UserService,
  ) {}

  @Endpoint({
    tag: 'Setup',
    summary: 'Report whether first-run setup is still required',
    response: SetupStatusResponse,
  })
  @Get('status')
  async status(): Promise<SetupStatusResponse> {
    return { required: await this.setup.isRequired() };
  }

  /** Creates the first administrator and signs them in. */
  @Endpoint({
    tag: 'Setup',
    summary: 'Create the first administrator with the setup code and sign in',
    response: Me,
  })
  @Post()
  @HttpCode(201)
  async complete(
    @ValidBody(SetupRequest) body: SetupRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Me> {
    const client = clientOf(request);
    const userId = await this.setup.complete(body, client.ip);
    const session = await this.sessions.create(userId, 'setup', client);
    setSessionCookie(response, this.config, session.secret, session.expiresAt);
    return this.users.me(userId, 'session');
  }
}
