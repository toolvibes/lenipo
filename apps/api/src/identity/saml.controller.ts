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
import { SamlProvider, SaveSamlProviderRequest, safeRedirectPath } from '@tasklore/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { RequireGlobal } from '../access/require-global.js';
import { AuditService } from '../audit/audit.service.js';
import type { AppConfig } from '../core/config.js';
import { Public, ValidBody } from '../core/http/decorators.js';
import { Endpoint } from '../core/http/endpoint.js';
import type { Logger } from '../core/logger.js';
import { CONFIG, LOGGER } from '../core/tokens.js';
import { AllowCrossSite, issuerOf } from './oauth.controller.js';
import { clientOf } from './request-guards.js';
import { SamlService } from './saml.service.js';
import { SessionService } from './session.service.js';
import { setSessionCookie } from './session-cookie.js';
import { UserService } from './user.service.js';

const Uuid = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

/** SAML 2.0 sign-in (P-USR-05, E-119): administration, the redirect to the IdP and the ACS. */
@Controller()
export class SamlController {
  constructor(
    @Inject(SamlService) private readonly saml: SamlService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(UserService) private readonly users: UserService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  @Endpoint({
    tag: 'SAML',
    summary: 'List SAML identity providers',
    response: z.array(SamlProvider),
  })
  @RequireGlobal('admin')
  @Get('admin/saml-providers')
  list(@Req() request: Request): Promise<SamlProvider[]> {
    return this.saml.list(issuerOf(this.config, request));
  }

  @Endpoint({
    tag: 'SAML',
    summary: 'Add a SAML identity provider',
    description:
      'From its metadata XML; the answer names the entity ID and ACS URL to enter at the IdP.',
    response: SamlProvider,
  })
  @RequireGlobal('admin')
  @Post('admin/saml-providers')
  create(
    @ValidBody(SaveSamlProviderRequest) body: SaveSamlProviderRequest,
    @Req() request: Request,
  ): Promise<SamlProvider> {
    return this.saml.save(null, body, issuerOf(this.config, request));
  }

  @Endpoint({ tag: 'SAML', summary: 'Change a SAML identity provider', response: SamlProvider })
  @RequireGlobal('admin')
  @Put('admin/saml-providers/:id')
  update(
    @Param('id', Uuid) id: string,
    @ValidBody(SaveSamlProviderRequest) body: SaveSamlProviderRequest,
    @Req() request: Request,
  ): Promise<SamlProvider> {
    return this.saml.save(id, body, issuerOf(this.config, request));
  }

  @Endpoint({ tag: 'SAML', summary: 'Remove a SAML identity provider' })
  @RequireGlobal('admin')
  @Delete('admin/saml-providers/:id')
  @HttpCode(204)
  remove(@Param('id', Uuid) id: string): Promise<void> {
    return this.saml.delete(id);
  }

  /** The service provider metadata to give the IdP. */
  @Public()
  @Get('auth/saml/:id/metadata')
  async metadata(
    @Param('id') id: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const xml = await this.saml.metadata(id, issuerOf(this.config, request));
    response.type('application/samlmetadata+xml').send(xml);
  }

  /** Browser navigation: off to the identity provider. */
  @Public()
  @Get('auth/saml/:id/start')
  async start(
    @Param('id') id: string,
    @Query('redirect') redirect: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const target = safeRedirectPath(redirect) ?? '/';
    response.redirect(302, await this.saml.startUrl(id, issuerOf(this.config, request), target));
  }

  /** The IdP posts the signed answer here (cross-site by nature); then the session starts. */
  @Public()
  @AllowCrossSite()
  @Post('auth/saml/:id/acs')
  async acs(
    @Param('id') id: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    try {
      const userId = await this.saml.acs(id, issuerOf(this.config, request), request.body ?? {});
      const session = await this.sessions.create(userId, 'oidc', clientOf(request));
      setSessionCookie(response, this.config, session.secret, session.expiresAt);
      await this.users.recordLogin(userId);
      await this.audit.record({
        action: 'auth.login',
        actorId: userId,
        via: 'session',
        ip: clientOf(request).ip,
        details: { method: 'saml' },
      });
      response.redirect(303, safeRedirectPath(String(request.body?.RelayState ?? '')) ?? '/');
    } catch (error) {
      this.logger.warn({ err: error, provider: id }, 'SAML sign-in failed');
      response.redirect(303, '/login?error=saml');
    }
  }
}
